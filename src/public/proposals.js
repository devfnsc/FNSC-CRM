const proposalForm = document.querySelector("#proposal-form");
const customerSelect = document.querySelector("#proposal-customer");
const itemList = document.querySelector("#proposal-item-list");
const addItemButton = document.querySelector("#add-proposal-item");
const totalLabel = document.querySelector("#proposal-total");
const proposalMessage = document.querySelector("#proposal-message");
const proposalList = document.querySelector("#proposal-list");
const proposalListMessage = document.querySelector("#proposal-list-message");

let services = [];

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function addProposalCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value || "—";
  row.append(cell);
}

async function loadProposalOptions() {
  const [customersResponse, servicesResponse] = await Promise.all([
    fetch("/api/customers?limit=100&status=active", { credentials: "same-origin" }),
    fetch("/api/services", { credentials: "same-origin" })
  ]);
  if (customersResponse.status === 401 || servicesResponse.status === 401) {
    window.location.assign("/");
    return;
  }
  if (!customersResponse.ok || !servicesResponse.ok) throw new Error("options_failed");

  const customerResult = await customersResponse.json();
  const serviceResult = await servicesResponse.json();
  customerSelect.replaceChildren(new Option("Selecione um cliente", ""));
  for (const customer of customerResult.customers) {
    customerSelect.add(new Option(customer.name + (customer.companyName ? " — " + customer.companyName : ""), customer.id));
  }
  services = serviceResult.services;
  if (!services.length) {
    proposalMessage.textContent = "Cadastre ao menos um serviço antes de criar propostas.";
    addItemButton.disabled = true;
    return;
  }
  itemList.replaceChildren();
  addProposalItem();
}

function createServiceSelect() {
  const select = document.createElement("select");
  select.className = "proposal-service";
  select.setAttribute("aria-label", "Serviço");
  select.required = true;
  select.add(new Option("Selecione um serviço", ""));
  for (const service of services) select.add(new Option(service.name, service.id));
  select.addEventListener("change", () => {
    const service = services.find((item) => String(item.id) === select.value);
    const row = select.closest(".proposal-item-row");
    const price = row.querySelector(".proposal-unit-price");
    price.value = service?.referencePrice || "0.00";
    updateProposalTotal();
  });
  return select;
}

function addProposalItem() {
  const row = document.createElement("div");
  row.className = "proposal-item-row";
  const service = createServiceSelect();
  const quantity = document.createElement("input");
  quantity.type = "number";
  quantity.min = "1";
  quantity.max = "1000";
  quantity.step = "1";
  quantity.value = "1";
  quantity.placeholder = "Quantidade";
  quantity.className = "proposal-quantity";
  quantity.setAttribute("aria-label", "Quantidade");
  const price = document.createElement("input");
  price.type = "number";
  price.min = "0";
  price.max = "99999999.99";
  price.step = "0.01";
  price.value = "0.00";
  price.placeholder = "Valor unitário (R$)";
  price.className = "proposal-unit-price";
  price.setAttribute("aria-label", "Valor unitário em reais");
  quantity.addEventListener("input", updateProposalTotal);
  price.addEventListener("input", updateProposalTotal);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "Remover";
  remove.setAttribute("aria-label", "Remover serviço da proposta");
  remove.addEventListener("click", () => {
    row.remove();
    updateProposalTotal();
  });
  row.append(service, quantity, price, remove);
  itemList.append(row);
  updateProposalTotal();
}

function updateProposalTotal() {
  const total = [...itemList.querySelectorAll(".proposal-item-row")].reduce((sum, row) => {
    const quantity = Number(row.querySelector(".proposal-quantity").value || 0);
    const unitPrice = Number(row.querySelector(".proposal-unit-price").value || 0);
    return sum + quantity * unitPrice;
  }, 0);
  totalLabel.textContent = "Total: " + formatMoney(total);
}

async function loadProposals() {
  proposalListMessage.textContent = "Carregando propostas...";
  proposalList.replaceChildren();
  try {
    const response = await fetch("/api/proposals", { credentials: "same-origin" });
    if (response.status === 401) {
      window.location.assign("/");
      return;
    }
    if (!response.ok) throw new Error("list_failed");
    const { proposals } = await response.json();
    for (const proposal of proposals) {
      const row = document.createElement("tr");
      addProposalCell(row, proposal.customerName);
      addProposalCell(row, proposal.title);
      addProposalCell(row, proposal.validUntil || "Sem prazo");
      addProposalCell(row, proposal.status === "draft" ? "Rascunho" : proposal.status);
      addProposalCell(row, formatMoney(proposal.total));
      proposalList.append(row);
    }
    proposalListMessage.textContent = proposals.length ? "" : "Nenhuma proposta cadastrada.";
  } catch (_error) {
    proposalListMessage.textContent = "Não foi possível carregar as propostas.";
    proposalListMessage.dataset.state = "error";
  }
}

addItemButton.addEventListener("click", addProposalItem);

proposalForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  proposalMessage.textContent = "";
  const button = proposalForm.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const items = [...itemList.querySelectorAll(".proposal-item-row")].map((row) => ({
      serviceId: row.querySelector(".proposal-service").value,
      quantity: row.querySelector(".proposal-quantity").value,
      unitPrice: row.querySelector(".proposal-unit-price").value
    }));
    const proposal = Object.fromEntries(
      ["customerId", "title", "validUntil", "notes"]
        .map((name) => [name, proposalForm.elements[name].value])
    );
    proposal.items = items;
    const response = await fetch("/api/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(proposal)
    });
    if (response.status === 401) {
      window.location.assign("/");
      return;
    }
    if (response.status === 400) {
      proposalMessage.textContent = "Revise cliente, serviços, quantidades, valores e validade.";
      return;
    }
    if (!response.ok) throw new Error("create_failed");

    proposalForm.reset();
    itemList.replaceChildren();
    addProposalItem();
    updateProposalTotal();
    proposalMessage.textContent = "Proposta salva como rascunho.";
    await loadProposals();
  } catch (_error) {
    proposalMessage.textContent = "Não foi possível salvar a proposta.";
  } finally {
    button.disabled = false;
  }
});

Promise.all([loadProposalOptions(), loadProposals()]).catch(() => {
  proposalMessage.textContent = "Não foi possível carregar clientes e serviços.";
});
