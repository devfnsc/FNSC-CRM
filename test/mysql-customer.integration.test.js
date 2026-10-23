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
    await pool.execute("DELETE FROM customers");
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
