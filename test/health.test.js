const { test } = require("node:test");
const assert = require("node:assert/strict");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { createApp } = require("../src/server");

test("health endpoint returns a healthy response without exposing secrets", async () => {
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
    const address = server.address();
    const response = await fetch("http://127.0.0.1:" + address.port + "/api/health");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("health endpoint reports unavailable without exposing database errors", async () => {
  const app = createApp({
    pool: { execute: async () => { throw new Error("database credentials leaked"); } },
    sessionStore: new session.MemoryStore(),
    env: {
      APP_ORIGIN: "http://localhost:3000",
      SESSION_SECRET: "test-only-session-secret-with-32-bytes",
      NODE_ENV: "test"
    }
  });
  const server = app.listen(0);
  try {
    const response = await fetch("http://127.0.0.1:" + server.address().port + "/api/health");
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "unavailable" });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("protected dashboard rejects unauthenticated requests", async () => {
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
    const response = await fetch("http://127.0.0.1:" + server.address().port + "/app");
    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("login rejects a request from a different origin before querying the database", async () => {
  let queried = false;
  const app = createApp({
    pool: { execute: async () => { queried = true; return [[], []]; } },
    sessionStore: new session.MemoryStore(),
    env: {
      APP_ORIGIN: "http://localhost:3000",
      SESSION_SECRET: "test-only-session-secret-with-32-bytes",
      NODE_ENV: "test"
    }
  });
  const server = app.listen(0);
  try {
    const response = await fetch("http://127.0.0.1:" + server.address().port + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "https://attacker.example" },
      body: JSON.stringify({ email: "admin@example.com", password: "not-a-real-password" })
    });
    assert.equal(response.status, 403);
    assert.equal(queried, false);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("valid login creates a session that can access the current-user endpoint", async () => {
  const passwordHash = await bcrypt.hash("correct-horse-battery-93", 4);
  const pool = {
    execute: async (query) => {
      if (query.includes("password_hash")) {
        return [[{ id: 7, email: "admin@example.com", password_hash: passwordHash }], []];
      }
      return [[{ id: 7, email: "admin@example.com" }], []];
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
  try {
    const baseUrl = "http://127.0.0.1:" + server.address().port;
    const login = await fetch(baseUrl + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "http://localhost:3000" },
      body: JSON.stringify({ email: "admin@example.com", password: "correct-horse-battery-93" })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];

    const currentUser = await fetch(baseUrl + "/api/auth/me", {
      headers: { "Cookie": cookie }
    });
    assert.equal(currentUser.status, 200);
    assert.deepEqual(await currentUser.json(), {
      user: { id: 7, email: "admin@example.com" }
    });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("trusted proxy hops are configurable and validated", () => {
  const app = createApp({
    pool: { execute: async () => [[], []] },
    sessionStore: new session.MemoryStore(),
    env: {
      APP_ORIGIN: "https://crm.example",
      SESSION_SECRET: "test-only-session-secret-with-32-bytes",
      NODE_ENV: "production",
      TRUST_PROXY_HOPS: "1"
    }
  });
  assert.equal(app.get("trust proxy"), 1);

  assert.throws(() => createApp({
    pool: { execute: async () => [[], []] },
    sessionStore: new session.MemoryStore(),
    env: {
      APP_ORIGIN: "https://crm.example",
      SESSION_SECRET: "test-only-session-secret-with-32-bytes",
      NODE_ENV: "production",
      TRUST_PROXY_HOPS: "one"
    }
  }), /TRUST_PROXY_HOPS must be a non-negative integer/);
});


test("hosting-provided public origin is accepted when APP_ORIGIN is not set", () => {
  const app = createApp({
    pool: { execute: async () => [[], []] },
    sessionStore: new session.MemoryStore(),
    env: {
      RENDER_EXTERNAL_URL: "https://fnsc-crm-demo.onrender.com",
      SESSION_SECRET: "test-only-session-secret-with-32-bytes",
      NODE_ENV: "production",
      TRUST_PROXY_HOPS: "1"
    }
  });
  assert.equal(typeof app.listen, "function");
});
