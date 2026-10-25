const express = require("express");
const { requireAuth, requireSameOrigin } = require("../middleware/auth");

function cleanText(value, maxLength, required = false) {
  if (value === undefined || value === null || value === "") return required ? null : null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) return undefined;
  return normalized || null;
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1000) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateFinanceEntry(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const type = body.type;
  const description = cleanText(body.description, 160, true);
  const category = cleanText(body.category, 80, true);
  const notes = cleanText(body.notes, 1000);
  const occurredOn = body.occurredOn;
  const amount = body.amount;
  if ((type !== "income" && type !== "expense") || !description || !category ||
      notes === undefined || !validDate(occurredOn) || typeof amount !== "string" ||
      !/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 ||
      Number(amount) > 99999999.99) return null;
  const normalizedAmount = amount.includes(".") ? amount : amount + ".00";
  return {
    type, description, category, notes, occurredOn,
    amount: normalizedAmount.includes(".") && normalizedAmount.split(".")[1].length === 1
      ? normalizedAmount + "0" : normalizedAmount
  };
}

function monthRange(month) {
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 1000) return null;
  const [year, monthNumber] = month.split("-").map(Number);
  const nextYear = monthNumber === 12 ? year + 1 : year;
  const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
  return { start: month + "-01", end: nextYear + "-" + String(nextMonth).padStart(2, "0") + "-01" };
}

function mapTransaction(row) {
  return {
    id: row.id, type: row.type, description: row.description, category: row.category,
    amount: row.amount, occurredOn: row.occurred_on, notes: row.notes,
    createdAt: row.created_at, updatedAt: row.updated_at
  };
}

function createFinanceRouter({ pool, appOrigin }) {
  const router = express.Router();
  const authenticated = requireAuth(pool);
  const sameOrigin = requireSameOrigin(appOrigin);

  router.get("/", authenticated, async (req, res, next) => {
    try {
      const month = req.query.month || new Date().toISOString().slice(0, 7);
      const range = monthRange(month);
      if (!range) return res.status(400).json({ error: "invalid_month" });
      const [summary] = await pool.execute(
        "SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income, " +
        "COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expenses " +
        "FROM finance_transactions WHERE occurred_on >= ? AND occurred_on < ?",
        [range.start, range.end]
      );
      const [rows] = await pool.execute(
        "SELECT id, type, description, category, amount, occurred_on, notes, created_at, updated_at " +
        "FROM finance_transactions WHERE occurred_on >= ? AND occurred_on < ? " +
        "ORDER BY occurred_on DESC, id DESC LIMIT 500",
        [range.start, range.end]
      );
      res.set("Cache-Control", "private, no-store");
      res.json({
        month,
        summary: { income: summary[0].income, expenses: summary[0].expenses,
          balance: (Number(summary[0].income) - Number(summary[0].expenses)).toFixed(2) },
        transactions: rows.map(mapTransaction),
        limit: 500
      });
    } catch (error) { next(error); }
  });

  router.post("/", sameOrigin, authenticated, async (req, res, next) => {
    try {
      const entry = validateFinanceEntry(req.body);
      if (!entry) return res.status(400).json({ error: "invalid_finance_entry" });
      const [result] = await pool.execute(
        "INSERT INTO finance_transactions (type, description, category, amount, occurred_on, notes, created_by, updated_by) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [entry.type, entry.description, entry.category, entry.amount, entry.occurredOn, entry.notes, req.user.id, req.user.id]
      );
      res.status(201).json({ transaction: { id: result.insertId, ...entry } });
    } catch (error) { next(error); }
  });

  router.put("/:id", sameOrigin, authenticated, async (req, res, next) => {
    try {
      if (!/^[1-9]\d{0,19}$/.test(req.params.id)) return res.status(404).json({ error: "finance_entry_not_found" });
      const entry = validateFinanceEntry(req.body);
      if (!entry) return res.status(400).json({ error: "invalid_finance_entry" });
      const [result] = await pool.execute(
        "UPDATE finance_transactions SET type = ?, description = ?, category = ?, amount = ?, occurred_on = ?, notes = ?, updated_by = ? WHERE id = ?",
        [entry.type, entry.description, entry.category, entry.amount, entry.occurredOn, entry.notes, req.user.id, req.params.id]
      );
      const [rows] = await pool.execute("SELECT id FROM finance_transactions WHERE id = ? LIMIT 1", [req.params.id]);
      if (!rows[0]) return res.status(404).json({ error: "finance_entry_not_found" });
      res.json({ transaction: { id: req.params.id, ...entry } });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = { createFinanceRouter, validateFinanceEntry, monthRange };
