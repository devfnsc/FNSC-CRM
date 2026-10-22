const serviceForm = document.querySelector("#service-form");
const serviceMessage = document.querySelector("#service-message");
const serviceList = document.querySelector("#service-list");
const serviceListMessage = document.querySelector("#service-list-message");

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
      serviceList.append(row);
    }
    serviceListMessage.textContent = services.length ? "" : "Nenhum serviço cadastrado.";
  } catch (_error) {
    serviceListMessage.textContent = "Não foi possível carregar o catálogo.";
    serviceListMessage.dataset.state = "error";
  }
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
    const response = await fetch("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(service)
    });
    if (response.status === 401) {
      window.location.assign("/");
      return;
    }
    if (response.status === 400) {
      serviceMessage.textContent = "Confira o nome e o valor. Use até duas casas decimais.";
      return;
    }
    if (!response.ok) throw new Error("create_failed");
    serviceForm.reset();
    serviceMessage.textContent = "Serviço cadastrado.";
    await loadServices();
  } catch (_error) {
    serviceMessage.textContent = "Não foi possível cadastrar o serviço.";
  } finally {
    button.disabled = false;
  }
});

loadServices();
