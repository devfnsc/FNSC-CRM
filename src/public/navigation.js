const viewButtons = [...document.querySelectorAll("[data-view-target]")];
const views = [...document.querySelectorAll("[data-crm-view]")];
const viewDescriptions = {
  overview: ["Visão geral", "Acompanhe os principais números e retome seu trabalho."],
  customers: ["Clientes", "Organize contatos, empresas e histórico de relacionamento."],
  services: ["Serviços", "Mantenha o catálogo que será usado nas propostas."],
  proposals: ["Propostas", "Crie, acompanhe e atualize suas propostas comerciais."],
  contracts: ["Contratos", "Revise contratos e versões."],
  onboarding: ["Onboarding", "Organize as etapas iniciais de atendimento de cada cliente."],
  finance: ["Financeiro", "Consulte entradas, saídas e o saldo de cada mês."],
  company: ["Perfil da empresa", "Mantenha os dados usados em propostas e contratos."]
};
const pageTitle = document.querySelector("#current-view-title");
const pageDescription = document.querySelector("#current-view-description");

function showCrmView(name, options = {}) {
  if (!viewDescriptions[name]) name = "overview";
  for (const view of views) view.hidden = view.dataset.crmView !== name;
  for (const button of viewButtons) {
    if (button.dataset.viewTarget === name) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
  if (pageTitle) pageTitle.textContent = viewDescriptions[name][0];
  if (pageDescription) pageDescription.textContent = viewDescriptions[name][1];
  document.querySelector("[data-overview-only]")?.toggleAttribute("hidden", name !== "overview");
  document.title = viewDescriptions[name][0] + " | FNSC-CRM";
  if (options.updateHash && location.hash !== "#" + name) {
    history.replaceState(null, "", "#" + name);
  }
  window.dispatchEvent(new CustomEvent("crm:view-changed", { detail: { view: name } }));
}

for (const button of viewButtons) {
  button.addEventListener("click", () => showCrmView(button.dataset.viewTarget, { updateHash: true }));
}
for (const link of document.querySelectorAll("[data-view-link]")) {
  link.addEventListener("click", () => showCrmView(link.dataset.viewLink, { updateHash: true }));
}
window.addEventListener("hashchange", () => showCrmView(location.hash.slice(1), { updateHash: true }));
showCrmView(location.hash.slice(1) || "overview");

const themeToggle = document.querySelector("#theme-toggle");
function getSavedTheme() {
  try { return localStorage.getItem("fnsc-crm-theme"); } catch (_error) { return null; }
}
function applyTheme(theme, save = false) {
  const normalized = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = normalized;
  if (themeToggle) {
    const dark = normalized === "dark";
    themeToggle.setAttribute("aria-pressed", String(dark));
    themeToggle.textContent = dark ? "Ativar modo claro" : "Ativar modo escuro";
  }
  if (save) {
    try { localStorage.setItem("fnsc-crm-theme", normalized); } catch (_error) { /* Preferência opcional. */ }
  }
}
const savedTheme = getSavedTheme();
const systemPrefersDark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
applyTheme(savedTheme || (systemPrefersDark ? "dark" : "light"));
themeToggle?.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(next, true);
});
