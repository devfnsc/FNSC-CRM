const { test } = require("node:test");
const assert = require("node:assert/strict");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { createApp } = require("../src/server");

async function createServer({ archived = false, authenticated = true } = {}) {
  const user = { id: 7, email: "admin@example.com" };
  const password = "correct-horse-battery-93";
  const passwordHash = await bcrypt.hash(password, 4);
  const customer = { id: 42, archived_at: archived ? "2026-10-01" : null };
  const activities = [];
  const pool = {
    execute: async (query, values = []) => {
      if (query.includes("password_hash")) return [[{ ...user, password_hash: passwordHash }], []];
      if (query.includes("FROM users WHERE id")) return [[user], []];
      if (query.includes("SELECT id, archived_at FROM customers")) {
        return [String(customer.id) === String(values[0]) ? [customer] : [], []];
      }
      if (query.includes("FROM customer_activities a LEFT JOIN users")) {
        return [activities.filter((item) => String(item.customer_id) === String(values[0])).map((item) => ({
          ...item, created_by_email: user.email,
          follow_up_completed_by_email: item.follow_up_completed_by ? user.email : null
        })), []];
      }
      if (query.includes("INSERT INTO customer_activities")) {
        const [customerId, type, summary, occurredOn, followUpDate, followUpStatus, createdBy] = values;
        const activity = { id: activities.length + 1, customer_id: Number(customerId), type, summary,
          occurred_on: occurredOn, follow_up_date: followUpDate, follow_up_status: followUpStatus,
          follow_up_completed_at: null, created_by: createdBy, follow_up_completed_by: null };
        activities.push(activity);
        return [{ insertId: activity.id }, []];
      }
      if (query.includes("UPDATE customer_activities SET follow_up_status")) {
        const [userId, id] = values;
        const activity = activities.find((item) => String(item.id) === String(id));
        if (!activity || !activity.follow_up_date || activity.follow_up_status !== "pending") return [{ affectedRows: 0 }, []];
        Object.assign(activity, { follow_up_status: "completed", follow_up_completed_by: userId,
          follow_up_completed_at: "2026-10-22T12:00:00.000Z" });
        return [{ affectedRows: 1 }, []];
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
  return { server, baseUrl, cookie, activities };
}

test("customer interactions and follow-ups are recorded and completed", async () => {
  const { server, baseUrl, cookie, activities } = await createServer();
  try {
    const created = await fetch(baseUrl + "/api/customer-activities/customers/42/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
      body: JSON.stringify({
        type: "meeting", summary: "Apresentamos o plano de onboarding.",
        occurredOn: "2026-10-20", followUpDate: "2026-10-28"
      })
    });
    assert.equal(created.status, 201);
    assert.equal(activities[0].follow_up_status, "pending");

    const listed = await fetch(baseUrl + "/api/customer-activities/customers/42/activities", {
      headers: { Cookie: cookie }
    });
    const data = await listed.json();
    assert.equal(listed.status, 200);
    assert.equal(data.activities[0].summary, "Apresentamos o plano de onboarding.");

    const completed = await fetch(baseUrl + "/api/customer-activities/activities/1/follow-up", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
      body: JSON.stringify({ status: "completed" })
    });
    assert.equal(completed.status, 200);
    assert.equal(activities[0].follow_up_status, "completed");
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("activity fields are validated and archived customers cannot receive new logs", async () => {
  const active = await createServer();
  try {
    const invalid = await fetch(active.baseUrl + "/api/customer-activities/customers/42/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: active.cookie },
      body: JSON.stringify({ type: "unknown", summary: "", occurredOn: "2026-02-30", followUpDate: "" })
    });
    assert.equal(invalid.status, 400);
  } finally {
    await new Promise((resolve, reject) => active.server.close((error) => error ? reject(error) : resolve()));
  }

  const archived = await createServer({ archived: true });
  try {
    const response = await fetch(archived.baseUrl + "/api/customer-activities/customers/42/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: archived.cookie },
      body: JSON.stringify({ type: "email", summary: "Seguimento", occurredOn: "2026-10-22", followUpDate: "" })
    });
    assert.equal(response.status, 409);
  } finally {
    await new Promise((resolve, reject) => archived.server.close((error) => error ? reject(error) : resolve()));
  }
});
