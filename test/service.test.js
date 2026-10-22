const { test } = require("node:test");
const assert = require("node:assert/strict");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { createApp } = require("../src/server");

async function createServer({ authenticated = true } = {}) {
  const password = "correct-horse-battery-93";
  const passwordHash = await bcrypt.hash(password, 4);
  const services = [];
  const user = { id: 7, email: "admin@example.com" };
  const pool = {
    execute: async (query, values = []) => {
      if (query.includes("password_hash")) return [[{ ...user, password_hash: passwordHash }], []];
      if (query.includes("FROM users WHERE id")) return [[user], []];
      if (query.includes("SELECT id, name, description, reference_price FROM services WHERE id = ?")) {
        return [[services.find((service) => String(service.id) === String(values[0]))].filter(Boolean), []];
      }
      if (query.includes("SELECT id, name, description, reference_price FROM services")) return [services, []];
      if (query.includes("UPDATE services SET")) {
        const [name, description, reference_price, id] = values;
        const service = services.find((entry) => String(entry.id) === String(id));
        if (service) Object.assign(service, { name, description, reference_price });
        return [{ affectedRows: service ? 1 : 0 }, []];
      }
      if (query.includes("INSERT INTO services")) {
        const [name, description, reference_price] = values;
        const service = { id: services.length + 1, name, description, reference_price };
        services.push(service);
        return [{ insertId: service.id }, []];
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
  let cookie = null;
  if (authenticated) {
    const login = await fetch(baseUrl + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "http://localhost:3000" },
      body: JSON.stringify({ email: user.email, password })
    });
    assert.equal(login.status, 200);
    cookie = login.headers.get("set-cookie").split(";")[0];
  }
  return { server, baseUrl, cookie };
}

test("authenticated owner can create and list a service with a reference price", async () => {
  const { server, baseUrl, cookie } = await createServer();
  try {
    const created = await fetch(baseUrl + "/api/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000",
        "Cookie": cookie
      },
      body: JSON.stringify({
        name: "Gestão de redes sociais",
        description: "Planejamento e publicação de conteúdo.",
        referencePrice: "1250.50"
      })
    });
    assert.equal(created.status, 201);
    assert.deepEqual((await created.json()).service, {
      id: 1,
      name: "Gestão de redes sociais",
      description: "Planejamento e publicação de conteúdo.",
      referencePrice: "1250.50"
    });

    const listed = await fetch(baseUrl + "/api/services", { headers: { "Cookie": cookie } });
    assert.equal(listed.status, 200);
    assert.deepEqual((await listed.json()).services, [{
      id: 1,
      name: "Gestão de redes sociais",
      description: "Planejamento e publicação de conteúdo.",
      referencePrice: "1250.50"
    }]);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("authenticated owner can update a service", async () => {
  const { server, baseUrl, cookie } = await createServer();
  try {
    const created = await fetch(baseUrl + "/api/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000",
        "Cookie": cookie
      },
      body: JSON.stringify({ name: "Consultoria", description: "Inicial", referencePrice: "500" })
    });
    assert.equal(created.status, 201);

    const updated = await fetch(baseUrl + "/api/services/1", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000",
        "Cookie": cookie
      },
      body: JSON.stringify({
        name: "Consultoria estratégica",
        description: "Diagnóstico e plano de ação.",
        referencePrice: "750.25"
      })
    });
    assert.equal(updated.status, 200);
    assert.deepEqual((await updated.json()).service, {
      id: 1,
      name: "Consultoria estratégica",
      description: "Diagnóstico e plano de ação.",
      referencePrice: "750.25"
    });

    const missing = await fetch(baseUrl + "/api/services/999", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000",
        "Cookie": cookie
      },
      body: JSON.stringify({ name: "Consultoria", referencePrice: "100" })
    });
    assert.equal(missing.status, 404);

    const invalid = await fetch(baseUrl + "/api/services/1", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000",
        "Cookie": cookie
      },
      body: JSON.stringify({ name: " ", referencePrice: "1.999" })
    });
    assert.equal(invalid.status, 400);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("service registration rejects invalid names and prices", async () => {
  const { server, baseUrl, cookie } = await createServer();
  try {
    for (const body of [
      { name: " ", referencePrice: "10.00" },
      { name: "Consultoria", referencePrice: "10.999" },
      { name: "Consultoria", referencePrice: "-1.00" },
      { name: "Consultoria", referencePrice: "100000000.00" }
    ]) {
      const response = await fetch(baseUrl + "/api/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Origin": "http://localhost:3000",
          "Cookie": cookie
        },
        body: JSON.stringify(body)
      });
      assert.equal(response.status, 400);
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("service catalog requires authentication", async () => {
  const { server, baseUrl } = await createServer({ authenticated: false });
  try {
    const listed = await fetch(baseUrl + "/api/services");
    assert.equal(listed.status, 401);
    const created = await fetch(baseUrl + "/api/services", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000"
      },
      body: JSON.stringify({ name: "Consultoria" })
    });
    assert.equal(created.status, 401);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
