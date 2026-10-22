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

function validateCustomer(body) {
  const name = optionalText(body.name, 120);
  const companyName = optionalText(body.companyName, 120);
  const email = optionalText(body.email, 254);
  const phone = optionalText(body.phone, 32);
  const notes = optionalText(body.notes, 2000);

  if (!name) return null;
  if (companyName === undefined || email === undefined || phone === undefined || notes === undefined) return null;
  if (!email && !phone) return null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

  return { name, companyName, email, phone, notes };
}

function asCustomer(row, includeNotes = false) {
  const customer = {
    id: row.id,
    name: row.name,
    companyName: row.company_name,
    email: row.email,
    phone: row.phone,
    createdAt: row.created_at
  };
  if (includeNotes) {
    customer.notes = row.notes;
    customer.updatedAt = row.updated_at;
  }
  return customer;
}

function createCustomersRouter({ pool, appOrigin }) {
  const router = express.Router();
  const authenticated = requireAuth(pool);
  const sameOrigin = requireSameOrigin(appOrigin);

  router.get("/", authenticated, async (req, res, next) => {
    try {
      const page = req.query.page === undefined ? 1 : Number(req.query.page);
      const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);
      const rawSearch = req.query.q === undefined ? "" : req.query.q;
      if (typeof rawSearch !== "string") {
        return res.status(400).json({ error: "invalid_customer_query" });
      }
      const search = rawSearch.trim();

      if (!Number.isSafeInteger(page) || page < 1 ||
          !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
          search.length > 120) {
        return res.status(400).json({ error: "invalid_customer_query" });
      }

      const offset = (page - 1) * limit;
      if (!Number.isSafeInteger(offset)) {
        return res.status(400).json({ error: "invalid_customer_query" });
      }

      let sql = "SELECT id, name, company_name, email, phone, created_at FROM customers";
      const values = [];
      if (search) {
        sql += " WHERE name LIKE ? OR company_name LIKE ? OR email LIKE ? OR phone LIKE ?";
        const term = "%" + search + "%";
        values.push(term, term, term, term);
      }
      sql += " ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?";
      values.push(limit + 1, offset);

      const [rows] = await pool.execute(sql, values);
      const hasMore = rows.length > limit;
      res.json({
        customers: rows.slice(0, limit).map((row) => asCustomer(row)),
        page,
        limit,
        hasMore
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", authenticated, async (req, res, next) => {
    try {
      if (!/^[1-9]\d{0,19}$/.test(req.params.id)) {
        return res.status(400).json({ error: "invalid_customer_id" });
      }
      const [rows] = await pool.execute(
        "SELECT id, name, company_name, email, phone, notes, created_at, updated_at FROM customers WHERE id = ? LIMIT 1",
        [req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: "customer_not_found" });
      res.json({ customer: asCustomer(rows[0], true) });
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id", sameOrigin, authenticated, async (req, res, next) => {
    try {
      if (!/^[1-9]\d{0,19}$/.test(req.params.id)) {
        return res.status(400).json({ error: "invalid_customer_id" });
      }
      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({ error: "invalid_customer" });
      }
      const customer = validateCustomer(req.body);
      if (!customer) return res.status(400).json({ error: "invalid_customer" });

      await pool.execute(
        "UPDATE customers SET name = ?, company_name = ?, email = ?, phone = ?, notes = ? WHERE id = ?",
        [customer.name, customer.companyName, customer.email, customer.phone, customer.notes, req.params.id]
      );
      const [rows] = await pool.execute(
        "SELECT id, name, company_name, email, phone, notes, created_at, updated_at FROM customers WHERE id = ? LIMIT 1",
        [req.params.id]
      );
      if (!rows[0]) return res.status(404).json({ error: "customer_not_found" });
      res.json({ customer: asCustomer(rows[0], true) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", sameOrigin, authenticated, async (req, res, next) => {
    try {
      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({ error: "invalid_customer" });
      }
      const customer = validateCustomer(req.body);
      if (!customer) return res.status(400).json({ error: "invalid_customer" });

      const [result] = await pool.execute(
        "INSERT INTO customers (name, company_name, email, phone, notes) VALUES (?, ?, ?, ?, ?)",
        [customer.name, customer.companyName, customer.email, customer.phone, customer.notes]
      );
      res.status(201).json({
        customer: {
          id: result.insertId,
          name: customer.name,
          companyName: customer.companyName,
          email: customer.email,
          phone: customer.phone,
          notes: customer.notes
        }
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createCustomersRouter, validateCustomer };
