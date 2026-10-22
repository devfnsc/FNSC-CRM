const customerForm = document.querySelector("#customer-form");
const customerMessage = document.querySelector("#customer-message");

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

    const result = await response.json();
    customerMessage.textContent = "Cliente cadastrado com o número " + result.customer.id + ".";
    customerForm.reset();
  } catch (_error) {
    customerMessage.textContent = "Não foi possível cadastrar. Tente novamente.";
  } finally {
    button.disabled = false;
  }
});
