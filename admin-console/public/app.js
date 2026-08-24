const state = { csrf: "", companies: [], users: [], filter: "" };

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
$("#logout-button").addEventListener("click", async () => {
  try { await api("/api/session", { method: "DELETE" }); } finally { state.csrf = ""; setView(false); }
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
