const { test } = require("node:test");
const assert = require("node:assert/strict");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { createApp } = require("../src/server");

async function createAuthenticatedServer() {
  const password = "correct-horse-battery-93";
  const passwordHash = await bcrypt.hash(password, 4);
  const saved = [];
  const user = { id: 7, email: "admin@example.com" };
  const pool = {
    execute: async (query, values = []) => {
      if (query.includes("password_hash")) return [[{ ...user, password_hash: passwordHash }], []];
      if (query.includes("FROM users WHERE id")) return [[user], []];
      if (query.includes("INSERT INTO customers")) {
        saved.push(values);
        return [{ insertId: 42 }, []];
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

test("customer registration rejects missing contact and invalid email", async () => {
  const { server, baseUrl, cookie, saved } = await createAuthenticatedServer();
  try {
    const noContact = await fetch(baseUrl + "/api/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000",
        "Cookie": cookie
      },
      body: JSON.stringify({ name: "Ana Souza" })
    });
    assert.equal(noContact.status, 400);

    const invalidEmail = await fetch(baseUrl + "/api/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000",
        "Cookie": cookie
      },
      body: JSON.stringify({ name: "Ana Souza", email: "not-an-email" })
    });
    assert.equal(invalidEmail.status, 400);
    assert.equal(saved.length, 0);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("customer registration requires an authenticated session", async () => {
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
    const response = await fetch("http://127.0.0.1:" + server.address().port + "/api/customers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000"
      },
      body: JSON.stringify({ name: "Ana Souza", phone: "+55 11 99999-0000" })
    });
    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
