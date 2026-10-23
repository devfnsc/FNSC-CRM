const form = document.querySelector("#company-form");
const message = document.querySelector("#company-message");

function showMessage(text, isError = false) {
  message.textContent = text;
  message.dataset.state = isError ? "error" : "success";
}

function displayProfile(profile) {
  if (!profile) return;
  for (const field of ["businessName", "tradeName", "contactEmail", "phone", "website", "timezone"]) {
    form.elements[field].value = profile[field] || "";
  }
}

async function loadProfile() {
  try {
    const response = await fetch("/api/company", { credentials: "same-origin" });
    if (response.status === 401) {
      window.location.assign("/");
      return;
    }
    if (!response.ok) throw new Error("load_failed");
    const result = await response.json();
    displayProfile(result.profile);
  } catch (_error) {
    showMessage("Não foi possível carregar o perfil da empresa.", true);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showMessage("");
  const button = form.querySelector("button[type=submit]");
  button.disabled = true;
  try {
    const profile = Object.fromEntries(
      ["businessName", "tradeName", "contactEmail", "phone", "website", "timezone"]
        .map((name) => [name, form.elements[name].value])
    );
    const response = await fetch("/api/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(profile)
    });
    if (response.status === 401) {
      window.location.assign("/");
      return;
    }
    if (response.status === 400) {
      showMessage("Revise os campos. Nome, e-mail, site ou fuso horário inválido.", true);
      return;
    }
    if (!response.ok) throw new Error("save_failed");
    const result = await response.json();
    displayProfile(result.profile);
    showMessage("Perfil salvo.");
  } catch (_error) {
    showMessage("Não foi possível salvar. Tente novamente.", true);
  } finally {
    button.disabled = false;
  }
});

loadProfile();