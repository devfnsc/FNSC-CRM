const customerForm = document.querySelector("#customer-form");
const customerMessage = document.querySelector("#customer-message");
const searchForm = document.querySelector("#customer-search-form");
const searchInput = document.querySelector("#customer-search");
const customerList = document.querySelector("#customer-list");
const listMessage = document.querySelector("#customer-list-message");
const previousButton = document.querySelector("#previous-customers");
const nextButton = document.querySelector("#next-customers");
const pageLabel = document.querySelector("#customer-page");
const detailsPanel = document.querySelector("#customer-details");
const detailFields = document.querySelector("#customer-detail-fields");

let currentPage = 1;
let hasMore = false;

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
      ["Atualizado em", customer.updatedAt]
    ];
    for (const [label, value] of fields) {
      const term = document.createElement("dt");
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = value || "—";
      detailFields.append(term, description);
    }
    detailsPanel.hidden = false;
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

    const response = await fetch("/api/customers", {
      method: "POST",
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
    if (!response.ok) throw new Error("create_failed");

    customerMessage.textContent = "Cliente cadastrado.";
    customerForm.reset();
    currentPage = 1;
    await loadCustomers();
  } catch (_error) {
    customerMessage.textContent = "Não foi possível cadastrar. Tente novamente.";
  } finally {
    button.disabled = false;
  }
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
