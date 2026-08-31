const state = { csrf: "", companies: [], users: [], filter: "", credentials: null, metaAssets: null, activeView: "users" };

const $ = (selector) => document.querySelector(selector);

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(state.csrf ? { "x-csrf-token": state.csrf } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "No fue posible completar la operación.");
  return payload;
}

function showToast(message, type = "success") {
  const toast = $("#toast");
  toast.textContent = message;
  toast.className = `toast ${type}`;
  window.setTimeout(() => toast.classList.add("hidden"), 4200);
}

function showError(selector, message) {
  const element = $(selector);
  element.textContent = message;
  element.classList.toggle("hidden", !message);
}

function setView(authenticated) {
  $("#login-view").classList.toggle("hidden", authenticated);
  $("#app-view").classList.toggle("hidden", !authenticated);
}

function switchSection(section) {
  state.activeView = section;
  $("#users-view").classList.toggle("hidden", section !== "users");
  $("#integrations-view").classList.toggle("hidden", section !== "integrations");
  $("#nav-users").classList.toggle("active", section === "users");
  $("#nav-integrations").classList.toggle("active", section === "integrations");
}

function roleLabel(role) {
  return ({ admin: "Admin", planner: "Planificador", analyst: "Analista", approver: "Aprobador", viewer: "Lectura" })[role] || role;
}

function renderCompanies() {
  const select = $("#company");
  select.replaceChildren();
  for (const company of state.companies) {
    const option = document.createElement("option");
    option.value = company.id;
    option.textContent = `${company.name} · ${company.seats} cupos`;
    select.append(option);
  }
  $("#stat-companies").textContent = String(state.companies.length);
  $("#create-user-button").disabled = state.companies.length === 0;
}

function renderUsers() {
  const body = $("#users-body");
  body.replaceChildren();
  const term = state.filter.trim().toLowerCase();
  const filtered = state.users.filter((user) => `${user.full_name} ${user.email}`.toLowerCase().includes(term));
  for (const user of filtered) {
    const membership = user.memberships[0] || {};
    const row = document.createElement("tr");
    const userCell = document.createElement("td");
    const name = document.createElement("strong");
    const email = document.createElement("small");
    name.textContent = user.full_name || "Sin nombre";
    email.textContent = user.email;
    userCell.append(name, email);

    const orgCell = document.createElement("td");
    orgCell.textContent = membership.companyName || "Sin empresa";
    const roleCell = document.createElement("td");
    const role = document.createElement("span");
    role.className = "role-pill";
    role.textContent = user.is_platform_admin ? "Staff Ad Mavericks" : roleLabel(membership.role || "viewer");
    roleCell.append(role);
    const statusCell = document.createElement("td");
    const status = document.createElement("span");
    status.className = `status-pill ${user.status}`;
    status.textContent = user.status === "active" ? "Activo" : user.status;
    statusCell.append(status);
    row.append(userCell, orgCell, roleCell, statusCell);
    body.append(row);
  }
  $("#empty-users").classList.toggle("hidden", filtered.length > 0);
  $("#stat-users").textContent = String(state.users.length);
  $("#stat-active").textContent = String(state.users.filter((user) => user.status === "active").length);
}

async function loadData() {
  const [companies, users] = await Promise.all([api("/api/companies"), api("/api/users")]);
  state.companies = companies.companies || [];
  state.users = users.users || [];
  renderCompanies();
  renderUsers();
}

function renderCredentialStatus() {
  const payload = state.credentials;
  if (!payload) return;
  $("#aws-app-name").textContent = `${payload.app.name} · ${payload.app.id}`;
  $("#aws-branch-name").textContent = payload.app.branch;
  $("#aws-region").textContent = payload.app.region;

  const statusGrid = $("#credential-status");
  statusGrid.replaceChildren();
  for (const group of payload.groups || []) {
    const article = document.createElement("article");
    const heading = document.createElement("div");
    const title = document.createElement("strong");
    const badge = document.createElement("span");
    title.textContent = group.label;
    badge.className = `credential-badge ${group.ready ? "ready" : "missing"}`;
    badge.textContent = group.ready ? "Configurada" : "Incompleta";
    heading.append(title, badge);
    const list = document.createElement("ul");
    for (const field of group.fields || []) {
      const item = document.createElement("li");
      const key = document.createElement("span");
      const presence = document.createElement("b");
      key.textContent = field.key;
      presence.textContent = field.present ? (field.value || "Asignada") : "Falta";
      presence.className = field.present ? "is-ready" : "is-missing";
      item.append(key, presence);
      list.append(item);
    }
    article.append(heading, list);
    statusGrid.append(article);
  }

  setGuard("#guard-payments", payload.controls?.commercialPayments, "Cobros");
  setGuard("#guard-drafts", payload.controls?.metaDrafts, "Borradores Meta");
  setGuard("#guard-spend", payload.controls?.metaSpend, "Gasto Meta");
}

function metaPermissionLabel(permission) {
  return ({
    ads_management: "Administrar anuncios",
    ads_read: "Leer anuncios",
    business_management: "Business Manager",
    pages_read_engagement: "Leer página",
    pages_show_list: "Listar páginas",
  })[permission] || permission;
}

function renderMetaAssets(payload) {
  state.metaAssets = payload;
  $("#meta-discovery").classList.remove("hidden");
  $("#meta-actor-name").textContent = payload.actor?.name || "Cuenta Meta autorizada";
  const granted = (payload.permissions || []).filter((item) => item.granted).length;
  const total = (payload.permissions || []).length;
  const permissionSummary = $("#meta-permission-summary");
  permissionSummary.textContent = `${granted}/${total} permisos`;
  permissionSummary.className = `credential-badge ${granted === total ? "ready" : "missing"}`;

  const permissionContainer = $("#meta-permissions");
  permissionContainer.replaceChildren();
  for (const item of payload.permissions || []) {
    const chip = document.createElement("span");
    chip.className = item.granted ? "is-ready" : "is-missing";
    chip.textContent = `${item.granted ? "✓" : "!"} ${metaPermissionLabel(item.permission)}`;
    permissionContainer.append(chip);
  }

  const accountList = $("#meta-ad-accounts");
  const accountCards = $("#meta-account-cards");
  accountList.replaceChildren();
  accountCards.replaceChildren();
  for (const account of payload.adAccounts || []) {
    const option = document.createElement("option");
    option.value = account.id;
    option.label = `${account.name}${account.businessName ? ` · ${account.businessName}` : ""}`;
    accountList.append(option);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "meta-asset-card";
    button.dataset.metaAccountId = account.id;
    const heading = document.createElement("strong");
    heading.textContent = account.name;
    const details = document.createElement("small");
    details.textContent = `${account.id} · ${account.currency || "moneda pendiente"}${account.businessName ? ` · ${account.businessName}` : ""}`;
    const status = document.createElement("span");
    status.className = account.active ? "ready" : "blocked";
    status.textContent = account.active ? (account.fundingDetected ? "Activa · facturación detectada" : "Activa · confirmar facturación") : `No activa · estado ${account.statusCode}`;
    button.append(heading, details, status);
    button.addEventListener("click", () => selectMetaAccount(account.id));
    accountCards.append(button);
  }

  const pageList = $("#meta-pages");
  const pageCards = $("#meta-page-cards");
  pageList.replaceChildren();
  pageCards.replaceChildren();
  for (const page of payload.pages || []) {
    const option = document.createElement("option");
    option.value = page.id;
    option.label = `${page.name}${page.instagram?.username ? ` · @${page.instagram.username}` : ""}`;
    pageList.append(option);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "meta-asset-card";
    button.dataset.metaPageId = page.id;
    const heading = document.createElement("strong");
    heading.textContent = page.name;
    const details = document.createElement("small");
    details.textContent = page.instagram?.username ? `Instagram @${page.instagram.username}` : "Sin Instagram profesional vinculado";
    const status = document.createElement("span");
    status.className = page.instagram ? "ready" : "blocked";
    status.textContent = page.instagram ? "Facebook + Instagram" : "Solo Facebook";
    button.append(heading, details, status);
    button.addEventListener("click", () => selectMetaPage(page.id));
    pageCards.append(button);
  }

  if (!(payload.adAccounts || []).length) showError("#meta-discovery-error", "Meta no devolvió cuentas publicitarias asignadas a este token. Asígnalas al usuario de sistema en Business Manager o escribe el ID manualmente.");
  else if (!(payload.pages || []).length) showError("#meta-discovery-error", "Meta no devolvió páginas asignadas. Puedes escribir los IDs manualmente después de asignar los activos al token.");
  else showError("#meta-discovery-error", "");

  const firstActive = (payload.adAccounts || []).find((account) => account.active);
  if (firstActive) selectMetaAccount(firstActive.id);
  const firstLinkedPage = (payload.pages || []).find((page) => page.instagram);
  if (firstLinkedPage) selectMetaPage(firstLinkedPage.id);
}

function selectMetaAccount(accountId) {
  $("#meta-ad-account").value = accountId;
  $("#meta-credit-confirmed").checked = false;
  for (const card of document.querySelectorAll("[data-meta-account-id]")) card.classList.toggle("is-selected", card.dataset.metaAccountId === accountId);
}

function selectMetaPage(pageId) {
  $("#meta-page-id").value = pageId;
  const page = state.metaAssets?.pages?.find((item) => item.id === pageId);
  $("#meta-instagram-id").value = page?.instagram?.id || "";
  for (const card of document.querySelectorAll("[data-meta-page-id]")) card.classList.toggle("is-selected", card.dataset.metaPageId === pageId);
}

function setGuard(selector, enabled, label) {
  const element = $(selector);
  element.textContent = `${label} ${enabled ? "habilitados" : "bloqueados"}`;
  element.classList.toggle("enabled", Boolean(enabled));
}

async function loadCredentials() {
  showError("#credentials-error", "");
  try {
    state.credentials = await api("/api/credentials");
    renderCredentialStatus();
  } catch (error) {
    showError("#credentials-error", `${error.message} Comprueba el perfil AWS configurado para esta consola local.`);
  }
}

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const random = new Uint32Array(18);
  crypto.getRandomValues(random);
  $("#password").value = Array.from(random, (number) => alphabet[number % alphabet.length]).join("");
}

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("#login-error", "");
  try {
    const result = await api("/api/session", { method: "POST", body: JSON.stringify({ password: $("#admin-password").value }) });
    state.csrf = result.csrf;
    setView(true);
    $("#admin-password").value = "";
    try {
      await loadData();
    } catch (error) {
      showToast(error.message, "error");
    }
  } catch (error) {
    showError("#login-error", error.message);
  }
});

$("#user-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  showError("#form-error", "");
  const button = $("#create-user-button");
  button.disabled = true;
  button.textContent = "Creando usuario…";
  try {
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    await api("/api/users", { method: "POST", body: JSON.stringify(payload) });
    event.currentTarget.reset();
    if (state.companies[0]) $("#company").value = state.companies[0].id;
    $("#role").value = "planner";
    showToast(`Usuario ${payload.email} creado correctamente.`);
    await loadData();
  } catch (error) {
    showError("#form-error", error.message);
  } finally {
    button.disabled = false;
    button.replaceChildren(document.createTextNode("Crear usuario "), Object.assign(document.createElement("span"), { textContent: "→" }));
  }
});

$("#generate-password").addEventListener("click", generatePassword);
$("#refresh-button").addEventListener("click", async () => {
  try { await loadData(); showToast("Directorio actualizado."); } catch (error) { showToast(error.message, "error"); }
});
$("#user-search").addEventListener("input", (event) => { state.filter = event.target.value; renderUsers(); });
$("#nav-users").addEventListener("click", () => switchSection("users"));
$("#nav-integrations").addEventListener("click", async () => {
  switchSection("integrations");
  await loadCredentials();
});
$("#refresh-credentials").addEventListener("click", async () => {
  await loadCredentials();
  if (state.credentials) showToast("Estado de integraciones actualizado.");
});
$("#meta-discover-button").addEventListener("click", async () => {
  showError("#credentials-error", "");
  showError("#meta-discovery-error", "");
  const button = $("#meta-discover-button");
  const token = $("#meta-access-token").value.trim();
  if (!token) return showError("#credentials-error", "Pega primero el token de sistema o de larga duración de Meta.");
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = "Consultando Meta de forma segura…";
  try {
    const payload = await api("/api/meta/discover", {
      method: "POST",
      body: JSON.stringify({ accessToken: token, apiVersion: $("#meta-api-version").value }),
    });
    renderMetaAssets(payload);
    showToast(`Meta respondió: ${payload.adAccounts.length} cuenta(s) y ${payload.pages.length} página(s) disponibles.`);
  } catch (error) {
    showError("#credentials-error", error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
});
$("#meta-ad-account").addEventListener("input", (event) => selectMetaAccount(event.target.value));
$("#meta-page-id").addEventListener("input", (event) => selectMetaPage(event.target.value));
for (const form of document.querySelectorAll("[data-credential-group]")) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showError("#credentials-error", "");
    const button = form.querySelector('button[type="submit"]');
    const original = button.innerHTML;
    button.disabled = true;
    button.textContent = "Validando y desplegando…";
    try {
      if (form.dataset.credentialGroup === "meta" && !$("#meta-credit-confirmed").checked) {
        throw new Error("Confirma que la cuenta publicitaria seleccionada utiliza la línea de crédito o método de pago correcto.");
      }
      const values = Object.fromEntries(Array.from(new FormData(form).entries()).filter(([, value]) => String(value).trim()));
      const result = await api("/api/credentials", {
        method: "POST",
        body: JSON.stringify({ group: form.dataset.credentialGroup, values, redeploy: true }),
      });
      for (const input of form.querySelectorAll('input[type="password"],input:not([type])')) input.value = "";
      if (form.dataset.credentialGroup === "meta") {
        $("#meta-credit-confirmed").checked = false;
        state.metaAssets = null;
        $("#meta-discovery").classList.add("hidden");
        $("#meta-account-cards").replaceChildren();
        $("#meta-page-cards").replaceChildren();
      }
      showToast(`${result.validation} Despliegue ${result.deployment?.jobId ? `#${result.deployment.jobId}` : "iniciado"}.`);
      await loadCredentials();
    } catch (error) {
      showError("#credentials-error", error.message);
    } finally {
      button.disabled = false;
      button.innerHTML = original;
    }
  });
}
$("#logout-button").addEventListener("click", async () => {
  try { await api("/api/session", { method: "DELETE" }); } finally { state.csrf = ""; switchSection("users"); setView(false); }
});

(async function initialize() {
  try {
    const session = await api("/api/session");
    if (!session.authenticated) return setView(false);
    state.csrf = session.csrf;
    setView(true);
    try {
      await loadData();
    } catch (error) {
      showToast(error.message, "error");
    }
  } catch {
    setView(false);
  }
})();
