const dashboardMessage = document.querySelector("#dashboard-message");
const dashboardMonth = document.querySelector("#dashboard-month");
let lastDashboardLoad = 0;

function dashboardMoney(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}
function dashboardSet(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}
function currentMonth() {
  const now = new Date();
  return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
}
async function dashboardRequest(path) {
  const response = await fetch(path, { credentials: "same-origin", cache: "no-store" });
  if (response.status === 401) {
    window.location.assign("/");
    throw new Error("session_expired");
  }
  if (!response.ok) throw new Error("dashboard_request_failed");
  return response.json();
}
async function refreshDashboard(force = false) {
  const now = Date.now();
  if (!force && now - lastDashboardLoad < 10000) return;
  lastDashboardLoad = now;
  dashboardMessage.textContent = "Atualizando indicadores…";
  const month = dashboardMonth.value || currentMonth();
  const requests = await Promise.allSettled([
    dashboardRequest("/api/customers?status=active&limit=100"),
    dashboardRequest("/api/services"),
    dashboardRequest("/api/proposals"),
    dashboardRequest("/api/contracts"),
    dashboardRequest("/api/finance?month=" + encodeURIComponent(month))
  ]);
  let failures = 0;
  const valueAt = (index) => {
    if (requests[index].status === "rejected") { failures += 1; return null; }
    return requests[index].value;
  };
  const customers = valueAt(0);
  const services = valueAt(1);
  const proposals = valueAt(2);
  const contracts = valueAt(3);
  const finance = valueAt(4);

  if (customers) {
    dashboardSet("metric-customers", String(customers.customers.length) + (customers.hasMore ? "+" : ""));
    dashboardSet("metric-customers-note", customers.hasMore ? "Mais de 100 ativos" : "Clientes ativos na carteira");
  } else dashboardSet("metric-customers", "—");
  if (services) dashboardSet("metric-services", String(services.services.length));
  else dashboardSet("metric-services", "—");
  if (proposals) {
    const counts = { draft: 0, sent: 0, accepted: 0, rejected: 0 };
    for (const proposal of proposals.proposals) if (Object.hasOwn(counts, proposal.status)) counts[proposal.status] += 1;
    dashboardSet("metric-proposals", String(counts.draft + counts.sent));
    dashboardSet("metric-proposals-note", "Até " + proposals.proposals.length + " propostas recentes");
    for (const [status, count] of Object.entries(counts)) dashboardSet("status-" + status, String(count));
  } else {
    dashboardSet("metric-proposals", "—");
    for (const status of ["draft", "sent", "accepted", "rejected"]) dashboardSet("status-" + status, "—");
  }
  if (contracts) dashboardSet("metric-contracts", String(contracts.contracts.length));
  else dashboardSet("metric-contracts", "—");
  if (finance) {
    dashboardSet("dashboard-income", dashboardMoney(finance.summary.income));
    dashboardSet("dashboard-expenses", dashboardMoney(finance.summary.expenses));
    dashboardSet("dashboard-balance", dashboardMoney(finance.summary.balance));
  } else {
    for (const id of ["dashboard-income", "dashboard-expenses", "dashboard-balance"]) dashboardSet(id, "—");
  }
  const updated = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  dashboardMessage.textContent = failures
    ? "Alguns indicadores não puderam ser atualizados. Confira sua conexão ou tente novamente."
    : "Dados atualizados às " + updated + ".";
  dashboardMessage.dataset.state = failures ? "error" : "success";
}
dashboardMonth.value = currentMonth();
document.querySelector("[data-dashboard-refresh]")?.addEventListener("click", () => refreshDashboard(true));
dashboardMonth.addEventListener("change", () => refreshDashboard(true));
window.addEventListener("crm:view-changed", (event) => {
  if (event.detail?.view === "overview") refreshDashboard();
});
refreshDashboard(true);
