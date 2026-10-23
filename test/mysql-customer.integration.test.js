const { test } = require("node:test");
const assert = require("node:assert/strict");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const bcrypt = require("bcryptjs");
const { createPool } = require("../src/config/database");
const { createApp } = require("../src/server");

test("MySQL integration: admin can log in and complete the customer lifecycle", {
  skip: process.env.RUN_MYSQL_INTEGRATION !== "1"
}, async () => {
  const pool = createPool();
  const sessionStore = new MySQLStore({
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 8 * 60 * 60 * 1000,
    createDatabaseTable: true
  }, pool);
  let server;

  try {
    await sessionStore.onReady();
    await pool.execute("DELETE FROM sessions");
    await pool.execute("DELETE FROM customer_activities");
    await pool.execute("DELETE FROM onboarding_tasks");
    await pool.execute("DELETE FROM contract_status_history");
    await pool.execute("DELETE FROM contract_revisions");
    await pool.execute("DELETE FROM contract_items");
    await pool.execute("DELETE FROM contracts");
    await pool.execute("DELETE FROM proposal_status_history");
    await pool.execute("DELETE FROM proposal_items");
    await pool.execute("DELETE FROM proposals");
    await pool.execute("DELETE FROM finance_transactions");
    await pool.execute("DELETE FROM services");
    await pool.execute("DELETE FROM customers");
    await pool.execute("DELETE FROM company_profile");
    await pool.execute("DELETE FROM users");

    const email = "admin@example.test";
    const password = "integration-test-password-123";
    const passwordHash = await bcrypt.hash(password, 4);
    await pool.execute(
      "INSERT INTO users (email, password_hash, active) VALUES (?, ?, 1)",
      [email, passwordHash]
    );

    const app = createApp({
      pool,
      sessionStore,
      env: {
        APP_ORIGIN: process.env.APP_ORIGIN,
        SESSION_SECRET: process.env.SESSION_SECRET,
        NODE_ENV: "test"
      }
    });
    server = app.listen(0);
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });

    const baseUrl = "http://127.0.0.1:" + server.address().port;
    let cookie;
    const send = (url, options = {}) => fetch(baseUrl + url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(cookie ? { Cookie: cookie } : {})
      }
    });

    const login = await send("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: process.env.APP_ORIGIN
      },
      body: JSON.stringify({ email, password })
    });
    assert.equal(login.status, 200);
    cookie = login.headers.get("set-cookie").split(";")[0];

    const dashboard = await send("/app");
    assert.equal(dashboard.status, 200);
    assert.match(await dashboard.text(), /Clientes cadastrados/u);

    const created = await send("/api/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: process.env.APP_ORIGIN
      },
      body: JSON.stringify({
        name: "Cliente de integração",
        companyName: "Empresa Teste",
        email: "cliente@example.test",
        phone: "+55 11 90000-0000",
        notes: "Criado pelo teste de integração."
      })
    });
    assert.equal(created.status, 201);
    const { customer } = await created.json();

    const listed = await send("/api/customers");
    assert.equal(listed.status, 200);
    assert.equal((await listed.json()).customers[0].id, customer.id);

    const updated = await send("/api/customers/" + customer.id, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Origin: process.env.APP_ORIGIN
      },
      body: JSON.stringify({
        name: "Cliente atualizado",
        companyName: "Empresa Teste",
        email: "cliente@example.test",
        phone: "+55 11 90000-0000",
        notes: "Cadastro atualizado."
      })
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).customer.name, "Cliente atualizado");

    const archived = await send("/api/customers/" + customer.id + "/archive", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Origin: process.env.APP_ORIGIN
      },
      body: "{}"
    });
    assert.equal(archived.status, 200);
    assert.ok((await archived.json()).customer.archivedAt);

    const activeList = await send("/api/customers");
    assert.deepEqual((await activeList.json()).customers, []);

    const archivedList = await send("/api/customers?status=archived");
    assert.equal((await archivedList.json()).customers.length, 1);

    const restored = await send("/api/customers/" + customer.id + "/restore", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Origin: process.env.APP_ORIGIN
      },
      body: "{}"
    });
    assert.equal(restored.status, 200);
    assert.equal((await restored.json()).customer.archivedAt, null);

    const profileUpdate = await send("/api/company", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: process.env.APP_ORIGIN },
      body: JSON.stringify({
        businessName: "FNSC Marketing",
        tradeName: "FNSC",
        contactEmail: "contato@example.test",
        phone: "+55 11 90000-0000",
        website: "https://example.test",
        timezone: "America/Sao_Paulo"
      })
    });
    assert.equal(profileUpdate.status, 200);
    assert.equal((await profileUpdate.json()).profile.businessName, "FNSC Marketing");

    const serviceCreate = await send("/api/services", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: process.env.APP_ORIGIN },
      body: JSON.stringify({
        name: "Gestão de marketing",
        description: "Planejamento mensal.",
        referencePrice: "250.00"
      })
    });
    assert.equal(serviceCreate.status, 201);
    const { service } = await serviceCreate.json();
    const serviceList = await send("/api/services");
    assert.equal((await serviceList.json()).services.length, 1);

    const proposalCreate = await send("/api/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: process.env.APP_ORIGIN },
      body: JSON.stringify({
        customerId: String(customer.id),
        title: "Plano de marketing",
        validUntil: "2026-12-31",
        notes: "Proposta para o cliente de integração.",
        items: [{ serviceId: String(service.id), quantity: 2, unitPrice: "250.00" }]
      })
    });
    assert.equal(proposalCreate.status, 201);
    const { proposal } = await proposalCreate.json();
    assert.equal(proposal.total, "500.00");

    const proposalUpdate = await send("/api/proposals/" + proposal.id, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: process.env.APP_ORIGIN },
      body: JSON.stringify({
        customerId: String(customer.id),
        title: "Plano atualizado",
        validUntil: "2026-12-31",
        notes: "Escopo revisado.",
        items: [{ serviceId: String(service.id), quantity: 3, unitPrice: "200.00" }]
      })
    });
    assert.equal(proposalUpdate.status, 200);
    assert.equal((await proposalUpdate.json()).proposal.total, "600.00");

    for (const status of ["sent", "accepted"]) {
      const response = await send("/api/proposals/" + proposal.id + "/status", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Origin: process.env.APP_ORIGIN },
        body: JSON.stringify({ status })
      });
      assert.equal(response.status, 200);
    }
    const proposalDetails = await send("/api/proposals/" + proposal.id);
    const proposalData = (await proposalDetails.json()).proposal;
    assert.equal(proposalDetails.status, 200);
    assert.equal(proposalData.status, "accepted");
    assert.equal(proposalData.statusHistory.length, 3);

    const contractCreate = await send("/api/contracts/from-proposal/" + proposal.id, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: process.env.APP_ORIGIN },
      body: "{}"
    });
    assert.equal(contractCreate.status, 201);
    const { contract } = await contractCreate.json();

    const contractUpdate = await send("/api/contracts/" + contract.id, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: process.env.APP_ORIGIN },
      body: JSON.stringify({
        title: "Contrato de serviços",
        effectiveDate: "2026-11-01",
        endDate: "2027-10-31",
        paymentTerms: "Pagamento mensal.",
        clauses: "Escopo aprovado e revisado pelo responsável."
      })
    });
    assert.equal(contractUpdate.status, 200);
    const contractDetails = await send("/api/contracts/" + contract.id);
    const contractData = (await contractDetails.json()).contract;
    assert.equal(contractData.revisions.length, 2);
    assert.equal(contractData.items.length, 1);

    const printableContract = await send("/api/contracts/" + contract.id + "/print");
    assert.equal(printableContract.status, 200);
    assert.match(await printableContract.text(), /Contrato de serviços/u);

    const signed = await send("/api/contracts/" + contract.id + "/status", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: process.env.APP_ORIGIN },
      body: JSON.stringify({ status: "signed" })
    });
    assert.equal(signed.status, 200);

    const onboardingCreate = await send("/api/onboarding/contracts/" + contract.id + "/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: process.env.APP_ORIGIN },
      body: JSON.stringify({
        title: "Solicitar materiais",
        details: "Logo e textos aprovados.",
        dueDate: "2026-11-05",
        status: "pending"
      })
    });
    assert.equal(onboardingCreate.status, 201);
    const { task } = await onboardingCreate.json();

    const onboardingUpdate = await send("/api/onboarding/tasks/" + task.id, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: process.env.APP_ORIGIN },
      body: JSON.stringify({
        title: "Receber materiais",
        details: "Aguardando envio do cliente.",
        dueDate: "2026-11-07",
        status: "in_progress"
      })
    });
    assert.equal(onboardingUpdate.status, 200);
    const onboardingList = await send("/api/onboarding/contracts/" + contract.id + "/tasks");
    assert.equal((await onboardingList.json()).tasks[0].status, "in_progress");

    const activityCreate = await send("/api/customer-activities/customers/" + customer.id + "/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: process.env.APP_ORIGIN },
      body: JSON.stringify({
        type: "meeting",
        summary: "Reunião inicial de alinhamento.",
        occurredOn: "2026-10-23",
        followUpDate: "2026-10-26"
      })
    });
    assert.equal(activityCreate.status, 201);
    const { activity } = await activityCreate.json();
    const followUp = await send("/api/customer-activities/activities/" + activity.id + "/follow-up", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Origin: process.env.APP_ORIGIN },
      body: JSON.stringify({ status: "completed" })
    });
    assert.equal(followUp.status, 200);
    const activityList = await send("/api/customer-activities/customers/" + customer.id + "/activities");
    assert.equal((await activityList.json()).activities[0].followUpStatus, "completed");

    const financeIncome = await send("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: process.env.APP_ORIGIN },
      body: JSON.stringify({
        type: "income", description: "Projeto inicial", category: "Serviços",
        amount: "600.00", occurredOn: "2026-10-10", notes: ""
      })
    });
    assert.equal(financeIncome.status, 201);

    const financeExpense = await send("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: process.env.APP_ORIGIN },
      body: JSON.stringify({
        type: "expense", description: "Ferramenta", category: "Software",
        amount: "40.00", occurredOn: "2026-10-11", notes: "Plano mensal"
      })
    });
    assert.equal(financeExpense.status, 201);
    const { transaction: expenseEntry } = await financeExpense.json();

    const financeSummary = await send("/api/finance?month=2026-10");
    const financeData = await financeSummary.json();
    assert.equal(financeData.summary.income, "600.00");
    assert.equal(financeData.summary.expenses, "40.00");
    assert.equal(financeData.summary.balance, "560.00");

    const financeUpdate = await send("/api/finance/" + expenseEntry.id, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: process.env.APP_ORIGIN },
      body: JSON.stringify({
        type: "expense", description: "Ferramenta atualizada", category: "Software",
        amount: "50.00", occurredOn: "2026-10-11", notes: "Plano revisado"
      })
    });
    assert.equal(financeUpdate.status, 200);

    const logout = await send("/api/auth/logout", {
      method: "POST",
      headers: { Origin: process.env.APP_ORIGIN }
    });
    assert.equal(logout.status, 204);

    const afterLogout = await send("/api/customers");
    assert.equal(afterLogout.status, 401);
  } finally {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
    await sessionStore.close();
    await pool.end();
  }
});
