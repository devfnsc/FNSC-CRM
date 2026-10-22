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

module.exports = { createProposalsRouter, validateProposal, toCents, fromCents };
