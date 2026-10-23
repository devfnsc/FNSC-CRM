const express = require("express");
const { requireAuth, requireSameOrigin } = require("../middleware/auth");

const PROFILE_COLUMNS = "id, business_name, trade_name, contact_email, phone, website, timezone";

function asProfile(row) {
  return {
    id: row.id,
    businessName: row.business_name,
    tradeName: row.trade_name,
    contactEmail: row.contact_email,
    phone: row.phone,
    website: row.website,
    timezone: row.timezone
  };
}

function optionalText(value, maxLength) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function validateProfile(body) {
  const businessName = optionalText(body.businessName, 120);
  const tradeName = optionalText(body.tradeName, 120);
  const contactEmail = optionalText(body.contactEmail, 254);
  const phone = optionalText(body.phone, 32);
  const website = optionalText(body.website, 255);
  const timezone = body.timezone === undefined ? "America/Sao_Paulo" : optionalText(body.timezone, 64);

  if (businessName === undefined || !businessName) return null;
  if (tradeName === undefined || contactEmail === undefined || phone === undefined ||
      website === undefined || timezone === undefined || !timezone) return null;
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return null;

  if (website) {
    try {
      const parsed = new URL(website);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    } catch {
      return null;
    }
  }

  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: timezone });
  } catch {
    return null;
  }

  return { businessName, tradeName, contactEmail, phone, website, timezone };
}

function createCompanyRouter({ pool, appOrigin }) {
  const router = express.Router();
  const authenticated = requireAuth(pool);
  const sameOrigin = requireSameOrigin(appOrigin);

  router.get("/", authenticated, async (_req, res, next) => {
    try {
      const [rows] = await pool.execute(
        "SELECT " + PROFILE_COLUMNS + " FROM company_profile WHERE id = 1 LIMIT 1"
      );
      res.json({ profile: rows[0] ? asProfile(rows[0]) : null });
    } catch (error) {
      next(error);
    }
  });

  router.put("/", sameOrigin, authenticated, async (req, res, next) => {
    try {
      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
        return res.status(400).json({ error: "invalid_company_profile" });
      }
      const profile = validateProfile(req.body);
      if (!profile) return res.status(400).json({ error: "invalid_company_profile" });

      await pool.execute(
        "INSERT INTO company_profile (id, business_name, trade_name, contact_email, phone, website, timezone) " +
        "VALUES (1, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT (id) DO UPDATE SET business_name = EXCLUDED.business_name, trade_name = EXCLUDED.trade_name, " +
        "contact_email = EXCLUDED.contact_email, phone = EXCLUDED.phone, website = EXCLUDED.website, timezone = EXCLUDED.timezone",
        [profile.businessName, profile.tradeName, profile.contactEmail, profile.phone, profile.website, profile.timezone]
      );

      const [rows] = await pool.execute(
        "SELECT " + PROFILE_COLUMNS + " FROM company_profile WHERE id = 1 LIMIT 1"
      );
      res.json({ profile: asProfile(rows[0]) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = { createCompanyRouter, validateProfile };