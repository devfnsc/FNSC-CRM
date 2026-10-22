const customerForm = document.querySelector("#customer-form");
const customerIdField = document.querySelector("#customer-id");
const saveCustomerButton = document.querySelector("#save-customer");
const cancelEditButton = document.querySelector("#cancel-customer-edit");
const editCustomerButton = document.querySelector("#edit-customer");
const archiveCustomerButton = document.querySelector("#archive-customer");
const restoreCustomerButton = document.querySelector("#restore-customer");
const customerMessage = document.querySelector("#customer-message");
const searchForm = document.querySelector("#customer-search-form");
const searchInput = document.querySelector("#customer-search");
const statusInput = document.querySelector("#customer-status");
const customerList = document.querySelector("#customer-list");
const listMessage = document.querySelector("#customer-list-message");
const previousButton = document.querySelector("#previous-customers");
const nextButton = document.querySelector("#next-customers");
const pageLabel = document.querySelector("#customer-page");
const detailsPanel = document.querySelector("#customer-details");
const detailFields = document.querySelector("#customer-detail-fields");

let currentPage = 1;
let hasMore = false;
let selectedCustomer = null;
let editingCustomerId = null;

function setListMessage(text, isError = false) {
  listMessage.textContent = text;
  listMessage.dataset.state = isError ? "error" : "success";
}

function addCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value || "—";
  row.append(cell);
}

async function loadCustomers() {
  setListMessage("Carregando clientes...");
  customerList.replaceChildren();
  try {
    const params = new URLSearchParams({ page: String(currentPage), limit: "20" });
    if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
    params.set("status", statusInput.value);
    const response = await fetch("/api/customers?" + params.toString(), {
      credentials: "same-origin"
    });
    if (response.status === 401) {
      window.location.assign("/");
      return;
    }
    if (!response.ok) throw new Error("list_failed");

    const result = await response.json();
    hasMore = result.hasMore;
    for (const customer of result.customers) {
      const row = document.createElement("tr");
      addCell(row, customer.name);
      addCell(row, customer.companyName);
      addCell(row, customer.email);
      addCell(row, customer.phone);

      const actionCell = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Ver detalhes";
      button.addEventListener("click", () => loadCustomerDetails(customer.id));
      actionCell.append(button);
      row.append(actionCell);
      customerList.append(row);
    }

    pageLabel.textContent = "Página " + result.page;
    previousButton.disabled = currentPage <= 1;
    nextButton.disabled = !hasMore;
    setListMessage(result.customers.length ? "" : "Nenhum cliente encontrado.");
  } catch (_error) {
    setListMessage("Não foi possível carregar os clientes. Tente novamente.", true);
    previousButton.disabled = currentPage <= 1;
    nextButton.disabled = true;
  }
}

async function loadCustomerDetails(customerId) {
  detailsPanel.hidden = true;
  detailFields.replaceChildren();
  try {
    const response = await fetch("/api/customers/" + encodeURIComponent(customerId), {
      credentials: "same-origin"
    });
    if (response.status === 401) {
      window.location.assign("/");
      return;
    }
    if (response.status === 404) throw new Error("not_found");
    if (!response.ok) throw new Error("details_failed");

    const { customer } = await response.json();
    const fields = [
      ["Nome", customer.name],
      ["Empresa", customer.companyName],
      ["E-mail", customer.email],
      ["Telefone", customer.phone],
      ["Observações", customer.notes],
      ["Criado em", customer.createdAt],
      ["Atualizado em", customer.updatedAt],
      ["Situação", customer.archivedAt ? "Arquivado" : "Ativo"]
    ];
    for (const [label, value] of fields) {
      const term = document.createElement("dt");
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = value || "—";
      detailFields.append(term, description);
    }
    selectedCustomer = customer;
    editCustomerButton.disabled = Boolean(customer.archivedAt);
    archiveCustomerButton.hidden = Boolean(customer.archivedAt);
    restoreCustomerButton.hidden = !customer.archivedAt;
    detailsPanel.hidden = false;
    window.dispatchEvent(new CustomEvent("customer:opened", { detail: customer }));
    detailsPanel.scrollIntoView({ block: "nearest", behavior: "smooth" });
  } catch (_error) {
    setListMessage("Não foi possível abrir os detalhes deste cliente.", true);
  }
}

customerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  customerMessage.textContent = "";
  const button = customerForm.querySelector("button[type=submit]");
  button.disabled = true;

  try {
    const customer = Object.fromEntries(
      ["name", "companyName", "email", "phone", "notes"]
        .map((name) => [name, customerForm.elements[name].value])
    );
    if (!customer.email.trim() && !customer.phone.trim()) {
      customerMessage.textContent = "Informe um e-mail ou telefone para contato.";
      return;
    }

    const isEditing = Boolean(editingCustomerId);
    const response = await fetch(
      isEditing ? "/api/customers/" + encodeURIComponent(editingCustomerId) : "/api/customers",
      {
      method: isEditing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(customer)
    });
    if (response.status === 401) {
      window.location.assign("/");
      return;
    }
    if (response.status === 400) {
      customerMessage.textContent = "Confira o nome, e-mail, telefone e observações.";
      return;
    }
    if (response.status === 404) {
      customerMessage.textContent = "Este cliente não foi encontrado.";
      return;
    }
    if (!response.ok) throw new Error("save_failed");

    const result = await response.json();
    const savedCustomerId = result.customer.id;
    customerMessage.textContent = isEditing ? "Cadastro atualizado." : "Cliente cadastrado.";
    customerForm.reset();
    editingCustomerId = null;
    customerIdField.value = "";
    saveCustomerButton.textContent = "Cadastrar cliente";
    cancelEditButton.hidden = true;
    currentPage = 1;
    await loadCustomers();
    await loadCustomerDetails(savedCustomerId);
  } catch (_error) {
    customerMessage.textContent = "Não foi possível cadastrar. Tente novamente.";
  } finally {
    button.disabled = false;
  }
});

async function changeCustomerArchive(action) {
  if (!selectedCustomer) return;
  const isArchiving = action === "archive";
  const prompt = isArchiving
    ? "Arquivar este cliente? Ele poderá ser restaurado depois."
    : "Restaurar este cliente para a lista de ativos?";
  if (!window.confirm(prompt)) return;

  archiveCustomerButton.disabled = true;
  restoreCustomerButton.disabled = true;
  try {
    const response = await fetch("/api/customers/" + encodeURIComponent(selectedCustomer.id) + "/" + action, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: "{}"
    });
    if (response.status === 401) {
      window.location.assign("/");
      return;
    }
    if (response.status === 404) throw new Error("not_found");
    if (!response.ok) throw new Error("archive_failed");
    const { customer } = await response.json();
    customerMessage.textContent = isArchiving ? "Cliente arquivado." : "Cliente restaurado.";
    await loadCustomers();
    await loadCustomerDetails(customer.id);
  } catch (_error) {
    setListMessage("Não foi possível alterar a situação do cliente.", true);
  } finally {
    archiveCustomerButton.disabled = false;
    restoreCustomerButton.disabled = false;
  }
}

archiveCustomerButton.addEventListener("click", () => changeCustomerArchive("archive"));
restoreCustomerButton.addEventListener("click", () => changeCustomerArchive("restore"));

editCustomerButton.addEventListener("click", () => {
  if (!selectedCustomer) return;
  editingCustomerId = selectedCustomer.id;
  customerIdField.value = selectedCustomer.id;
  for (const field of ["name", "companyName", "email", "phone", "notes"]) {
    customerForm.elements[field].value = selectedCustomer[field] || "";
  }
  saveCustomerButton.textContent = "Salvar alterações";
  cancelEditButton.hidden = false;
  customerMessage.textContent = "Editando o cadastro selecionado.";
  customerForm.scrollIntoView({ block: "start", behavior: "smooth" });
  customerForm.elements.name.focus();
});

cancelEditButton.addEventListener("click", () => {
  editingCustomerId = null;
  customerIdField.value = "";
  customerForm.reset();
  saveCustomerButton.textContent = "Cadastrar cliente";
  cancelEditButton.hidden = true;
  customerMessage.textContent = "Edição cancelada.";
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  currentPage = 1;
  detailsPanel.hidden = true;
  loadCustomers();
});

previousButton.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage -= 1;
    detailsPanel.hidden = true;
    loadCustomers();
  }
});

nextButton.addEventListener("click", () => {
  if (hasMore) {
    currentPage += 1;
    detailsPanel.hidden = true;
    loadCustomers();
  }
});

loadCustomers();
