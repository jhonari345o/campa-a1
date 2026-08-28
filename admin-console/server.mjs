import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import {
  AmplifyClient,
  GetAppCommand,
  GetBranchCommand,
  StartJobCommand,
  UpdateAppCommand,
  UpdateBranchCommand,
} from "@aws-sdk/client-amplify";
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
const ROLES = new Set(["admin", "planner", "analyst", "approver", "viewer"]);
const AMPLIFY_SAFE_VALUES = new Set([
  "AI_PROVIDER",
  "OPENROUTER_MODEL",
  "AI_ASSISTANT_ENABLED",
  "AI_WEB_TRENDS_ENABLED",
  "DLOCALGO_ENV",
  "COMMERCIAL_PAYMENTS_ENABLED",
  "META_GRAPH_API_VERSION",
  "META_PAUSED_DRAFTS_ENABLED",
  "META_REAL_SPEND_ENABLED",
]);
const CREDENTIAL_GROUPS = {
  openrouter: {
    label: "Mavi · OpenRouter",
    keys: ["OPENROUTER_API_KEY", "OPENROUTER_MODEL"],
    required: ["OPENROUTER_API_KEY", "OPENROUTER_MODEL"],
    defaults: {
      AI_PROVIDER: "openrouter",
      AI_ASSISTANT_ENABLED: "true",
      AI_WEB_TRENDS_ENABLED: "true",
      OPENROUTER_MODEL: "openrouter/free",
    },
  },
  dlocal: {
    label: "Cobros · dLocal Go",
    keys: ["DLOCALGO_API_KEY", "DLOCALGO_SECRET_KEY", "DLOCALGO_ENV"],
    required: ["DLOCALGO_API_KEY", "DLOCALGO_SECRET_KEY", "DLOCALGO_ENV"],
    defaults: { DLOCALGO_ENV: "live" },
  },
  meta: {
    label: "Pauta · Meta Ads",
    keys: ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID", "META_PAGE_ID", "META_INSTAGRAM_USER_ID", "META_GRAPH_API_VERSION"],
    required: ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID", "META_PAGE_ID", "META_INSTAGRAM_USER_ID"],
    defaults: { META_GRAPH_API_VERSION: "v25.0" },
  },
  maps: {
    label: "Mapas · Google",
    keys: ["NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY"],
    required: ["NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY"],
    defaults: {},
  },
};

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
  awsRegion: process.env.AWS_REGION || "us-east-1",
  amplifyAppId: process.env.AMPLIFY_APP_ID || "djk125z43ran7",
  amplifyBranchName: process.env.AMPLIFY_BRANCH_NAME || "claude/adsmaiber-website-admin-9xc3cv",
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
const amplify = new AmplifyClient({ region: config.awsRegion });

function clientError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

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

async function readAmplifyEnvironment() {
  const [appResult, branchResult] = await Promise.all([
    amplify.send(new GetAppCommand({ appId: config.amplifyAppId })),
    amplify.send(new GetBranchCommand({ appId: config.amplifyAppId, branchName: config.amplifyBranchName })),
  ]);
  const appVariables = appResult.app?.environmentVariables || {};
  const branchVariables = branchResult.branch?.environmentVariables || {};
  return {
    appVariables,
    branchVariables,
    effective: { ...appVariables, ...branchVariables },
    appName: appResult.app?.name || config.amplifyAppId,
    defaultDomain: appResult.app?.defaultDomain || null,
  };
}

function credentialStatus(environment) {
  const groups = Object.entries(CREDENTIAL_GROUPS).map(([id, group]) => ({
    id,
    label: group.label,
    ready: group.required.every((key) => Boolean(environment.effective[key]?.trim())),
    fields: group.keys.map((key) => ({
      key,
      present: Boolean(environment.effective[key]?.trim()),
      source: Object.hasOwn(environment.branchVariables, key) ? "branch" : Object.hasOwn(environment.appVariables, key) ? "app" : null,
      ...(AMPLIFY_SAFE_VALUES.has(key) ? { value: environment.effective[key] || "" } : {}),
    })),
  }));
  return {
    app: {
      id: config.amplifyAppId,
      name: environment.appName,
      branch: config.amplifyBranchName,
      region: config.awsRegion,
      domain: environment.defaultDomain,
    },
    groups,
    controls: {
      commercialPayments: environment.effective.COMMERCIAL_PAYMENTS_ENABLED === "true",
      metaDrafts: environment.effective.META_PAUSED_DRAFTS_ENABLED === "true",
      metaSpend: environment.effective.META_REAL_SPEND_ENABLED === "true",
    },
  };
}

function normalizeCredentialUpdates(groupId, rawValues) {
  const group = CREDENTIAL_GROUPS[groupId];
  if (!group) throw clientError("Selecciona una integración válida.");
  const values = rawValues && typeof rawValues === "object" ? rawValues : {};
  const allowed = new Set(group.keys);
  const updates = { ...group.defaults };
  for (const [key, rawValue] of Object.entries(values)) {
    if (!allowed.has(key)) throw clientError(`La variable ${key} no pertenece a esta integración.`);
    const value = String(rawValue || "").trim();
    if (!value) continue;
    if (value.length > 4096 || /[\r\n\0]/.test(value)) throw clientError(`El valor de ${key} no es válido.`);
    updates[key] = value;
  }
  if (groupId === "openrouter" && updates.OPENROUTER_API_KEY && !updates.OPENROUTER_API_KEY.startsWith("sk-or-v1-")) {
    throw clientError("OpenRouter necesita una API Key de inferencia con formato sk-or-v1-. No uses una Management Key.");
  }
  if (groupId === "dlocal" && updates.DLOCALGO_ENV && !["sandbox", "live"].includes(updates.DLOCALGO_ENV)) {
    throw clientError("El ambiente de dLocal Go debe ser sandbox o live.");
  }
  if (groupId === "meta") {
    if (updates.META_AD_ACCOUNT_ID && !/^(?:act_)?\d+$/.test(updates.META_AD_ACCOUNT_ID)) {
      throw clientError("META_AD_ACCOUNT_ID debe ser numérico y puede comenzar con act_.");
    }
    for (const key of ["META_PAGE_ID", "META_INSTAGRAM_USER_ID"]) {
      if (updates[key] && !/^\d+$/.test(updates[key])) throw clientError(`${key} debe contener únicamente el identificador numérico de Meta.`);
    }
  }
  return { group, updates };
}

async function validateProviderCredential(groupId, updates) {
  if (groupId === "openrouter" && updates.OPENROUTER_API_KEY) {
    const response = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { authorization: `Bearer ${updates.OPENROUTER_API_KEY}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw clientError("OpenRouter rechazó la clave. Crea una API Key normal, verifica el correo de la cuenta y no uses una Management Key.");
    }
    return "Clave de inferencia reconocida por OpenRouter.";
  }
  if (groupId === "meta" && updates.META_ACCESS_TOKEN) {
    const version = updates.META_GRAPH_API_VERSION || "v25.0";
    const response = await fetch(`https://graph.facebook.com/${version}/me?fields=id,name`, {
      headers: { authorization: `Bearer ${updates.META_ACCESS_TOKEN}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw clientError("Meta rechazó el token. Verifica que sea un token de sistema vigente y con permisos de Marketing API.");
    return "Token reconocido por Meta en una consulta de solo lectura.";
  }
  if (groupId === "dlocal") return "Las credenciales ingresadas se guardarán; la validación transaccional se realiza sin cobrar en el checklist de lanzamiento.";
  return "Formato aceptado.";
}

async function updateAmplifyCredentials(input) {
  const groupId = String(input.group || "");
  const { group, updates } = normalizeCredentialUpdates(groupId, input.values);
  const meaningfulKeys = Object.keys(updates).filter((key) => !Object.hasOwn(group.defaults, key) || String(input.values?.[key] || "").trim());
  if (meaningfulKeys.length === 0) throw clientError("Escribe al menos una credencial nueva.");

  const validation = await validateProviderCredential(groupId, updates);
  const environment = await readAmplifyEnvironment();
  const appVariables = { ...environment.appVariables };
  const branchVariables = { ...environment.branchVariables };
  let appChanged = false;
  let branchChanged = false;

  for (const [key, value] of Object.entries(updates)) {
    if (Object.hasOwn(branchVariables, key)) {
      branchVariables[key] = value;
      branchChanged = true;
    } else {
      appVariables[key] = value;
      appChanged = true;
    }
  }
  if (appChanged) {
    await amplify.send(new UpdateAppCommand({ appId: config.amplifyAppId, environmentVariables: appVariables }));
  }
  if (branchChanged) {
    await amplify.send(new UpdateBranchCommand({
      appId: config.amplifyAppId,
      branchName: config.amplifyBranchName,
      environmentVariables: branchVariables,
    }));
  }

  let deployment = null;
  if (input.redeploy === true) {
    const job = await amplify.send(new StartJobCommand({
      appId: config.amplifyAppId,
      branchName: config.amplifyBranchName,
      jobType: "RELEASE",
      jobReason: `Rotación local de ${group.label}`,
    }));
    deployment = { jobId: job.jobSummary?.jobId || null, status: job.jobSummary?.status || "PENDING" };
  }

  fs.appendFileSync(path.join(currentDir, ".audit.log"), `${JSON.stringify({
    at: new Date().toISOString(),
    action: "credentials.update",
    group: groupId,
    keys: Object.keys(updates),
    appId: config.amplifyAppId,
    branch: config.amplifyBranchName,
    redeploy: input.redeploy === true,
  })}\n`, { encoding: "utf8", mode: 0o600 });
  return { ok: true, validation, deployment, changed: Object.keys(updates) };
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
    if (url.pathname === "/api/credentials" && request.method === "GET") {
      if (!requireSession(request, response)) return;
      return sendJson(response, 200, credentialStatus(await readAmplifyEnvironment()));
    }
    if (url.pathname === "/api/credentials" && request.method === "POST") {
      if (!requireSession(request, response, true)) return;
      return sendJson(response, 200, await updateAmplifyCredentials(await readJson(request)));
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
