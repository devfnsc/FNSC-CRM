const express = require("express");
const { requireAuth, requireSameOrigin } = require("../middleware/auth");

function optionalText(value, maxLength) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function toCents(value) {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(value)) {
    return null;
  }
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
}

function fromCents(cents) {
  return (cents / 100n).toString() + "." + (cents % 100n).toString().padStart(2, "0");
}

function validDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(value + "T00:00:00.000Z");
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? undefined : value;
}

function validateProposal(body) {
  const title = optionalText(body.title, 160);
  const notes = optionalText(body.notes, 2000);
  const validUntil = validDate(body.validUntil);
  if (!title || notes === undefined || validUntil === undefined) return null;
  if (typeof body.customerId !== "string" || !/^[1-9]\d{0,19}$/.test(body.customerId)) return null;
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) return null;

  const seenServices = new Set();
  const items = [];
  let totalCents = 0n;
  for (const item of body.items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    if (typeof item.serviceId !== "string" || !/^[1-9]\d{0,19}$/.test(item.serviceId)) return null;
    const quantity = typeof item.quantity === "number"
      ? item.quantity
      : (typeof item.quantity === "string" && /^\d{1,4}$/.test(item.quantity) ? Number(item.quantity) : NaN);
    const unitPriceCents = toCents(item.unitPrice);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000 || unitPriceCents === null) return null;
    if (seenServices.has(item.serviceId)) return null;
    seenServices.add(item.serviceId);

    const lineTotalCents = unitPriceCents * BigInt(quantity);
    totalCents += lineTotalCents;
    if (totalCents > 9999999999n) return null;
    items.push({ serviceId: item.serviceId, quantity, unitPriceCents, lineTotalCents });
  }
  return { customerId: body.customerId, title, notes, validUntil, items, totalCents };
}


function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function formatMoney(value) {
  const [whole = "0", fraction = ""] = String(value ?? "0.00").split(".");
  const normalizedFraction = (fraction + "00").slice(0, 2);
  return "R$ " + whole.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ".") + "," + normalizedFraction;
}

async function loadProposal(pool, id) {
  const [rows] = await pool.execute(
    "SELECT p.id, p.title, p.status, p.valid_until, p.notes, p.total, p.created_at, " +
    "c.name AS customer_name, c.company_name AS customer_company, c.email AS customer_email, c.phone AS customer_phone " +
    "FROM proposals p JOIN customers c ON c.id = p.customer_id WHERE p.id = ? LIMIT 1",
    [id]
  );
  if (!rows[0]) return null;
  const [items] = await pool.execute(
    "SELECT service_name, description, quantity, unit_price, line_total " +
    "FROM proposal_items WHERE proposal_id = ? ORDER BY id",
    [id]
  );
  return {
    id: rows[0].id,
    title: rows[0].title,
    status: rows[0].status,
    validUntil: rows[0].valid_until,
    notes: rows[0].notes,
    total: rows[0].total,
    createdAt: rows[0].created_at,
    customer: {
      name: rows[0].customer_name,
      companyName: rows[0].customer_company,
      email: rows[0].customer_email,
      phone: rows[0].customer_phone
    },
    items: items.map((item) => ({
      serviceName: item.service_name,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total
    }))
  };
}

function renderPrintDocument(proposal) {
  const status = proposal.status === "draft" ? "Rascunho — não enviada" : proposal.status;
  const items = proposal.items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.serviceName)}</strong>${item.description ? `<br><span>${escapeHtml(item.description)}</span>` : ""}</td>
      <td class="number">${escapeHtml(item.quantity)}</td>
      <td class="number">${escapeHtml(formatMoney(item.unitPrice))}</td>
      <td class="number">${escapeHtml(formatMoney(item.lineTotal))}</td>
    </tr>`).join("");
  const contact = [proposal.customer.email, proposal.customer.phone].filter(Boolean).map(escapeHtml).join(" · ");
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(proposal.title)} — FNSC-CRM</title>
  <style>
    :root { color: #172033; font: 15px/1.5 system-ui, sans-serif; }
    * { box-sizing: border-box; }
    body { max-width: 850px; margin: 2rem auto; padding: 0 1.5rem; }
    header { display: flex; justify-content: space-between; gap: 2rem; border-bottom: 2px solid #244b9b; padding-bottom: 1rem; }
    h1 { margin: 0 0 .35rem; font-size: 1.8rem; }
    h2 { margin: 1.7rem 0 .4rem; font-size: 1rem; text-transform: uppercase; letter-spacing: .06em; }
    p { margin: .2rem 0; }
    .muted, small { color: #65718a; }
    .status { color: #8a3b2f; font-weight: 700; }
    table { width: 100%; margin-top: 1rem; border-collapse: collapse; }
    th, td { padding: .7rem .45rem; border-bottom: 1px solid #dce2eb; text-align: left; vertical-align: top; }
    th { background: #f2f5fa; }
    .number { text-align: right; white-space: nowrap; }
    tfoot td { border: 0; font-size: 1.15rem; font-weight: 800; }
    .notes { white-space: pre-wrap; }
    .toolbar { margin-bottom: 1.5rem; }
    button { padding: .7rem 1rem; border: 0; border-radius: .4rem; background: #244b9b; color: white; font: inherit; cursor: pointer; }
    @page { margin: 18mm; }
    @media print { body { max-width: none; margin: 0; padding: 0; } .toolbar { display: none; } }
  </style>
</head>
<body>
  <div class="toolbar"><button type="button" onclick="window.print()">Imprimir / salvar como PDF</button></div>
  <header>
    <div><p class="muted">FNSC-CRM · proposta comercial</p><h1>${escapeHtml(proposal.title)}</h1><p class="status">${escapeHtml(status)}</p></div>
    <div><p><strong>Proposta #${escapeHtml(proposal.id)}</strong></p><p>Emitida em ${escapeHtml(String(proposal.createdAt).slice(0, 10))}</p><p>Válida até: ${escapeHtml(proposal.validUntil || "não informada")}</p></div>
  </header>
  <section><h2>Cliente</h2><p><strong>${escapeHtml(proposal.customer.name)}</strong></p>
    ${proposal.customer.companyName ? `<p>${escapeHtml(proposal.customer.companyName)}</p>` : ""}
    ${contact ? `<p class="muted">${contact}</p>` : ""}
  </section>
  <section><h2>Serviços e investimento</h2>
    <table><thead><tr><th>Serviço</th><th class="number">Qtd.</th><th class="number">Valor unitário</th><th class="number">Subtotal</th></tr></thead>
      <tbody>${items}</tbody><tfoot><tr><td colspan="3" class="number">Total</td><td class="number">${escapeHtml(formatMoney(proposal.total))}</td></tr></tfoot>
    </table>
  </section>
  ${proposal.notes ? `<section><h2>Observações</h2><p class="notes">${escapeHtml(proposal.notes)}</p></section>` : ""}
  <p class="muted" style="margin-top:2rem">Documento de revisão gerado pelo FNSC-CRM. Esta proposta permanece como rascunho e não foi enviada ao cliente.</p>
</body>
</html>`;
}

function createProposalsRouter({ pool, appOrigin }) {
  const router = express.Router();
  const authenticated = requireAuth(pool);
  const sameOrigin = requireSameOrigin(appOrigin);

  router.get("/", authenticated, async (_req, res, next) => {
    try {
      const [rows] = await pool.execute(
        "SELECT p.id, p.title, p.status, p.valid_until, p.total, p.created_at, c.name AS customer_name " +
        "FROM proposals p JOIN customers c ON c.id = p.customer_id " +
        "ORDER BY p.created_at DESC, p.id DESC LIMIT 100"
      );
      res.json({
        proposals: rows.map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status,
          validUntil: row.valid_until,
          total: row.total,
          createdAt: row.created_at,
          customerName: row.customer_name
        }))
      });
    } catch (error) {
      next(error);
    }
  });


  router.get("/:id/print", authenticated, async (req, res, next) => {
    try {
      if (!/^[1-9]\\d{0,19}$/.test(req.params.id)) return res.status(404).send("Proposta não encontrada.");
      const proposal = await loadProposal(pool, req.params.id);
      if (!proposal) return res.status(404).send("Proposta não encontrada.");
      res.set("Cache-Control", "private, no-store");
      res.type("html").send(renderPrintDocument(proposal));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", authenticated, async (req, res, next) => {
    try {
      if (!/^[1-9]\\d{0,19}$/.test(req.params.id)) return res.status(404).json({ error: "proposal_not_found" });
      const proposal = await loadProposal(pool, req.params.id);
      if (!proposal) return res.status(404).json({ error: "proposal_not_found" });
      res.set("Cache-Control", "private, no-store");
      res.json({ proposal });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", sameOrigin, authenticated, async (req, res, next) => {
    let connection;
    try {
      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({ error: "invalid_proposal" });
      }
      const proposal = validateProposal(req.body);
      if (!proposal) return res.status(400).json({ error: "invalid_proposal" });

      connection = await pool.getConnection();
      await connection.beginTransaction();

      const [customers] = await connection.execute(
        "SELECT id FROM customers WHERE id = ? AND archived_at IS NULL LIMIT 1",
        [proposal.customerId]
      );
      if (!customers[0]) {
        await connection.rollback();
        return res.status(400).json({ error: "customer_not_active" });
      }

      const items = [];
      for (const item of proposal.items) {
        const [services] = await connection.execute(
          "SELECT id, name, description FROM services WHERE id = ? LIMIT 1",
          [item.serviceId]
        );
        if (!services[0]) {
          await connection.rollback();
          return res.status(400).json({ error: "service_not_found" });
        }
        items.push({
          serviceId: item.serviceId,
          serviceName: services[0].name,
          description: services[0].description,
          quantity: item.quantity,
          unitPrice: fromCents(item.unitPriceCents),
          lineTotal: fromCents(item.lineTotalCents)
        });
      }

      const [result] = await connection.execute(
        "INSERT INTO proposals (customer_id, title, status, valid_until, notes, total) VALUES (?, ?, 'draft', ?, ?, ?)",
        [proposal.customerId, proposal.title, proposal.validUntil, proposal.notes, fromCents(proposal.totalCents)]
      );
      for (const item of items) {
        await connection.execute(
          "INSERT INTO proposal_items (proposal_id, service_id, service_name, description, quantity, unit_price, line_total) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?)",
          [result.insertId, item.serviceId, item.serviceName, item.description, item.quantity, item.unitPrice, item.lineTotal]
        );
      }
      await connection.commit();
      res.status(201).json({
        proposal: {
          id: result.insertId,
          customerId: proposal.customerId,
          title: proposal.title,
          status: "draft",
          validUntil: proposal.validUntil,
          notes: proposal.notes,
          total: fromCents(proposal.totalCents),
          items
        }
      });
    } catch (error) {
      if (connection) {
        try { await connection.rollback(); } catch (_rollbackError) { /* retain original error */ }
      }
      next(error);
    } finally {
      if (connection) connection.release();
    }
  });

  return router;
}

module.exports = { createProposalsRouter, validateProposal, toCents, fromCents, escapeHtml, formatMoney, renderPrintDocument };
