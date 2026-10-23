const onboardingLabels = {
  pending: "A fazer",
  in_progress: "Em andamento",
  done: "Concluída"
};

function onboardingText(parent, tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text || "—";
  if (className) node.className = className;
  parent.append(node);
  return node;
}

async function loadOnboardingTasks(contract, section, list, message, form) {
  message.textContent = "Carregando tarefas...";
  list.replaceChildren();
  try {
    const response = await fetch("/api/onboarding/contracts/" + encodeURIComponent(contract.id) + "/tasks", {
      credentials: "same-origin"
    });
    if (response.status === 401) return window.location.assign("/");
    if (!response.ok) throw new Error("tasks_load_failed");
    const { tasks } = await response.json();
    message.textContent = tasks.length ? "" : "Ainda não há tarefas de onboarding para este contrato.";
    for (const status of ["pending", "in_progress", "done"]) {
      const column = document.createElement("section");
      column.className = "onboarding-column";
      onboardingText(column, "h5", onboardingLabels[status]);
      const group = document.createElement("div");
      group.className = "onboarding-task-list";
      const matches = tasks.filter((task) => task.status === status);
      if (!matches.length) onboardingText(group, "p", "Nenhuma tarefa.");
      for (const task of matches) {
        const card = document.createElement("article");
        card.className = "onboarding-task";
        onboardingText(card, "h6", task.title);
        if (task.details) onboardingText(card, "p", task.details);
        onboardingText(card, "p", "Prazo: " + (task.dueDate
          ? new Date(task.dueDate).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "não definido"));
        const controls = document.createElement("div");
        controls.className = "form-actions";
        const statusSelect = document.createElement("select");
        statusSelect.setAttribute("aria-label", "Status da tarefa " + task.title);
        for (const value of ["pending", "in_progress", "done"]) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = onboardingLabels[value];
          option.selected = value === task.status;
          statusSelect.append(option);
        }
        statusSelect.addEventListener("change", () => saveTaskStatus(task, statusSelect.value, contract, section, list, message, form));
        const edit = document.createElement("button");
        edit.type = "button";
        edit.textContent = "Editar";
        edit.addEventListener("click", () => {
          form.elements.id.value = task.id;
          form.elements.title.value = task.title;
          form.elements.details.value = task.details || "";
          form.elements.dueDate.value = task.dueDate ? String(task.dueDate).slice(0, 10) : "";
          form.elements.status.value = task.status;
          form.querySelector("button[type=submit]").textContent = "Salvar tarefa";
          form.querySelector("[data-cancel-task]").hidden = false;
          form.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        controls.append(statusSelect, edit);
        card.append(controls);
        group.append(card);
      }
      column.append(group);
      section.querySelector(".onboarding-board").append(column);
    }
  } catch (_error) {
    message.textContent = "Não foi possível carregar as tarefas de onboarding.";
    message.dataset.state = "error";
  }
}

async function saveTaskStatus(task, status, contract, section, list, message, form) {
  try {
    const response = await fetch("/api/onboarding/tasks/" + encodeURIComponent(task.id), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ title: task.title, details: task.details || "", dueDate: task.dueDate
        ? String(task.dueDate).slice(0, 10) : "", status })
    });
    if (response.status === 401) return window.location.assign("/");
    if (!response.ok) throw new Error("task_status_failed");
    await loadOnboardingTasks(contract, section, list, message, form);
  } catch (_error) {
    message.textContent = "Não foi possível atualizar o status da tarefa.";
    message.dataset.state = "error";
  }
}

window.addEventListener("contract:opened", async (event) => {
  const contract = event.detail;
  const host = document.querySelector("#contract-details-content");
  if (!host) return;
  const section = document.createElement("section");
  section.className = "onboarding-section";
  onboardingText(section, "h5", "Onboarding do cliente");
  if (contract.status !== "signed") {
    onboardingText(section, "p", "O checklist fica disponível após registrar este contrato como assinado.");
    host.append(section);
    return;
  }
  onboardingText(section, "p", "Acompanhe as próximas etapas do atendimento. Este checklist é manual.");
  const form = document.createElement("form");
  form.className = "onboarding-form";
  form.innerHTML = "<input name='id' type='hidden'>" +
    "<label>Tarefa<input name='title' maxlength='160' required></label>" +
    "<label>Detalhes<textarea name='details' maxlength='2000' rows='2'></textarea></label>" +
    "<label>Prazo<input name='dueDate' type='date'></label>" +
    "<input name='status' type='hidden' value='pending'>" +
    "<div class='form-actions'><button type='submit'>Adicionar tarefa</button>" +
    "<button type='button' data-cancel-task hidden>Cancelar edição</button></div>";
  const message = document.createElement("p");
  message.setAttribute("role", "status");
  const list = document.createElement("div");
  list.className = "onboarding-board";
  section.append(form, message, list);
  host.append(section);

  form.querySelector("[data-cancel-task]").addEventListener("click", () => {
    form.reset();
    form.elements.id.value = "";
    form.elements.status.value = "pending";
    form.querySelector("button[type=submit]").textContent = "Adicionar tarefa";
    form.querySelector("[data-cancel-task]").hidden = true;
  });
  form.addEventListener("submit", async (submitEvent) => {
    submitEvent.preventDefault();
    const id = form.elements.id.value;
    const payload = Object.fromEntries(["title", "details", "dueDate", "status"]
      .map((name) => [name, form.elements[name].value]));
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const response = await fetch("/api/onboarding/" +
        (id ? "tasks/" + encodeURIComponent(id) : "contracts/" + encodeURIComponent(contract.id) + "/tasks"), {
        method: id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });
      if (response.status === 401) return window.location.assign("/");
      if (response.status === 400) throw new Error("invalid_task");
      if (!response.ok) throw new Error("task_save_failed");
      form.reset();
      form.elements.id.value = "";
      form.elements.status.value = "pending";
      button.textContent = "Adicionar tarefa";
      form.querySelector("[data-cancel-task]").hidden = true;
      await loadOnboardingTasks(contract, section, list, message, form);
      message.textContent = "Tarefa salva.";
      message.dataset.state = "success";
    } catch (_error) {
      message.textContent = "Revise a tarefa e tente novamente.";
      message.dataset.state = "error";
    } finally {
      button.disabled = false;
    }
  });
  await loadOnboardingTasks(contract, section, list, message, form);
});
