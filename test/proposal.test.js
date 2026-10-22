const { test } = require("node:test");
const assert = require("node:assert/strict");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { createApp } = require("../src/server");

async function createServer({ authenticated = true } = {}) {
  const password = "correct-horse-battery-93";
  const passwordHash = await bcrypt.hash(password, 4);
  const stored = { proposals: [], items: [] };
  const user = { id: 7, email: "admin@example.com" };
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (query, values = []) => {
      if (query.includes("FROM customers WHERE id")) return [[{ id: values[0] }], []];
      if (query.includes("FROM services WHERE id")) {
        const services = { "10": { id: 10, name: "Gestão de redes sociais", description: "Conteúdo mensal." },
          "11": { id: 11, name: "Anúncios digitais", description: "Planejamento de mídia." } };
        return [[services[String(values[0])]].filter(Boolean), []];
      }
      if (query.includes("INSERT INTO proposals")) {
        const [customerId, title, validUntil, notes, total] = values;
        const proposal = { id: 1, customer_id: customerId, title, status: "draft", valid_until: validUntil, notes, total, created_at: "2026-10-22T14:00:00.000Z" };
        stored.proposals.push(proposal);
        return [{ insertId: proposal.id }, []];
      }
      if (query.includes("INSERT INTO proposal_items")) {
        stored.items.push(values);
        return [{ insertId: stored.items.length }, []];
      }
      throw new Error("Unexpected transaction SQL: " + query);
    }
  };
  const pool = {
    execute: async (query, values = []) => {
      if (query.includes("password_hash")) return [[{ ...user, password_hash: passwordHash }], []];
      if (query.includes("FROM users WHERE id")) return [[user], []];
      if (query.includes("FROM proposals p JOIN customers") && query.includes("WHERE p.id = ?")) {
        const proposal = stored.proposals.find((item) => String(item.id) === String(values[0]));
        return [proposal ? [{
          id: proposal.id,
          title: proposal.title,
          status: proposal.status,
          valid_until: proposal.valid_until,
          notes: proposal.notes,
          total: proposal.total,
          created_at: proposal.created_at,
          customer_name: "Ana Souza",
          customer_company: "Agência Exemplo",
          customer_email: "ana@example.com",
          customer_phone: "11999990000"
        }] : [], []];
      }
      if (query.includes("FROM proposal_items WHERE proposal_id")) {
        return [stored.items.map((item) => ({
          service_name: item[2],
          description: item[3],
          quantity: item[4],
          unit_price: item[5],
          line_total: item[6]
        })), []];
      }
      if (query.includes("FROM proposals p JOIN customers")) {
        return [stored.proposals.map((proposal) => ({
          id: proposal.id,
          title: proposal.title,
          status: proposal.status,
          valid_until: proposal.valid_until,
          total: proposal.total,
          created_at: proposal.created_at,
          customer_name: "Ana Souza"
        })), []];
      }
      throw new Error("Unexpected pool SQL: " + query);
    },
    getConnection: async () => connection
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
  return { server, baseUrl, cookie, stored };
}

const proposalPayload = {
  customerId: "42",
  title: "Plano de marketing — Q4",
  validUntil: "2026-11-30",
  notes: "Investimento sujeito à aprovação.",
  items: [
    { serviceId: "10", quantity: "2", unitPrice: "100.00" },
    { serviceId: "11", quantity: "1", unitPrice: "50.25" }
  ]
};

test("authenticated owner creates a draft proposal with exact totals", async () => {
  const { server, baseUrl, cookie, stored } = await createServer();
  try {
    const response = await fetch(baseUrl + "/api/proposals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000",
        "Cookie": cookie
      },
      body: JSON.stringify(proposalPayload)
    });
    assert.equal(response.status, 201);
    assert.deepEqual((await response.json()).proposal, {
      id: 1,
      customerId: "42",
      title: "Plano de marketing — Q4",
      status: "draft",
      validUntil: "2026-11-30",
      notes: "Investimento sujeito à aprovação.",
      total: "250.25",
      items: [
        {
          serviceId: "10",
          serviceName: "Gestão de redes sociais",
          description: "Conteúdo mensal.",
          quantity: 2,
          unitPrice: "100.00",
          lineTotal: "200.00"
        },
        {
          serviceId: "11",
          serviceName: "Anúncios digitais",
          description: "Planejamento de mídia.",
          quantity: 1,
          unitPrice: "50.25",
          lineTotal: "50.25"
        }
      ]
    });
    assert.equal(stored.items.length, 2);

    const listed = await fetch(baseUrl + "/api/proposals", { headers: { "Cookie": cookie } });
    assert.equal(listed.status, 200);
    assert.equal((await listed.json()).proposals[0].total, "250.25");

    const detail = await fetch(baseUrl + "/api/proposals/1", { headers: { "Cookie": cookie } });
    assert.equal(detail.status, 200);
    const { proposal: details } = await detail.json();
    assert.equal(details.customer.companyName, "Agência Exemplo");
    assert.equal(details.items[0].serviceName, "Gestão de redes sociais");
    assert.equal(details.items[0].lineTotal, "200.00");

    const printable = await fetch(baseUrl + "/api/proposals/1/print", { headers: { "Cookie": cookie } });
    assert.equal(printable.status, 200);
    assert.match(printable.headers.get("content-type"), /text\/html/u);
    const document = await printable.text();
    assert.match(document, /Imprimir \/ salvar como PDF/u);
    assert.match(document, /Rascunho — não enviada/u);
    assert.match(document, /250,25/u);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("proposal validation rejects invalid or duplicate lines", async () => {
  const { server, baseUrl, cookie } = await createServer();
  try {
    const invalidPayloads = [
      { ...proposalPayload, items: [] },
      { ...proposalPayload, items: [
        { serviceId: "10", quantity: "0", unitPrice: "10.00" }
      ] },
      { ...proposalPayload, items: [
        { serviceId: "10", quantity: "1", unitPrice: "-1.00" }
      ] },
      { ...proposalPayload, items: [
        { serviceId: "10", quantity: "1", unitPrice: "10.00" },
        { serviceId: "10", quantity: "1", unitPrice: "10.00" }
      ] },
      { ...proposalPayload, validUntil: "2026-02-30" }
    ];
    for (const body of invalidPayloads) {
      const response = await fetch(baseUrl + "/api/proposals", {
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

test("proposals require an authenticated session", async () => {
  const { server, baseUrl } = await createServer({ authenticated: false });
  try {
    const listed = await fetch(baseUrl + "/api/proposals");
    assert.equal(listed.status, 401);
    const details = await fetch(baseUrl + "/api/proposals/1");
    assert.equal(details.status, 401);
    const printable = await fetch(baseUrl + "/api/proposals/1/print");
    assert.equal(printable.status, 401);
    const created = await fetch(baseUrl + "/api/proposals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "http://localhost:3000"
      },
      body: JSON.stringify(proposalPayload)
    });
    assert.equal(created.status, 401);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
