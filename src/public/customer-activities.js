const activityTypeNames = {
  call: "Ligação",
  email: "E-mail",
  meeting: "Reunião",
  message: "Mensagem",
  other: "Outro"
};

function activityText(parent, tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value || "—";
  if (className) node.className = className;
  parent.append(node);
  return node;
}

function activityDate(value) {
  return value ? new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
}

async function loadCustomerActivities(customer, list, message) {
  message.textContent = "Carregando histórico...";
  list.replaceChildren();
  try {
    const response = await fetch("/api/customer-activities/customers/" +
      encodeURIComponent(customer.id) + "/activities", { credentials: "same-origin" });
    if (response.status === 401) return window.location.assign("/");
    if (!response.ok) throw new Error("activities_load_failed");
    const data = await response.json();
    for (const activity of data.activities) {
      const item = document.createElement("article");
      item.className = "customer-activity";
      const heading = activityTypeNames[activity.type] || activity.type;
      const author = activity.createdByEmail ? " · " + activity.createdByEmail : "";
      activityText(item, "h5", heading + " · " + activityDate(activity.occurredOn) + author);
      activityText(item, "p", activity.summary);
      if (activity.followUpDate) {
        const complete = activity.followUpStatus === "completed";
        const completedBy = activity.followUpCompletedByEmail ? " por " + activity.followUpCompletedByEmail : "";
        activityText(item, "p", "Próximo acompanhamento: " + activityDate(activity.followUpDate) +
          (complete ? " · Concluído" + completedBy : " · Pendente"));
        if (!complete) {
          const button = document.createElement("button");
          button.type = "button";
          button.textContent = "Marcar acompanhamento como concluído";
          button.addEventListener("click", async () => {
            button.disabled = true;
            try {
              const update = await fetch("/api/customer-activities/activities/" +
                encodeURIComponent(activity.id) + "/follow-up", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ status: "completed" })
              });
              if (update.status === 401) return window.location.assign("/");
              if (!update.ok) throw new Error("follow_up_failed");
              await loadCustomerActivities(customer, list, message);
            } catch (_error) {
              message.textContent = "Não foi possível atualizar o acompanhamento.";
              message.dataset.state = "error";
              button.disabled = false;
            }
          });
          item.append(button);
        }
      }
      if (activity.createdAt) activityText(item, "small", "Registrado em " + new Date(activity.createdAt).toLocaleString("pt-BR"));
      list.append(item);
    }
    message.textContent = data.activities.length
      ? (data.activities.length === data.limit ? "Exibindo as 300 interações mais recentes." : "")
      : "Ainda não há interações registradas.";
  } catch (_error) {
    message.textContent = "Não foi possível carregar o histórico de interações.";
    message.dataset.state = "error";
  }
}

window.addEventListener("customer:opened", async (event) => {
  const customer = event.detail;
  const panel = document.querySelector("#customer-details");
  if (!panel) return;
  panel.querySelector(".customer-activity-section")?.remove();
  const section = document.createElement("section");
  section.className = "customer-activity-section";
  activityText(section, "h4", "Histórico de interações");
  activityText(section, "p", "Registre contatos e próximos acompanhamentos para manter o contexto do atendimento.");
  const list = document.createElement("div");
  list.className = "customer-activity-list";
  const message = document.createElement("p");
  message.setAttribute("role", "status");
  panel.append(section);
  if (!customer.archivedAt) {
    const form = document.createElement("form");
    form.className = "customer-activity-form";
    form.innerHTML = "<label>Tipo de contato<select name='type' required>" +
      "<option value='meeting'>Reunião</option><option value='call'>Ligação</option>" +
      "<option value='email'>E-mail</option><option value='message'>Mensagem</option><option value='other'>Outro</option></select></label>" +
      "<label>Data do contato<input name='occurredOn' type='date' required></label>" +
      "<label>Resumo<textarea name='summary' maxlength='2000' rows='3' required></textarea></label>" +
      "<label>Próximo acompanhamento (opcional)<input name='followUpDate' type='date'></label>" +
      "<button type='submit'>Registrar interação</button>";
    const occurred = form.elements.occurredOn;
    const now = new Date();
    occurred.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    form.addEventListener("submit", async (submitEvent) => {
      submitEvent.preventDefault();
      const button = form.querySelector("button[type=submit]");
      button.disabled = true;
      try {
        const payload = Object.fromEntries(["type", "summary", "occurredOn", "followUpDate"]
          .map((name) => [name, form.elements[name].value]));
        const response = await fetch("/api/customer-activities/customers/" +
          encodeURIComponent(customer.id) + "/activities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload)
        });
        if (response.status === 401) return window.location.assign("/");
        if (response.status === 400) throw new Error("invalid_activity");
        if (!response.ok) throw new Error("activity_save_failed");
        form.reset();
        const current = new Date();
        occurred.value = new Date(current.getTime() - current.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
        await loadCustomerActivities(customer, list, message);
        message.textContent = "Interação registrada.";
        message.dataset.state = "success";
      } catch (_error) {
        message.textContent = "Confira o tipo, o resumo e as datas do contato.";
        message.dataset.state = "error";
      } finally {
        button.disabled = false;
      }
    });
    section.append(form);
  } else {
    activityText(section, "p", "Cliente arquivado: histórico disponível apenas para consulta.");
  }
  section.append(message, list);
  await loadCustomerActivities(customer, list, message);
});
