const { test } = require("node:test");
const assert = require("node:assert/strict");
const session = require("express-session");
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