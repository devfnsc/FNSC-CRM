const { test } = require("node:test");
const assert = require("node:assert/strict");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { createApp } = require("../src/server");

async function createAuthenticatedServer() {
  const password = "correct-horse-battery-93";
  const passwordHash = await bcrypt.hash(password, 4);
  const saved = [];
  const customers = [{
    id: 42,
    name: "Ana Souza",
    company_name: "Exemplo Ltda.",
    email: "ana@example.com",
    phone: "+55 11 99999-0000",
    notes: "Prefere contato por e-mail.",
    created_at: "2026-10-22T12:00:00.000Z",
    updated_at: "2026-10-22T12:00:00.000Z",
    archived_at: null
  }];
  const user = { id: 7, email: "admin@example.com" };
  const pool = {
    execute: async (query, values = []) => {
      if (query.includes("password_hash")) return [[{ ...user, password_hash: passwordHash }], []];
      if (query.includes("FROM users WHERE id")) return [[user], []];
      if (query.includes("INSERT INTO customers")) {
        saved.push(values);
        return [{ insertId: 42 }, []];
      }
      if (query.includes("UPDATE customers SET archived_at = CURRENT_TIMESTAMP")) {
        const customer = customers.find((entry) => String(entry.id) === String(values[0]));
        if (customer) customer.archived_at = "2026-10-22T14:00:00.000Z";
        return [{ affectedRows: customer ? 1 : 0 }, []];
      }
      if (query.includes("UPDATE customers SET archived_at = NULL")) {
        const customer = customers.find((entry) => String(entry.id) === String(values[0]));
        if (customer) customer.archived_at = null;
        return [{ affectedRows: customer ? 1 : 0 }, []];
      }
      if (query.includes("UPDATE customers SET")) {
        const [name, companyName, email, phone, notes, id] = values;
        const customer = customers.find((entry) => String(entry.id) === String(id));
        if (customer) {
          Object.assign(customer, {
            name,
            company_name: companyName,
            email,
            phone,
            notes,
            updated_at: "2026-10-22T13:00:00.000Z"
          });
          return [{ affectedRows: 1 }, []];
        }
        return [{ affectedRows: 0 }, []];
      }
      if (query.includes("FROM customers") && query.includes("WHERE id = ?")) {
        return [[customers.find((customer) => String(customer.id) === String(values[0]))].filter(Boolean), []];
      }
      if (query.includes("FROM customers")) {
        let result = customers;
        if (query.includes("archived_at IS NULL")) result = result.filter((customer) => !customer.archived_at);
        if (query.includes("archived_at IS NOT NULL")) result = result.filter((customer) => customer.archived_at);
        const listValues = [...values];
        if (query.includes("name LIKE ?")) {
          const patterns = listValues.splice(0, 4);
          const term = patterns[0].slice(1, -1).toLowerCase();
          result = result.filter((customer) =>
            [customer.name, customer.company_name, customer.email, customer.phone]
              .some((value) => value && value.toLowerCase().includes(term))
          );
        }
        const limit = listValues[0];
        const offset = listValues[1];
        return [result.slice(offset, offset + limit), []];
      }
      throw new Error("Unexpected SQL in test: " + query);
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
  const login = await fetch(baseUrl + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": "http://localhost:3000" },
    body: JSON.stringify({ email: user.email, password })
  });
  assert.equal(login.status, 200);
  return { server, baseUrl, cookie: login.headers.get("set-cookie").split(";")[0], saved };
}

test("authenticated owner can register a customer with a contact method", async () => {
  const { server, baseUrl, cookie, saved } = await createAuthenticatedServer();
  try {
    const response = await fetch(baseUrl + "/api/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000",
        "Cookie": cookie
      },
      body: JSON.stringify({
        name: "Ana Souza",
        companyName: "Exemplo Ltda.",
        email: "ana@example.com",
        phone: "+55 11 99999-0000",
        notes: "Prefere contato por e-mail."
      })
    });
    assert.equal(response.status, 201);
    assert.deepEqual((await response.json()).customer, {
      id: 42,
      name: "Ana Souza",
      companyName: "Exemplo Ltda.",
      email: "ana@example.com",
      phone: "+55 11 99999-0000",
      notes: "Prefere contato por e-mail."
    });
    assert.deepEqual(saved, [[
      "Ana Souza",
      "Exemplo Ltda.",
      "ana@example.com",
      "+55 11 99999-0000",
      "Prefere contato por e-mail."
    ]]);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("customer listing supports search and pagination", async () => {
  const { server, baseUrl, cookie } = await createAuthenticatedServer();
  try {
    const response = await fetch(baseUrl + "/api/customers?q=Ana&page=1&limit=1", {
      headers: { "Cookie": cookie }
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      customers: [{
        id: 42,
        name: "Ana Souza",
        companyName: "Exemplo Ltda.",
        email: "ana@example.com",
        phone: "+55 11 99999-0000",
        createdAt: "2026-10-22T12:00:00.000Z"
      }],
      page: 1,
      limit: 1,
      hasMore: false
    });

    const invalid = await fetch(baseUrl + "/api/customers?page=0", {
      headers: { "Cookie": cookie }
    });
    assert.equal(invalid.status, 400);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("customer can be archived and restored without deleting the record", async () => {
  const { server, baseUrl, cookie } = await createAuthenticatedServer();
  try {
    const archive = await fetch(baseUrl + "/api/customers/42/archive", {
      method: "PATCH", headers: { "Origin": "http://localhost:3000", "Cookie": cookie }
    });
    assert.equal(archive.status, 200);
    assert.equal((await archive.json()).customer.archivedAt, "2026-10-22T14:00:00.000Z");
    const activeList = await fetch(baseUrl + "/api/customers?status=active", { headers: { "Cookie": cookie } });
    assert.deepEqual((await activeList.json()).customers, []);
    const archivedList = await fetch(baseUrl + "/api/customers?status=archived", { headers: { "Cookie": cookie } });
    assert.equal((await archivedList.json()).customers.length, 1);

    const restore = await fetch(baseUrl + "/api/customers/42/restore", {
      method: "PATCH", headers: { "Origin": "http://localhost:3000", "Cookie": cookie }
    });
    assert.equal(restore.status, 200);
    assert.equal((await restore.json()).customer.archivedAt, null);
    const restored = await fetch(baseUrl + "/api/customers?status=active", { headers: { "Cookie": cookie } });
    assert.equal((await restored.json()).customers.length, 1);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("authenticated owner can update an existing customer", async () => {
  const { server, baseUrl, cookie } = await createAuthenticatedServer();
  try {
    const response = await fetch(baseUrl + "/api/customers/42", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000",
        "Cookie": cookie
      },
      body: JSON.stringify({
        name: "Ana Souza Lima",
        companyName: "Exemplo Ltda.",
        email: "ana.lima@example.com",
        phone: "+55 11 98888-0000",
        notes: "Prefere contato pela manhã."
      })
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).customer, {
      id: 42,
      name: "Ana Souza Lima",
      companyName: "Exemplo Ltda.",
      email: "ana.lima@example.com",
      phone: "+55 11 98888-0000",
      createdAt: "2026-10-22T12:00:00.000Z",
      notes: "Prefere contato pela manhã.",
      updatedAt: "2026-10-22T13:00:00.000Z",
      archivedAt: null
    });

    const invalid = await fetch(baseUrl + "/api/customers/42", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000",
        "Cookie": cookie
      },
      body: JSON.stringify({ name: "Ana Souza" })
    });
    assert.equal(invalid.status, 400);

    const missing = await fetch(baseUrl + "/api/customers/999", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000",
        "Cookie": cookie
      },
      body: JSON.stringify({ name: "Ana Souza", phone: "+55 11 99999-0000" })
    });
    assert.equal(missing.status, 404);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("customer details are available only to an authenticated session", async () => {
  const { server, baseUrl, cookie } = await createAuthenticatedServer();
  try {
    const response = await fetch(baseUrl + "/api/customers/42", {
      headers: { "Cookie": cookie }
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).customer, {
      id: 42,
      name: "Ana Souza",
      companyName: "Exemplo Ltda.",
      email: "ana@example.com",
      phone: "+55 11 99999-0000",
      createdAt: "2026-10-22T12:00:00.000Z",
      notes: "Prefere contato por e-mail.",
      updatedAt: "2026-10-22T12:00:00.000Z",
      archivedAt: null
    });

    const missing = await fetch(baseUrl + "/api/customers/999", {
      headers: { "Cookie": cookie }
    });
    assert.equal(missing.status, 404);

    const malformed = await fetch(baseUrl + "/api/customers/0", {
      headers: { "Cookie": cookie }
    });
    assert.equal(malformed.status, 400);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("customer directory and details require an authenticated session", async () => {
  const app = createApp({
    pool: { execute: async () => [[], []] },
    sessionStore: new session.MemoryStore(),
    env: {
      APP_ORIGIN: "http://localhost:3000",
      SESSION_SECRET: "test-only-session-secret-with-32-bytes",
      NODE_ENV: "test"
    }
  });
  const server = app.listen(0);
  try {
    for (const path of ["/api/customers", "/api/customers/42"]) {
      const response = await fetch("http://127.0.0.1:" + server.address().port + path);
      assert.equal(response.status, 401);
    }
    const update = await fetch("http://127.0.0.1:" + server.address().port + "/api/customers/42", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000"
      },
      body: JSON.stringify({ name: "Ana Souza", phone: "+55 11 99999-0000" })
    });
    assert.equal(update.status, 401);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
