const { test } = require("node:test");
const assert = require("node:assert/strict");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { createApp } = require("../src/server");

test("authenticated owner can create and read the company profile", async () => {
  const password = "correct-horse-battery-93";
  const passwordHash = await bcrypt.hash(password, 4);
  let storedProfile = null;
  const user = { id: 7, email: "admin@example.com" };
  const pool = {
    execute: async (query, values = []) => {
      if (query.includes("password_hash")) {
        return [[{ ...user, password_hash: passwordHash }], []];
      }
      if (query.includes("FROM users WHERE id")) return [[user], []];
      if (query.includes("FROM company_profile")) return [[storedProfile].filter(Boolean), []];
      if (query.includes("INSERT INTO company_profile")) {
        const [businessName, tradeName, contactEmail, phone, website, timezone] = values;
        storedProfile = {
          id: 1,
          business_name: businessName,
          trade_name: tradeName,
          contact_email: contactEmail,
          phone,
          website,
          timezone
        };
        return [{ affectedRows: 1 }, []];
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

  try {
    const baseUrl = "http://127.0.0.1:" + server.address().port;
    const login = await fetch(baseUrl + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Origin": "http://localhost:3000" },
      body: JSON.stringify({ email: user.email, password })
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];

    const before = await fetch(baseUrl + "/api/company", { headers: { "Cookie": cookie } });
    assert.equal(before.status, 200);
    assert.deepEqual(await before.json(), { profile: null });

    const invalid = await fetch(baseUrl + "/api/company", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000",
        "Cookie": cookie
      },
      body: JSON.stringify({ businessName: " ", website: "javascript:alert(1)" })
    });
    assert.equal(invalid.status, 400);
    assert.equal(storedProfile, null);

    const saved = await fetch(baseUrl + "/api/company", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000",
        "Cookie": cookie
      },
      body: JSON.stringify({
        businessName: "FNSC Marketing",
        tradeName: "FNSC",
        contactEmail: "contato@example.com",
        phone: "+55 11 99999-0000",
        website: "https://example.com",
        timezone: "America/Sao_Paulo"
      })
    });
    assert.equal(saved.status, 200);
    assert.deepEqual((await saved.json()).profile, {
      id: 1,
      businessName: "FNSC Marketing",
      tradeName: "FNSC",
      contactEmail: "contato@example.com",
      phone: "+55 11 99999-0000",
      website: "https://example.com",
      timezone: "America/Sao_Paulo"
    });

    const after = await fetch(baseUrl + "/api/company", { headers: { "Cookie": cookie } });
    assert.equal(after.status, 200);
    assert.deepEqual((await after.json()).profile.businessName, "FNSC Marketing");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("company profile cannot be read without authentication", async () => {
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
    const response = await fetch("http://127.0.0.1:" + server.address().port + "/api/company");
    assert.equal(response.status, 401);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});