const assert = require("node:assert/strict");

const origin = process.env.APP_ORIGIN || "http://127.0.0.1:3000";
const email = process.env.CRM_DEMO_EMAIL || "demo@fnsc.local";
const password = process.env.CRM_DEMO_PASSWORD || "local-demo-password-123";

async function waitForApp() {
  for (let attempt = 1; attempt <= 45; attempt += 1) {
    try {
      const response = await fetch(origin + "/", { signal: AbortSignal.timeout(2000) });
      if (response.ok) return response;
    } catch (_error) {
      // The app container may still be installing dependencies or applying migrations.
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("The local CRM demo did not become ready within 45 seconds.");
}

async function main() {
  const page = await waitForApp();
  const loginPage = await page.text();
  assert.match(loginPage, /id="login-form"/u, "login page should be served");

  const login = await fetch(origin + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email, password })
  });
  assert.equal(login.status, 200, "demo account should be able to log in");
  const cookieHeader = login.headers.get("set-cookie");
  assert.ok(cookieHeader, "login should create a session cookie");
  const cookie = cookieHeader.split(";")[0];

  const dashboard = await fetch(origin + "/app", { headers: { Cookie: cookie } });
  assert.equal(dashboard.status, 200, "authenticated dashboard should load");

  const create = await fetch(origin + "/api/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: cookie
    },
    body: JSON.stringify({
      name: "Cliente de demonstração",
      companyName: "Empresa de teste local",
      email: "cliente-demo@example.test",
      phone: "",
      notes: "Registro descartável para validar a demonstração local."
    })
  });
  assert.equal(create.status, 201, "customer should be created");
  const { customer } = await create.json();
  assert.ok(customer && customer.id, "created customer should have an ID");

  const list = await fetch(origin + "/api/customers?q=Cliente%20de%20demonstra%C3%A7%C3%A3o", {
    headers: { Cookie: cookie }
  });
  assert.equal(list.status, 200);
  assert.match(await list.text(), /Cliente de demonstração/u, "customer should appear in search");

  const archive = await fetch(origin + "/api/customers/" + customer.id + "/archive", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie },
    body: "{}"
  });
  assert.equal(archive.status, 200, "customer should be archivable");

  const restore = await fetch(origin + "/api/customers/" + customer.id + "/restore", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie },
    body: "{}"
  });
  assert.equal(restore.status, 200, "customer should be restorable");

  const logout = await fetch(origin + "/api/auth/logout", {
    method: "POST",
    headers: { Origin: origin, Cookie: cookie }
  });
  assert.equal(logout.status, 204, "logout should destroy the session");

  const protectedPage = await fetch(origin + "/app", { headers: { Cookie: cookie } });
  assert.equal(protectedPage.status, 401, "dashboard should be protected after logout");

  console.log("Local demo smoke test passed: login, protected dashboard, customer create/search/archive/restore, and logout.");
}

main().catch((error) => {
  console.error("Local demo smoke test failed:", error.message);
  process.exitCode = 1;
});
