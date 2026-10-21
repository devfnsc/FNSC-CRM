const message = document.querySelector("#message");
document.querySelector("#logout").addEventListener("click", async () => {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin"
  });
  if (response.ok) window.location.assign("/");
  else message.textContent = "Não foi possível encerrar a sessão.";
});