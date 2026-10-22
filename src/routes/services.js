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

function validateService(body) {
  const name = optionalText(body.name, 120);
  const description = optionalText(body.description, 2000);
  const rawPrice = body.referencePrice;

  if (!name || description === undefined) return null;
  let referencePrice = null;
  if (rawPrice !== undefined && rawPrice !== null && rawPrice !== "") {
    if (typeof rawPrice !== "string" || !/^(?:0|[1-9]\d{0,7})(?:\.\d{1,2})?$/.test(rawPrice)) {
      return null;
    }
    referencePrice = rawPrice.includes(".") ? rawPrice : rawPrice + ".00";
    if (referencePrice.split(".")[1].length === 1) referencePrice += "0";
  }
  return { name, description, referencePrice };
}

function asService(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    referencePrice: row.reference_price
  };
}

function createServicesRouter({ pool, appOrigin }) {
  const router = express.Router();
  const authenticated = requireAuth(pool);
  const sameOrigin = requireSameOrigin(appOrigin);

  router.get("/", authenticated, async (_req, res, next) => {
    try {
      const [rows] = await pool.execute(
        "SELECT id, name, description, reference_price FROM services ORDER BY name ASC, id ASC"
      );
      res.json({ services: rows.map(asService) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", sameOrigin, authenticated, async (req, res, next) => {
    try {
      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({ error: "invalid_service" });
      }
      const service = validateService(req.body);
      if (!service) return res.status(400).json({ error: "invalid_service" });

      const [result] = await pool.execute(
        "INSERT INTO services (name, description, reference_price) VALUES (?, ?, ?)",
        [service.name, service.description, service.referencePrice]
      );
      res.status(201).json({
        service: {
          id: result.insertId,
          ...service
        }
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createServicesRouter, validateService };
