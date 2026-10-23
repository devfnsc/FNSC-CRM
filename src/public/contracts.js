const contractForm = document.querySelector("#contract-form");
const contractList = document.querySelector("#contract-list");
const contractMessage = document.querySelector("#contract-message");
const contractDetails = document.querySelector("#contract-details");
const contractDetailsMessage = document.querySelector("#contract-details-message");
const contractDetailsContent = document.querySelector("#contract-details-content");
const cancelContractEdit = document.querySelector("#cancel-contract-edit");

function contractMoney(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function contractCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value || "—";
  row.append(cell);
}

function contractText(parent, tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value || "—";
  if (className) node.className = className;
  parent.append(node);
  return node;
}

async function loadContracts() {
  contractList.replaceChildren();
  try {
    const response = await fetch("/api/contracts", { credentials: "same-origin" });
    if (response.status === 401) return window.location.assign("/");
    if (!response.ok) throw new Error("list_failed");
    const { contracts } = await response.json();
    for (const contract of contracts) {
      const row = document.createElement("tr");
      contractCell(row, contract.customerName);
      contractCell(row, contract.title);
      contractCell(row, ({ draft: "Rascunho", signed: "Assinado (registrado manualmente)", cancelled: "Cancelado" }[contract.status] || contract.status));
      contractCell(row, contractMoney(contract.total));
      const action = document.createElement("td");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "Abrir";
      button.addEventListener("click", () => showContract(contract.id));
      action.append(button);
      row.append(action);
      contractList.append(row);
    }
    if (!contracts.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.textContent = "Nenhum contrato cadastrado.";
      row.append(cell);
      contractList.append(row);
    }
  } catch (_error) {
    contractMessage.textContent = "Não foi possível carregar os contratos.";
    contractMessage.dataset.state = "error";
  }
}

function fillContractForm(contract) {
  document.querySelector("#contract-id").value = String(contract.id);
  contractForm.elements.title.value = contract.title;
  contractForm.elements.effectiveDate.value = contract.effectiveDate || "";
  contractForm.elements.endDate.value = contract.endDate || "";
  contractForm.elements.paymentTerms.value = contract.paymentTerms || "";
  contractForm.elements.clauses.value = contract.clauses || "";
  contractForm.hidden = false;
  contractForm.scrollIntoView({ behavior: "smooth", block: "start" });
  contractForm.elements.title.focus({ preventScroll: true });
}

async function showContract(id, edit = false) {
  contractDetails.hidden = false;
  contractDetailsMessage.textContent = "Carregando contrato...";
  contractDetailsContent.replaceChildren();
  try {
    const response = await fetch("/api/contracts/" + encodeURIComponent(id), { credentials: "same-origin" });
    if (response.status === 401) return window.location.assign("/");
    if (response.status === 404) throw new Error("not_found");
    if (!response.ok) throw new Error("details_failed");
    const { contract } = await response.json();
    contractDetailsMessage.textContent = "";
    contractText(contractDetailsContent, "h4", contract.title);
    contractText(contractDetailsContent, "p",
      contract.customer.name + (contract.customer.companyName ? " — " + contract.customer.companyName : ""));
    contractText(contractDetailsContent, "p",
      "Status: " + ({ draft: "Rascunho", signed: "Assinado (registrado manualmente)", cancelled: "Cancelado" }[contract.status] || contract.status) +
      " · Proposta #" + contract.proposalId + " · Valor: " + contractMoney(contract.total));
    const statusHistory = document.createElement("section");
    contractText(statusHistory, "h5", "Histórico de status");
    for (const event of contract.statusHistory || []) {
      const when = event.createdAt ? new Date(event.createdAt).toLocaleString("pt-BR") : "data indisponível";
      const who = event.changedByEmail ? " · " + event.changedByEmail : "";
      const label = ({ draft: "Rascunho", signed: "Assinado (registro manual)", cancelled: "Cancelado" }[event.status] || event.status);
      contractText(statusHistory, "p", label + " · " + when + who);
    }
    contractDetailsContent.append(statusHistory);
    const table = document.createElement("table");
    table.className = "contract-items";
    table.innerHTML = "<thead><tr><th>Serviço</th><th>Qtd.</th><th>Unitário</th><th>Subtotal</th></tr></thead>";
    const body = document.createElement("tbody");
    for (const item of contract.items) {
      const row = document.createElement("tr");
      contractCell(row, item.serviceName);
      contractCell(row, item.quantity);
      contractCell(row, contractMoney(item.unitPrice));
      contractCell(row, contractMoney(item.lineTotal));
      body.append(row);
    }
    table.append(body);
    contractDetailsContent.append(table);
    if (contract.paymentTerms) contractText(contractDetailsContent, "p", "Pagamento: " + contract.paymentTerms);
    if (contract.clauses) contractText(contractDetailsContent, "pre", contract.clauses, "contract-clauses");
    const history = document.createElement("section");
    history.className = "contract-history";
    contractText(history, "h5", "Histórico de versões");
    for (const revision of contract.revisions || []) {
      const entry = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = "Versão " + revision.number + " · " +
        (revision.createdAt ? new Date(revision.createdAt).toLocaleString("pt-BR") : "data indisponível") +
        (revision.createdByEmail ? " · " + revision.createdByEmail : "");
      entry.append(summary);
      contractText(entry, "p", revision.title);
      contractText(entry, "p", "Vigência: " + (revision.effectiveDate || "a definir") + " até " + (revision.endDate || "a definir"));
      contractText(entry, "p", "Pagamento: " + (revision.paymentTerms || "não definido"));
      if (revision.clauses) contractText(entry, "pre", revision.clauses, "contract-clauses");
      history.append(entry);
    }
    contractDetailsContent.append(history);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Editar rascunho";
    editButton.disabled = contract.status !== "draft";
    editButton.addEventListener("click", () => fillContractForm(contract));
    contractDetailsContent.append(editButton);

    if (contract.status === "draft") {
      for (const [status, label] of [["signed", "Registrar como assinado"], ["cancelled", "Cancelar rascunho"]]) {
        const action = document.createElement("button");
        action.type = "button";
        action.textContent = label;
        action.addEventListener("click", () => updateContractStatus(contract.id, status));
        contractDetailsContent.append(action);
      }
      contractText(contractDetailsContent, "p", "O registro é manual e não substitui assinatura eletrônica ou validação jurídica.");
    }

    const print = document.createElement("a");
    print.href = "/api/contracts/" + encodeURIComponent(contract.id) + "/print";
    print.target = "_blank";
    print.rel = "noopener";
    print.textContent = "Imprimir / salvar como PDF";
    print.className = "proposal-print-link";
    contractDetailsContent.append(print);

    window.dispatchEvent(new CustomEvent("contract:opened", { detail: contract }));
    if (edit === true) fillContractForm(contract);
  } catch (_error) {
    contractDetailsMessage.textContent = "Não foi possível abrir o contrato.";
    contractDetailsMessage.dataset.state = "error";
  }
}

async function updateContractStatus(id, status) {
  const label = status === "signed" ? "assinado" : "cancelado";
  if (!window.confirm("Confirmar o registro do contrato como " + label + "? Esta ação não poderá ser desfeita.")) return;
  try {
    const response = await fetch("/api/contracts/" + encodeURIComponent(id) + "/status", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify({ status })
    });
    if (response.status === 401) return window.location.assign("/");
    if (response.status === 400) throw new Error("invalid_status");
    if (!response.ok) throw new Error("status_update_failed");
    await loadContracts();
    await showContract(id);
    contractMessage.textContent = status === "signed"
      ? "Contrato registrado como assinado manualmente." : "Rascunho do contrato cancelado.";
    contractMessage.dataset.state = "success";
  } catch (_error) {
    contractMessage.textContent = "Não foi possível atualizar o status do contrato.";
    contractMessage.dataset.state = "error";
  }
}

async function startContractFromProposal(proposalId) {
  contractMessage.textContent = "Criando rascunho do contrato...";
  try {
    const response = await fetch("/api/contracts/from-proposal/" + encodeURIComponent(proposalId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: "{}"
    });
    if (response.status === 401) return window.location.assign("/");
    const payload = await response.json();
    if (response.status === 409 && payload.contractId) {
      contractMessage.textContent = "Esta proposta já possui um contrato.";
      contractMessage.dataset.state = "error";
      await loadContracts();
      return;
    }
    if (response.status === 409) {
      contractMessage.textContent = "Somente uma proposta aceita pode gerar contrato.";
      contractMessage.dataset.state = "error";
      return;
    }
    if (!response.ok) throw new Error("create_failed");
    contractMessage.dataset.state = "success";
    contractMessage.textContent = "Contrato criado como rascunho. Revise os campos antes de compartilhar ou assinar.";
    await loadContracts();
    await showContract(payload.contract.id, true);
  } catch (_error) {
    contractMessage.textContent = "Não foi possível criar o contrato.";
    contractMessage.dataset.state = "error";
  }
}

window.startContractFromProposal = startContractFromProposal;

contractForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = contractForm.querySelector("#save-contract");
  button.disabled = true;
  contractMessage.textContent = "";
  try {
    const contract = Object.fromEntries(["title", "effectiveDate", "endDate", "paymentTerms", "clauses"]
      .map((name) => [name, contractForm.elements[name].value]));
    const id = document.querySelector("#contract-id").value;
    const response = await fetch("/api/contracts/" + encodeURIComponent(id), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(contract)
    });
    if (response.status === 401) return window.location.assign("/");
    if (response.status === 400) {
      contractMessage.textContent = "Revise o título, as datas e o tamanho dos campos.";
      contractMessage.dataset.state = "error";
      return;
    }
    if (!response.ok) throw new Error("update_failed");
    contractForm.hidden = true;
    contractForm.reset();
    await loadContracts();
    await showContract(id);
    contractMessage.textContent = "Rascunho do contrato salvo.";
    contractMessage.dataset.state = "success";
  } catch (_error) {
    contractMessage.textContent = "Não foi possível salvar o contrato.";
    contractMessage.dataset.state = "error";
  } finally {
    button.disabled = false;
  }
});

cancelContractEdit.addEventListener("click", () => {
  contractForm.reset();
  contractForm.hidden = true;
});

loadContracts();
