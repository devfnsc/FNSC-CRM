const { test } = require("node:test");
const assert = require("node:assert/strict");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { createApp } = require("../src/server");

async function createServer({ authenticated = true } = {}) {
  const password = "correct-horse-battery-93";
  const user = { id: 7, email: "admin@example.com" };
  const passwordHash = await bcrypt.hash(password, 4);
  const transactions = [];
  const pool = {
    execute: async (query, values = []) => {
      if (query.includes("password_hash")) return [[{ ...user, password_hash: passwordHash }], []];
      if (query.includes("FROM users WHERE id")) return [[user], []];
      if (query.includes("AS income")) {
        const records = transactions.filter((row) => row.occurred_on >= values[0] && row.occurred_on < values[1]);
        const income = records.filter((row) => row.type === "income").reduce((sum, row) => sum + Number(row.amount), 0);
        const expenses = records.filter((row) => row.type === "expense").reduce((sum, row) => sum + Number(row.amount), 0);
        return [[{ income: income.toFixed(2), expenses: expenses.toFixed(2) }], []];
      }
      if (query.includes("FROM finance_transactions WHERE occurred_on")) {
        const rows = transactions.filter((row) => row.occurred_on >= values[0] && row.occurred_on < values[1])
          .sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.id - a.id);
        return [rows.map((row) => ({ ...row })), []];
      }
      if (query.includes("INSERT INTO finance_transactions")) {
        const [type, description, category, amount, occurred_on, notes, created_by, updated_by] = values;
        const row = { id: transactions.length + 1, type, description, category, amount, occurred_on, notes, created_by, updated_by };
        transactions.push(row);
        return [{ insertId: row.id }, []];
      }
      if (query.includes("UPDATE finance_transactions SET")) {
        const [type, description, category, amount, occurred_on, notes, updated_by, id] = values;
        const row = transactions.find((item) => String(item.id) === String(id));
        if (row) Object.assign(row, { type, description, category, amount, occurred_on, notes, updated_by });
        return [{ affectedRows: row ? 1 : 0 }, []];
      }
      if (query.includes("SELECT id FROM finance_transactions WHERE id")) {
        const row = transactions.find((item) => String(item.id) === String(values[0]));
        return [row ? [{ id: row.id }] : [], []];
      }
      throw new Error("Unexpected SQL: " + query);
    }
  };
  const app = createApp({
    pool,
    sessionStore: new session.MemoryStore(),
    env: {
      APP_ORIGIN: "http://localhost:3000",
      SESSION_SECRET: "test-only-session-secret-with-32-bytes",
      NODE_ENV: "test"
    }
  });
  const server = app.listen(0);
  const baseUrl = "http://127.0.0.1:" + server.address().port;
  let cookie = null;
  if (authenticated) {
    const login = await fetch(baseUrl + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({ email: user.email, password })
    });
    assert.equal(login.status, 200);
    cookie = login.headers.get("set-cookie").split(";")[0];
  }
  return { server, baseUrl, cookie, transactions };
}

test("finance entries are validated, summarized by month, and editable", async () => {
  const { server, baseUrl, cookie, transactions } = await createServer();
  try {
    const add = async (entry) => fetch(baseUrl + "/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
      body: JSON.stringify(entry)
    });
    const income = await add({
      type: "income", description: "Projeto inicial", category: "Serviços", amount: "200.00",
      occurredOn: "2026-07-03", notes: ""
    });
    assert.equal(income.status, 201);
    const expense = await add({
      type: "expense", description: "Ferramenta", category: "Software", amount: "40",
      occurredOn: "2026-07-10", notes: "Plano mensal"
    });
    assert.equal(expense.status, 201);
    assert.equal(transactions[1].amount, "40.00");

    const july = await fetch(baseUrl + "/api/finance?month=2026-07", { headers: { Cookie: cookie } });
    const julyData = await july.json();
    assert.equal(julyData.summary.income, "200.00");
    assert.equal(julyData.summary.expenses, "40.00");
    assert.equal(julyData.summary.balance, "160.00");
    assert.equal(julyData.transactions.length, 2);

    const update = await fetch(baseUrl + "/api/finance/2", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
      body: JSON.stringify({
        type: "expense", description: "Notebook", category: "Equipamentos", amount: "250.50",
        occurredOn: "2026-08-02", notes: ""
      })
    });
    assert.equal(update.status, 200);
    assert.equal(transactions[1].description, "Notebook");

    const august = await fetch(baseUrl + "/api/finance?month=2026-08", { headers: { Cookie: cookie } });
    const augustData = await august.json();
    assert.equal(augustData.summary.expenses, "250.50");
    assert.equal(augustData.transactions.length, 1);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("finance API rejects invalid amounts, dates, months, and anonymous access", async () => {
  const { server, baseUrl, cookie } = await createServer();
  try {
    const invalid = await fetch(baseUrl + "/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
      body: JSON.stringify({
        type: "income", description: "Invalid", category: "Teste", amount: "0",
        occurredOn: "2026-02-30", notes: ""
      })
    });
    assert.equal(invalid.status, 400);
    const badMonth = await fetch(baseUrl + "/api/finance?month=2026-13", { headers: { Cookie: cookie } });
    assert.equal(badMonth.status, 400);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }

  const anonymous = await createServer({ authenticated: false });
  try {
    const response = await fetch(anonymous.baseUrl + "/api/finance");
    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve, reject) => anonymous.server.close((error) => error ? reject(error) : resolve()));
  }
});
