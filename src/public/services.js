const serviceForm = document.querySelector("#service-form");
const serviceIdField = document.querySelector("#service-id");
const saveServiceButton = document.querySelector("#save-service");
const cancelServiceEditButton = document.querySelector("#cancel-service-edit");
const serviceMessage = document.querySelector("#service-message");
const serviceList = document.querySelector("#service-list");
const serviceListMessage = document.querySelector("#service-list-message");

let editingServiceId = null;

function serviceCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value || "—";
  row.append(cell);
}

function formatPrice(value) {
  if (value === null || value === undefined || value === "") return "Sob consulta";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number(value));
}

async function loadServices() {
  serviceListMessage.textContent = "Carregando catálogo...";
  serviceList.replaceChildren();
  try {
    const response = await fetch("/api/services", { credentials: "same-origin" });
    if (response.status === 401) {
      window.location.assign("/");
      return;
    }
    if (!response.ok) throw new Error("list_failed");
    const { services } = await response.json();
    for (const service of services) {
      const row = document.createElement("tr");
      serviceCell(row, service.name);
      serviceCell(row, service.description);
      serviceCell(row, formatPrice(service.referencePrice));
      const actionCell = document.createElement("td");
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.textContent = "Editar";
      editButton.addEventListener("click", () => beginServiceEdit(service));
      actionCell.append(editButton);
      row.append(actionCell);
      serviceList.append(row);
    }
    serviceListMessage.textContent = services.length ? "" : "Nenhum serviço cadastrado.";
  } catch (_error) {
    serviceListMessage.textContent = "Não foi possível carregar o catálogo.";
    serviceListMessage.dataset.state = "error";
  }
}

function beginServiceEdit(service) {
  editingServiceId = service.id;
  serviceIdField.value = service.id;
  serviceForm.elements.name.value = service.name;
  serviceForm.elements.description.value = service.description || "";
  serviceForm.elements.referencePrice.value = service.referencePrice || "";
  saveServiceButton.textContent = "Salvar alterações";
  cancelServiceEditButton.hidden = false;
  serviceMessage.textContent = "Editando o serviço selecionado.";
  serviceForm.scrollIntoView({ block: "start", behavior: "smooth" });
  serviceForm.elements.name.focus();
}

function cancelServiceEdit() {
  editingServiceId = null;
  serviceIdField.value = "";
  serviceForm.reset();
  saveServiceButton.textContent = "Cadastrar serviço";
  cancelServiceEditButton.hidden = true;
  serviceMessage.textContent = "Edição cancelada.";
}

serviceForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  serviceMessage.textContent = "";
  const button = serviceForm.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const service = Object.fromEntries(
      ["name", "description", "referencePrice"]
        .map((name) => [name, serviceForm.elements[name].value])
    );
    const isEditing = Boolean(editingServiceId);
    const response = await fetch(
      isEditing ? "/api/services/" + encodeURIComponent(editingServiceId) : "/api/services",
      {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(service)
      }
    );
    if (response.status === 401) {
      window.location.assign("/");
      return;
    }
    if (response.status === 400) {
      serviceMessage.textContent = "Confira o nome e o valor. Use até duas casas decimais.";
      return;
    }
    if (response.status === 404) {
      serviceMessage.textContent = "Este serviço não foi encontrado.";
      return;
    }
    if (!response.ok) throw new Error("save_failed");

    const { service: savedService } = await response.json();
    window.dispatchEvent(new CustomEvent("service:changed", { detail: savedService }));
    serviceForm.reset();
    editingServiceId = null;
    serviceIdField.value = "";
    saveServiceButton.textContent = "Cadastrar serviço";
    cancelServiceEditButton.hidden = true;
    serviceMessage.textContent = isEditing ? "Serviço atualizado." : "Serviço cadastrado.";
    await loadServices();
  } catch (_error) {
    serviceMessage.textContent = "Não foi possível salvar o serviço.";
  } finally {
    button.disabled = false;
  }
});

cancelServiceEditButton.addEventListener("click", cancelServiceEdit);
loadServices();
