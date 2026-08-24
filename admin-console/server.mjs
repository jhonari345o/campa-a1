import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(currentDir, "public");
const envPath = path.join(currentDir, ".env.local");
const SESSION_COOKIE = "adm_console_session";
const SESSION_TTL = 8 * 60 * 60 * 1000;
const BODY_LIMIT = 64 * 1024;
const ROLES = new Set(["admin", "planner", "analyst", "viewer"]);

function loadEnvFile() {
  if (!fs.existsSync(envPath)) return;
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile();

const config = {
  supabaseUrl: process.env.SUPABASE_URL?.replace(/\/$/, ""),
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  adminPassword: process.env.LOCAL_ADMIN_PASSWORD,
  port: Number(process.env.LOCAL_ADMIN_PORT || 4177),
};

const missing = [
  !config.supabaseUrl && "SUPABASE_URL",
  !config.serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY",
  (!config.adminPassword || config.adminPassword.length < 16) && "LOCAL_ADMIN_PASSWORD (mínimo 16 caracteres)",
].filter(Boolean);

if (missing.length) {
  console.error(`Falta configurar: ${missing.join(", ")}. Copia admin-console/.env.example como admin-console/.env.local.`);
  process.exit(1);
}

const sessions = new Map();

function secureHeaders(contentType) {
  return {
    "content-type": contentType,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  };
}

function sendJson(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, { ...secureHeaders("application/json; charset=utf-8"), ...extraHeaders });
  response.end(JSON.stringify(payload));
}

function parseCookies(request) {
  return Object.fromEntries((request.headers.cookie || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf("=");
    return [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
  }));
}

function getSession(request) {
  const token = parseCookies(request)[SESSION_COOKIE];
  const session = token ? sessions.get(token) : null;
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL;
  return { token, ...session };
}

function hashesMatch(left, right) {
  const leftHash = createHash("sha256").update(String(left)).digest();
  const rightHash = createHash("sha256").update(String(right)).digest();
  return timingSafeEqual(leftHash, rightHash);
}

async function readJson(request) {
  let total = 0;
  const chunks = [];
  for await (const chunk of request) {
    total += chunk.length;
    if (total > BODY_LIMIT) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

async function supabaseFetch(endpoint, options = {}) {
  const response = await fetch(`${config.supabaseUrl}${endpoint}`, {
    ...options,
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) {
    const error = new Error(payload?.msg || payload?.message || payload?.error_description || `Supabase respondió ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function requireSession(request, response, csrf = false) {
  const session = getSession(request);
  if (!session) {
    sendJson(response, 401, { error: "Inicia sesión en la consola." });
    return null;
  }
  if (csrf && request.headers["x-csrf-token"] !== session.csrf) {
    sendJson(response, 403, { error: "La sesión local no pudo validarse. Recarga la página." });
    return null;
  }
  return session;
}

async function listCompanies() {
  return supabaseFetch("/rest/v1/companies?select=id,name,slug,status,seats&status=eq.activa&order=name.asc");
}

async function listUsers() {
  const [profiles, memberships] = await Promise.all([
    supabaseFetch("/rest/v1/profiles?select=id,email,full_name,is_platform_admin,created_at&order=created_at.desc&limit=250"),
    supabaseFetch("/rest/v1/company_members?select=user_id,role,company_id,companies(name)&order=created_at.desc&limit=500"),
  ]);
  const membershipByUser = new Map();
  for (const membership of memberships || []) {
    if (!membershipByUser.has(membership.user_id)) membershipByUser.set(membership.user_id, []);
    membershipByUser.get(membership.user_id).push({
      role: membership.role,
      companyId: membership.company_id,
      companyName: membership.companies?.name || "Sin empresa",
    });
  }
  return (profiles || []).map((profile) => ({
    ...profile,
    status: "active",
    memberships: membershipByUser.get(profile.id) || [],
  }));
}

async function createUser(input) {
  const email = String(input.email || "").trim().toLowerCase();
  const fullName = String(input.fullName || "").trim();
  const password = String(input.password || "");
  const companyId = String(input.companyId || "").trim();
  const role = String(input.role || "viewer");
  const isPlatformAdmin = input.isPlatformAdmin === true || input.isPlatformAdmin === "on";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Ingresa un correo válido.");
  if (fullName.length < 2 || fullName.length > 120) throw new Error("El nombre debe tener entre 2 y 120 caracteres.");
  if (password.length < 12) throw new Error("La contraseña temporal debe tener al menos 12 caracteres.");
  if (!/^[0-9a-f-]{36}$/i.test(companyId)) throw new Error("Selecciona una empresa válida.");
  if (!ROLES.has(role)) throw new Error("Selecciona un rol válido.");

  const companies = await supabaseFetch(
    `/rest/v1/companies?select=id,name,seats&id=eq.${encodeURIComponent(companyId)}&limit=1`,
  );
  const company = companies?.[0];
  if (!company) throw new Error("La empresa seleccionada no existe o no está activa.");

  const currentMembers = await supabaseFetch(
    `/rest/v1/company_members?select=user_id&company_id=eq.${encodeURIComponent(companyId)}`,
  );
  if ((currentMembers?.length || 0) >= company.seats) {
    throw new Error(`La empresa ya utilizó sus ${company.seats} cupos.`);
  }

  const authUser = await supabaseFetch("/auth/v1/admin/users", {
    method: "POST",
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }),
  });

  try {
    await supabaseFetch("/rest/v1/profiles?on_conflict=id", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: authUser.id,
        email,
        full_name: fullName,
        is_platform_admin: isPlatformAdmin,
      }),
    });
    await supabaseFetch("/rest/v1/company_members?on_conflict=company_id,user_id", {
      method: "POST",
      headers: { prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ company_id: companyId, user_id: authUser.id, role }),
    });
  } catch (error) {
    try { await supabaseFetch(`/auth/v1/admin/users/${authUser.id}`, { method: "DELETE" }); } catch { /* rollback best effort */ }
    throw error;
  }
  return { id: authUser.id, email, fullName, role, companyId, isPlatformAdmin };
}

function serveStatic(requestPath, response) {
  const files = {
    "/": ["index.html", "text/html; charset=utf-8"],
    "/index.html": ["index.html", "text/html; charset=utf-8"],
    "/styles.css": ["styles.css", "text/css; charset=utf-8"],
    "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  };
  const entry = files[requestPath];
  if (!entry) return false;
  const file = fs.readFileSync(path.join(publicDir, entry[0]));
  response.writeHead(200, secureHeaders(entry[1]));
  response.end(file);
  return true;
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
    if (request.method === "GET" && serveStatic(url.pathname, response)) return;

    if (url.pathname === "/api/session" && request.method === "GET") {
      const session = getSession(request);
      return sendJson(response, 200, session ? { authenticated: true, csrf: session.csrf } : { authenticated: false });
    }
    if (url.pathname === "/api/session" && request.method === "POST") {
      const input = await readJson(request);
      if (!hashesMatch(input.password || "", config.adminPassword)) return sendJson(response, 401, { error: "Frase de acceso incorrecta." });
      const token = randomBytes(32).toString("base64url");
      const csrf = randomBytes(24).toString("base64url");
      sessions.set(token, { csrf, expiresAt: Date.now() + SESSION_TTL });
      return sendJson(response, 200, { authenticated: true, csrf }, { "set-cookie": `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}` });
    }
    if (url.pathname === "/api/session" && request.method === "DELETE") {
      const session = requireSession(request, response, true);
      if (!session) return;
      sessions.delete(session.token);
      return sendJson(response, 200, { ok: true }, { "set-cookie": `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` });
    }
    if (url.pathname === "/api/companies" && request.method === "GET") {
      if (!requireSession(request, response)) return;
      return sendJson(response, 200, { companies: await listCompanies() });
    }
    if (url.pathname === "/api/users" && request.method === "GET") {
      if (!requireSession(request, response)) return;
      return sendJson(response, 200, { users: await listUsers() });
    }
    if (url.pathname === "/api/users" && request.method === "POST") {
      if (!requireSession(request, response, true)) return;
      return sendJson(response, 201, { user: await createUser(await readJson(request)) });
    }
    return sendJson(response, 404, { error: "Ruta no encontrada." });
  } catch (error) {
    const status = error.message === "body_too_large" ? 413 : Number(error.status || 500);
    const publicMessage = status >= 500 ? "La consola no pudo completar la operación. Revisa la terminal local." : error.message;
    if (status >= 500) console.error(`[admin-console] ${error.message}`);
    return sendJson(response, status, { error: publicMessage });
  }
});

server.listen(config.port, "127.0.0.1", () => {
  console.log(`Consola local de Ad Mavericks disponible en http://127.0.0.1:${config.port}`);
  console.log("La clave de servicio permanece únicamente en este proceso local.");
});
