const { test } = require("node:test");
const assert = require("node:assert/strict");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { createApp } = require("../src/server");

async function createServer({ authenticated = true, proposalStatus = "accepted" } = {}) {
  const password = "correct-horse-battery-93";
  const passwordHash = await bcrypt.hash(password, 4);
  const user = { id: 7, email: "admin@example.com" };
  const state = {
    proposal: {
      id: 3, customer_id: 42, title: "Plano de marketing", status: proposalStatus, total: "250.25",
      customer_name: "Ana Souza", customer_company: "Agência Exemplo", customer_email: "ana@example.com"
    },
    proposalItems: [
      { service_name: "Gestão de redes sociais", description: "Conteúdo mensal.", quantity: 2, unit_price: "100.00", line_total: "200.00" },
      { service_name: "Anúncios digitais", description: "Mídia paga.", quantity: 1, unit_price: "50.25", line_total: "50.25" }
    ],
    contract: null,
    items: [], revisions: []
  };
  const connection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release: () => {},
    execute: async (query, values = []) => {
      if (query.includes("FROM proposals p JOIN customers")) {
        return state.proposal ? [[{ ...state.proposal }], []] : [[], []];
      }
      if (query.includes("SELECT id FROM contracts WHERE proposal_id")) {
        return [[state.contract ? { id: state.contract.id } : undefined].filter(Boolean), []];
      }
      if (query.includes("FROM proposal_items WHERE proposal_id")) return [state.proposalItems, []];
      if (query.includes("INSERT INTO contracts")) {
        const [proposalId, customerId, customerName, customerCompany, customerEmail, title, total] = values;
        state.contract = {
          id: 9, proposal_id: proposalId, customer_id: customerId, customer_name: customerName,
          customer_company: customerCompany, customer_email: customerEmail, title, status: "draft",
          effective_date: null, end_date: null, payment_terms: null, clauses: null, total
        };
        return [{ insertId: state.contract.id }, []];
      }
      if (query.includes("INSERT INTO contract_revisions")) { state.revisions.push(values); return [{ insertId: state.revisions.length }, []]; }
      if (query.includes("SELECT COALESCE(MAX(revision_number)")) return [[{ latest_revision: state.revisions.length }], []];
      if (query.includes("INSERT INTO contract_items")) {
        state.items.push(values);
        return [{ insertId: state.items.length }, []];
      }
      if (query.includes("FROM contracts WHERE id = ? FOR UPDATE")) {
        return [state.contract ? [{ ...state.contract }] : [], []];
      }
      if (query.includes("UPDATE contracts SET")) {
        const [title, effectiveDate, endDate, paymentTerms, clauses] = values;
        Object.assign(state.contract, { title, effective_date: effectiveDate, end_date: endDate, payment_terms: paymentTerms, clauses });
        return [{ affectedRows: 1 }, []];
      }
      throw new Error("Unexpected connection SQL: " + query);
    }
  };
  const pool = {
    execute: async (query, values = []) => {
      if (query.includes("password_hash")) return [[{ ...user, password_hash: passwordHash }], []];
      if (query.includes("FROM users WHERE id")) return [[user], []];
      if (query.includes("FROM contracts WHERE id")) {
        return [state.contract && String(state.contract.id) === String(values[0]) ? [{ ...state.contract }] : [], []];
      }
      if (query.includes("FROM contract_revisions")) return [state.revisions.map((v, i) => ({
        revision_number: i + 1, title: v[2], effective_date: v[3], end_date: v[4], payment_terms: v[5],
        clauses: v[6], total: v[7], created_at: "2026-10-22", created_by_email: "admin@example.com"
      })), []];
      if (query.includes("FROM contract_items WHERE contract_id")) {
        return [state.items.map((item) => ({
          service_name: item[1], description: item[2], quantity: item[3], unit_price: item[4], line_total: item[5]
        })), []];
      }
      if (query.includes("FROM contracts ORDER BY")) {
        return [state.contract ? [{
          id: state.contract.id, title: state.contract.title, status: state.contract.status,
          total: state.contract.total, customer_name: state.contract.customer_name, created_at: "2026-10-22"
        }] : [], []];
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
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({ email: user.email, password })
    });
    assert.equal(login.status, 200);
    cookie = login.headers.get("set-cookie").split(";")[0];
  }
  return { server, baseUrl, cookie, state };
}

test("accepted proposal creates an editable, print-ready contract draft", async () => {
  const { server, baseUrl, cookie, state } = await createServer();
  try {
    const created = await fetch(baseUrl + "/api/contracts/from-proposal/3", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
      body: "{}"
    });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).contract.status, "draft");
    assert.equal(state.items.length, 2);
    assert.equal(state.revisions.length, 1);

    const duplicate = await fetch(baseUrl + "/api/contracts/from-proposal/3", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
      body: "{}"
    });
    assert.equal(duplicate.status, 409);

    const listed = await fetch(baseUrl + "/api/contracts", { headers: { Cookie: cookie } });
    assert.equal(listed.status, 200);
    assert.equal((await listed.json()).contracts[0].customerName, "Ana Souza");

    const details = await fetch(baseUrl + "/api/contracts/9", { headers: { Cookie: cookie } });
    assert.equal(details.status, 200);
    const { contract } = await details.json();
    assert.equal(contract.items.length, 2);
    assert.equal(contract.total, "250.25");

    const updated = await fetch(baseUrl + "/api/contracts/9", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
      body: JSON.stringify({
        title: "Contrato de serviços",
        effectiveDate: "2026-11-01",
        endDate: "2027-10-31",
        paymentTerms: "50% no início.",
        clauses: "Escopo aprovado. Texto <script> permanece como texto."
      })
    });
    assert.equal(updated.status, 200);
    assert.equal(state.contract.clauses.includes("<script>"), true);
    assert.equal(state.revisions.length, 2);
    assert.equal(state.revisions[1][6].includes("<script>"), true);
    const historyResponse = await fetch(baseUrl + "/api/contracts/9", { headers: { Cookie: cookie } });
    const history = (await historyResponse.json()).contract.revisions;
    assert.equal(history.length, 2);
    assert.equal(history[0].title, "Plano de marketing");
    assert.equal(history[1].title, "Contrato de serviços");
    const noOp = await fetch(baseUrl + "/api/contracts/9", {
      method: "PUT", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
      body: JSON.stringify({ title: "Contrato de serviços", effectiveDate: "2026-11-01", endDate: "2027-10-31",
        paymentTerms: "50% no início.", clauses: "Escopo aprovado. Texto <script> permanece como texto." })
    });
    assert.equal(noOp.status, 200);
    assert.equal(state.revisions.length, 2);

    const printable = await fetch(baseUrl + "/api/contracts/9/print", { headers: { Cookie: cookie } });
    assert.equal(printable.status, 200);
    const html = await printable.text();
    assert.match(html, /RASCUNHO — revisar/u);
    assert.match(html, /&lt;script&gt;/u);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("only accepted proposals can create contracts and dates are validated", async () => {
  const { server, baseUrl, cookie } = await createServer({ proposalStatus: "draft" });
  try {
    const response = await fetch(baseUrl + "/api/contracts/from-proposal/3", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
      body: "{}"
    });
    assert.equal(response.status, 409);

    const invalid = await fetch(baseUrl + "/api/contracts/9", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
      body: JSON.stringify({ title: "Contrato", effectiveDate: "2027-12-01", endDate: "2027-01-01" })
    });
    assert.equal(invalid.status, 400);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("contract endpoints require authentication", async () => {
  const { server, baseUrl } = await createServer({ authenticated: false });
  try {
    const listed = await fetch(baseUrl + "/api/contracts");
    assert.equal(listed.status, 401);
    const created = await fetch(baseUrl + "/api/contracts/from-proposal/3", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: "{}"
    });
    assert.equal(created.status, 401);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
