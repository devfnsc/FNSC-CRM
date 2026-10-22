const express = require("express");
const { requireAuth, requireSameOrigin } = require("../middleware/auth");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function optionalText(value, maxLength) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (normalized.length > maxLength || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalized)) return undefined;
  return normalized || null;
}

function validDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(value + "T00:00:00.000Z");
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? undefined : value;
}

function validateContract(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const title = optionalText(body.title, 160);
  const effectiveDate = validDate(body.effectiveDate);
  const endDate = validDate(body.endDate);
  const paymentTerms = optionalText(body.paymentTerms, 1000);
  const clauses = optionalText(body.clauses, 10000);
  if (!title || effectiveDate === undefined || endDate === undefined ||
      paymentTerms === undefined || clauses === undefined) return null;
  if (effectiveDate && endDate && endDate < effectiveDate) return null;
  return { title, effectiveDate, endDate, paymentTerms, clauses };
}

function formatMoney(value) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));
}

async function loadContract(pool, id) {
  const [rows] = await pool.execute(
    "SELECT id, proposal_id, customer_id, customer_name, customer_company, customer_email, title, status, " +
    "effective_date, end_date, payment_terms, clauses, total, created_at " +
    "FROM contracts WHERE id = ? LIMIT 1",
    [id]
  );
  if (!rows[0]) return null;
  const [items] = await pool.execute(
    "SELECT service_name, description, quantity, unit_price, line_total " +
    "FROM contract_items WHERE contract_id = ? ORDER BY id",
    [id]
  );
  return {
    id: rows[0].id,
    proposalId: String(rows[0].proposal_id),
    customerId: String(rows[0].customer_id),
    customer: {
      name: rows[0].customer_name,
      companyName: rows[0].customer_company,
      email: rows[0].customer_email
    },
    title: rows[0].title,
    status: rows[0].status,
    effectiveDate: rows[0].effective_date,
    endDate: rows[0].end_date,
    paymentTerms: rows[0].payment_terms,
    clauses: rows[0].clauses,
    total: rows[0].total,
    createdAt: rows[0].created_at,
    items: items.map((item) => ({
      serviceName: item.service_name,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      lineTotal: item.line_total
    }))
  };
}

function renderPrintDocument(contract) {
  const items = contract.items.map((item) => `
    <tr><td><strong>${escapeHtml(item.serviceName)}</strong>${item.description ? `<br>${escapeHtml(item.description)}` : ""}</td>
    <td>${escapeHtml(item.quantity)}</td><td>${escapeHtml(formatMoney(item.unitPrice))}</td><td>${escapeHtml(formatMoney(item.lineTotal))}</td></tr>`).join("");
  const customer = [contract.customer.name, contract.customer.companyName, contract.customer.email].filter(Boolean).map(escapeHtml).join(" · ");
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<script src="/print.js" defer></script><link rel="stylesheet" href="/contract-print.css"><title>${escapeHtml(contract.title)} — Contrato</title>
</head><body>
<div class="toolbar"><button id="print-document" type="button">Imprimir / salvar como PDF</button></div>
<p class="warning">RASCUNHO — revisar o conteúdo e buscar orientação jurídica antes de assinar.</p>
<h1>${escapeHtml(contract.title)}</h1><p>Contrato #${escapeHtml(contract.id)} · Proposta #${escapeHtml(contract.proposalId)}</p>
<h2>Partes</h2><p>${customer}</p>
<h2>Vigência</h2><p>Início: ${escapeHtml(contract.effectiveDate || "a definir")} · Término: ${escapeHtml(contract.endDate || "a definir")}</p>
<h2>Objeto e valores</h2><table><thead><tr><th>Serviço</th><th>Qtd.</th><th>Unitário</th><th>Subtotal</th></tr></thead><tbody>${items}</tbody>
<tfoot><tr><th colspan="3">Total</th><th>${escapeHtml(formatMoney(contract.total))}</th></tr></tfoot></table>
${contract.paymentTerms ? `<h2>Condições de pagamento</h2><pre>${escapeHtml(contract.paymentTerms)}</pre>` : ""}
${contract.clauses ? `<h2>Cláusulas</h2><pre>${escapeHtml(contract.clauses)}</pre>` : ""}
<p>Este documento está salvo como rascunho e não possui assinatura registrada no FNSC-CRM.</p>
</body></html>`;
}

function createContractsRouter({ pool, appOrigin }) {
  const router = express.Router();
  const authenticated = requireAuth(pool);
  const sameOrigin = requireSameOrigin(appOrigin);

  router.get("/", authenticated, async (_req, res, next) => {
    try {
      const [rows] = await pool.execute(
        "SELECT id, title, status, total, customer_name, created_at FROM contracts ORDER BY created_at DESC, id DESC LIMIT 100"
      );
      res.json({ contracts: rows.map((row) => ({
        id: row.id, title: row.title, status: row.status, total: row.total,
        customerName: row.customer_name, createdAt: row.created_at
      })) });
    } catch (error) { next(error); }
  });

  router.post("/from-proposal/:proposalId", sameOrigin, authenticated, async (req, res, next) => {
    let connection;
    try {
      if (!/^[1-9]\d{0,19}$/.test(req.params.proposalId)) return res.status(404).json({ error: "proposal_not_found" });
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [proposals] = await connection.execute(
        "SELECT p.id, p.customer_id, p.title, p.status, p.total, c.name AS customer_name, " +
        "c.company_name AS customer_company, c.email AS customer_email " +
        "FROM proposals p JOIN customers c ON c.id = p.customer_id WHERE p.id = ? FOR UPDATE",
        [req.params.proposalId]
      );
      if (!proposals[0]) {
        await connection.rollback();
        return res.status(404).json({ error: "proposal_not_found" });
      }
      if (proposals[0].status !== "accepted") {
        await connection.rollback();
        return res.status(409).json({ error: "proposal_not_accepted" });
      }
      const [existing] = await connection.execute("SELECT id FROM contracts WHERE proposal_id = ? LIMIT 1", [req.params.proposalId]);
      if (existing[0]) {
        await connection.rollback();
        return res.status(409).json({ error: "contract_already_exists", contractId: existing[0].id });
      }
      const [items] = await connection.execute(
        "SELECT service_name, description, quantity, unit_price, line_total FROM proposal_items WHERE proposal_id = ? ORDER BY id",
        [req.params.proposalId]
      );
      if (!items.length) {
        await connection.rollback();
        return res.status(409).json({ error: "proposal_has_no_items" });
      }
      const proposal = proposals[0];
      const [created] = await connection.execute(
        "INSERT INTO contracts (proposal_id, customer_id, customer_name, customer_company, customer_email, title, status, total) " +
        "VALUES (?, ?, ?, ?, ?, ?, 'draft', ?)",
        [proposal.id, proposal.customer_id, proposal.customer_name, proposal.customer_company, proposal.customer_email, proposal.title, proposal.total]
      );
      for (const item of items) {
        await connection.execute(
          "INSERT INTO contract_items (contract_id, service_name, description, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?, ?)",
          [created.insertId, item.service_name, item.description, item.quantity, item.unit_price, item.line_total]
        );
      }
      await connection.commit();
      res.status(201).json({ contract: { id: created.insertId, proposalId: String(proposal.id), title: proposal.title, status: "draft" } });
    } catch (error) {
      if (connection) {
        try { await connection.rollback(); } catch (_rollbackError) { /* retain original error */ }
      }
      if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "contract_already_exists" });
      next(error);
    } finally {
      if (connection) connection.release();
    }
  });

  router.get("/:id/print", authenticated, async (req, res, next) => {
    try {
      if (!/^[1-9]\d{0,19}$/.test(req.params.id)) return res.status(404).send("Contrato não encontrado.");
      const contract = await loadContract(pool, req.params.id);
      if (!contract) return res.status(404).send("Contrato não encontrado.");
      res.set("Cache-Control", "private, no-store");
      res.type("html").send(renderPrintDocument(contract));
    } catch (error) { next(error); }
  });

  router.get("/:id", authenticated, async (req, res, next) => {
    try {
      if (!/^[1-9]\d{0,19}$/.test(req.params.id)) return res.status(404).json({ error: "contract_not_found" });
      const contract = await loadContract(pool, req.params.id);
      if (!contract) return res.status(404).json({ error: "contract_not_found" });
      res.set("Cache-Control", "private, no-store");
      res.json({ contract });
    } catch (error) { next(error); }
  });

  router.put("/:id", sameOrigin, authenticated, async (req, res, next) => {
    let connection;
    try {
      if (!/^[1-9]\d{0,19}$/.test(req.params.id)) return res.status(404).json({ error: "contract_not_found" });
      const contract = validateContract(req.body);
      if (!contract) return res.status(400).json({ error: "invalid_contract" });
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [rows] = await connection.execute("SELECT id, status FROM contracts WHERE id = ? FOR UPDATE", [req.params.id]);
      if (!rows[0]) {
        await connection.rollback();
        return res.status(404).json({ error: "contract_not_found" });
      }
      if (rows[0].status !== "draft") {
        await connection.rollback();
        return res.status(409).json({ error: "contract_not_editable" });
      }
      await connection.execute(
        "UPDATE contracts SET title = ?, effective_date = ?, end_date = ?, payment_terms = ?, clauses = ? WHERE id = ? AND status = 'draft'",
        [contract.title, contract.effectiveDate, contract.endDate, contract.paymentTerms, contract.clauses, req.params.id]
      );
      await connection.commit();
      res.json({ contract: { id: req.params.id, ...contract, status: "draft" } });
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

module.exports = { createContractsRouter, validateContract, renderPrintDocument, loadContract };
