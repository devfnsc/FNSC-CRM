const { test } = require("node:test");
const assert = require("node:assert/strict");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { createApp } = require("../src/server");

async function createServer({ contractStatus = "signed", authenticated = true } = {}) {
  const user = { id: 7, email: "admin@example.com" };
  const password = "correct-horse-battery-93";
  const passwordHash = await bcrypt.hash(password, 4);
  const contract = { id: 9, status: contractStatus };
  const tasks = [];
  const pool = {
    execute: async (query, values = []) => {
      if (query.includes("password_hash")) return [[{ ...user, password_hash: passwordHash }], []];
      if (query.includes("FROM users WHERE id")) return [[user], []];
      if (query.includes("FROM contracts WHERE id = ? LIMIT 1")) {
        return [String(contract.id) === String(values[0]) ? [contract] : [], []];
      }
      if (query.includes("FROM onboarding_tasks WHERE contract_id")) {
        return [tasks.filter((task) => String(task.contract_id) === String(values[0])).map((task) => ({ ...task })), []];
      }
      if (query.includes("INSERT INTO onboarding_tasks")) {
        const [contractId, title, details, dueDate, status, createdBy, updatedBy] = values;
        const task = { id: tasks.length + 1, contract_id: Number(contractId), title, details, due_date: dueDate,
          status, created_by: createdBy, updated_by: updatedBy };
        tasks.push(task);
        return [{ insertId: task.id }, []];
      }
      if (query.includes("JOIN contracts c ON c.id = t.contract_id")) {
        const task = tasks.find((item) => String(item.id) === String(values[0]));
        return [task ? [{ id: task.id, contract_id: task.contract_id, contract_status: contract.status }] : [], []];
      }
      if (query.includes("UPDATE onboarding_tasks SET")) {
        const [title, details, dueDate, status, updatedBy, id] = values;
        const task = tasks.find((item) => String(item.id) === String(id));
        if (task) Object.assign(task, { title, details, due_date: dueDate, status, updated_by: updatedBy });
        return [{ affectedRows: task ? 1 : 0 }, []];
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
  return { server, baseUrl, cookie, tasks };
}

test("signed contracts can manage onboarding tasks and status", async () => {
  const { server, baseUrl, cookie, tasks } = await createServer();
  try {
    const created = await fetch(baseUrl + "/api/onboarding/contracts/9/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
      body: JSON.stringify({
        title: "Solicitar materiais", details: "Logo e textos aprovados", dueDate: "2026-11-01", status: "pending"
      })
    });
    assert.equal(created.status, 201);
    assert.equal(tasks.length, 1);

    const listed = await fetch(baseUrl + "/api/onboarding/contracts/9/tasks", { headers: { Cookie: cookie } });
    const data = await listed.json();
    assert.equal(listed.status, 200);
    assert.equal(data.tasks[0].title, "Solicitar materiais");

    const updated = await fetch(baseUrl + "/api/onboarding/tasks/1", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
      body: JSON.stringify({
        title: "Receber materiais", details: "Aguardando o cliente", dueDate: "2026-11-03", status: "in_progress"
      })
    });
    assert.equal(updated.status, 200);
    assert.equal(tasks[0].status, "in_progress");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("onboarding is available only for signed contracts and validates task fields", async () => {
  const { server, baseUrl, cookie } = await createServer({ contractStatus: "draft" });
  try {
    const response = await fetch(baseUrl + "/api/onboarding/contracts/9/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
      body: JSON.stringify({ title: "Acompanhar", details: "", dueDate: "", status: "pending" })
    });
    assert.equal(response.status, 409);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }

  const invalidServer = await createServer();
  try {
    const response = await fetch(invalidServer.baseUrl + "/api/onboarding/contracts/9/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: invalidServer.cookie },
      body: JSON.stringify({ title: "", details: "", dueDate: "2026-02-30", status: "blocked" })
    });
    assert.equal(response.status, 400);
  } finally {
    await new Promise((resolve, reject) => invalidServer.server.close((error) => error ? reject(error) : resolve()));
  }
});
