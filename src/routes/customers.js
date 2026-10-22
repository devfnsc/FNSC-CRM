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

function createCustomersRouter({ pool, appOrigin }) {
  const router = express.Router();
  const authenticated = requireAuth(pool);
  const sameOrigin = requireSameOrigin(appOrigin);

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
