const form = document.querySelector("#login-form");
const message = document.querySelector("#message");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.textContent = "";

  const button = form.querySelector("button");
  button.disabled = true;
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        email: form.elements.email.value,
        password: form.elements.password.value
      })
    });
    if (!response.ok) {
      message.textContent = response.status === 429
        ? "Muitas tentativas. Aguarde alguns minutos."
        : "Não foi possível entrar. Confira seus dados.";
      return;
    }
    window.location.assign("/app");
  } catch (_error) {
    message.textContent = "Falha de conexão. Tente novamente.";
  } finally {
    button.disabled = false;
  }
});