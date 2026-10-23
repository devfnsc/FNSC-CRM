const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const origin = process.env.APP_ORIGIN || "http://127.0.0.1:3000";
const email = process.env.CRM_DEMO_EMAIL || "demo@fnsc.local";
const password = process.env.CRM_DEMO_PASSWORD || "local-demo-password-123";
const runId = Date.now();
const customerName = "Browser QA " + runId;
const serviceName = "Consultoria QA " + runId;
const proposalTitle = "Proposta QA " + runId;
const contractTitle = "Contrato QA " + runId;
const taskTitle = "Boas-vindas QA " + runId;
const transactionDescription = "Receita QA " + runId;

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("dialog", (dialog) => dialog.accept());
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  try {
    await page.goto(origin, { waitUntil: "networkidle" });
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL("**/app");
    await page.getByRole("heading", { name: "Perfil da empresa" }).waitFor();

    await page.locator("#businessName").fill("FNSC QA " + runId);
    await page.locator("#company-form button[type=submit]").click();
    await page.getByText("Perfil salvo.").waitFor({ timeout: 10000 }).catch(async () => {
      await page.locator("#company-message").waitFor();
      assert.match(await page.locator("#company-message").innerText(), /salvo|atualizado/i);
    });

    await page.locator("#customer-name").fill(customerName);
    await page.locator("#customer-company").fill("Empresa QA");
    await page.locator("#customer-email").fill("qa-" + runId + "@example.test");
    await page.locator("#customer-form button[type=submit]").click();
    await page.locator("#customer-details").waitFor({ state: "visible" });
    await page.getByText(customerName, { exact: true }).first().waitFor();

    const activityForm = page.locator(".customer-activity-form");
    await activityForm.locator("[name=summary]").fill("Reunião inicial registrada pelo teste de navegador.");
    await activityForm.locator("[name=followUpDate]").fill("2026-10-30");
    await activityForm.getByRole("button", { name: "Registrar interação" }).click();
    await page.getByText("Reunião inicial registrada pelo teste de navegador.").waitFor();
    await page.getByRole("button", { name: "Marcar acompanhamento como concluído" }).click();
    await page.getByText(/Próximo acompanhamento:.*Concluído/).waitFor();

    await page.locator("#service-name").fill(serviceName);
    await page.locator("#service-description").fill("Serviço de validação ponta a ponta.");
    await page.locator("#service-price").fill("1250");
    await page.locator("#service-form button[type=submit]").click();
    await page.locator("#service-list").getByText(serviceName).waitFor();

    const customerOption = page.locator("#proposal-customer option").filter({ hasText: customerName });
    await customerOption.waitFor();
    await page.locator("#proposal-customer").selectOption(await customerOption.getAttribute("value"));
    await page.locator("#proposal-name").fill(proposalTitle);
    const serviceSelect = page.locator("#proposal-item-list .proposal-service").first();
    const serviceOptionValue = await serviceSelect.locator("option")
      .filter({ hasText: serviceName }).getAttribute("value");
    assert.ok(serviceOptionValue, "new service should be selectable in a proposal");
    await serviceSelect.selectOption(serviceOptionValue);
    await page.locator("#proposal-item-list .proposal-unit-price").first().fill("1250");
    await page.locator("#proposal-form button[type=submit]").click();
    const proposalRow = page.locator("#proposal-list tr").filter({ hasText: proposalTitle });
    await proposalRow.waitFor();
    await proposalRow.getByRole("button", { name: "Detalhes" }).click();
    const proposalDetails = page.locator("#proposal-details-content");
    await proposalDetails.getByRole("button", { name: "Registrar envio realizado" }).click();
    await proposalDetails.getByRole("button", { name: "Registrar aceite" }).click();
    await proposalDetails.getByRole("button", { name: "Criar contrato em rascunho" }).click();

    const contractForm = page.locator("#contract-form");
    await contractForm.waitFor({ state: "visible" });
    await page.locator("#contract-name").fill(contractTitle);
    await page.locator("#contract-payment-terms").fill("Pagamento mensal.");
    await page.locator("#contract-clauses").fill("Escopo validado pelo responsável.");
    await contractForm.locator("button[type=submit]").click();
    const contractRow = page.locator("#contract-list tr").filter({ hasText: contractTitle });
    await contractRow.waitFor();
    await contractRow.getByRole("button", { name: "Abrir" }).click();
    const contractDetails = page.locator("#contract-details-content");
    await contractDetails.getByRole("button", { name: "Registrar como assinado" }).click();

    await page.getByRole("heading", { name: "Onboarding do cliente" }).waitFor();
    const onboardingForm = page.locator(".onboarding-form");
    await onboardingForm.locator("[name=title]").fill(taskTitle);
    await onboardingForm.locator("[name=details]").fill("Validar acesso e alinhar próximos passos.");
    await onboardingForm.getByRole("button", { name: "Adicionar tarefa" }).click();
    await onboardingForm.locator(".onboarding-task").filter({ hasText: taskTitle }).waitFor();
    const taskStatus = onboardingForm.getByLabel("Status da tarefa " + taskTitle);
    await taskStatus.selectOption("done");
    await onboardingForm.locator(".onboarding-column").filter({ hasText: "Concluída" })
      .getByText(taskTitle).waitFor();

    await page.locator("#finance-description").fill(transactionDescription);
    await page.locator("#finance-category").fill("Serviços");
    await page.locator("#finance-amount").fill("1250");
    await page.locator("#finance-form button[type=submit]").click();
    await page.locator("#finance-list").getByText(transactionDescription).waitFor();
    await page.locator("#finance-income").getByText(/1\.250,00/).waitFor();

    assert.deepEqual(pageErrors, [], "browser UI should not throw uncaught JavaScript errors");
    console.log("Browser end-to-end passed: login, company profile, customer, contact history/follow-up, service, proposal lifecycle, contract/revisions/signature, onboarding task, and finance entry/summary.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error("Browser end-to-end failed:", error.stack || error.message);
  process.exitCode = 1;
});
