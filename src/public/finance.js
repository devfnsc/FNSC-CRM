const financeForm = document.querySelector("#finance-form");
const financeMonth = document.querySelector("#finance-month");
const financeList = document.querySelector("#finance-list");
const financeMessage = document.querySelector("#finance-message");

function financeMoney(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

function localDateValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function financeCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value || "—";
  row.append(cell);
}

function resetFinanceForm() {
  financeForm.reset();
  financeForm.elements.id.value = "";
  financeForm.elements.occurredOn.value = localDateValue();
  document.querySelector("#save-finance").textContent = "Registrar lançamento";
  document.querySelector("#cancel-finance-edit").hidden = true;
}

async function loadFinance() {
  financeList.replaceChildren();
  financeMessage.textContent = "Carregando lançamentos...";
  try {
    const response = await fetch("/api/finance?month=" + encodeURIComponent(financeMonth.value), {
      credentials: "same-origin"
    });
    if (response.status === 401) return window.location.assign("/");
    if (!response.ok) throw new Error("finance_load_failed");
    const data = await response.json();
    document.querySelector("#finance-income").textContent = financeMoney(data.summary.income);
    document.querySelector("#finance-expenses").textContent = financeMoney(data.summary.expenses);
    document.querySelector("#finance-balance").textContent = financeMoney(data.summary.balance);
    for (const item of data.transactions) {
      const row = document.createElement("tr");
      financeCell(row, item.occurredOn ? new Date(item.occurredOn).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—");
      financeCell(row, item.type === "income" ? "Entrada" : "Saída");
      financeCell(row, item.description);
      financeCell(row, item.category);
      financeCell(row, financeMoney(item.amount));
      const actions = document.createElement("td");
      const edit = document.createElement("button");
      edit.type = "button";
      edit.textContent = "Editar";
      edit.addEventListener("click", () => {
        financeForm.elements.id.value = item.id;
        financeForm.elements.type.value = item.type;
        financeForm.elements.description.value = item.description;
        financeForm.elements.category.value = item.category;
        financeForm.elements.amount.value = item.amount;
        financeForm.elements.occurredOn.value = item.occurredOn ? String(item.occurredOn).slice(0, 10) : "";
        financeForm.elements.notes.value = item.notes || "";
        document.querySelector("#save-finance").textContent = "Salvar alterações";
        document.querySelector("#cancel-finance-edit").hidden = false;
        financeForm.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      actions.append(edit);
      row.append(actions);
      financeList.append(row);
    }
    if (!data.transactions.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.textContent = "Nenhum lançamento neste mês.";
      row.append(cell);
      financeList.append(row);
    }
    financeMessage.textContent = data.transactions.length === data.limit
      ? "Exibindo até 500 lançamentos. Os totais incluem todos os registros do mês."
      : "";
  } catch (_error) {
    financeMessage.textContent = "Não foi possível carregar o controle financeiro.";
    financeMessage.dataset.state = "error";
  }
}

financeMonth.value = localDateValue().slice(0, 7);
financeForm.elements.occurredOn.value = localDateValue();
financeMonth.addEventListener("change", loadFinance);
document.querySelector("#cancel-finance-edit").addEventListener("click", resetFinanceForm);
financeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.querySelector("#save-finance");
  button.disabled = true;
  financeMessage.textContent = "";
  try {
    const id = financeForm.elements.id.value;
    const body = Object.fromEntries(["type", "description", "category", "amount", "occurredOn", "notes"]
      .map((name) => [name, financeForm.elements[name].value]));
    const response = await fetch("/api/finance" + (id ? "/" + encodeURIComponent(id) : ""), {
      method: id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    if (response.status === 401) return window.location.assign("/");
    if (response.status === 400) {
      financeMessage.textContent = "Revise tipo, descrição, categoria, valor e data.";
      financeMessage.dataset.state = "error";
      return;
    }
    if (!response.ok) throw new Error("finance_save_failed");
    financeMonth.value = body.occurredOn.slice(0, 7);
    resetFinanceForm();
    await loadFinance();
    financeMessage.textContent = "Lançamento salvo.";
    financeMessage.dataset.state = "success";
  } catch (_error) {
    financeMessage.textContent = "Não foi possível salvar o lançamento.";
    financeMessage.dataset.state = "error";
  } finally {
    button.disabled = false;
  }
});
loadFinance();
