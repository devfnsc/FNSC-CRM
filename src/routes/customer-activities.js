const express = require("express");
const { requireAuth, requireSameOrigin } = require("../middleware/auth");

function cleanText(value, maxLength) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) return undefined;
  return normalized;
}

function validDate(value, optional = false) {
  if (optional && (value === undefined || value === null || value === "")) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1000) return undefined;
  const parsed = new Date(value + "T00:00:00.000Z");
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? undefined : value;
}

function validateActivity(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const type = body.type;
  const summary = cleanText(body.summary, 2000);
  const occurredOn = validDate(body.occurredOn);
  const followUpDate = validDate(body.followUpDate, true);
  if (!["call", "email", "meeting", "message", "other"].includes(type) ||
      !summary || occurredOn === undefined || followUpDate === undefined ||
      (followUpDate && followUpDate < occurredOn)) return null;
  return { type, summary, occurredOn, followUpDate };
}

function asActivity(row) {
  return {
    id: row.id, customerId: row.customer_id, type: row.type, summary: row.summary,
    occurredOn: row.occurred_on, followUpDate: row.follow_up_date,
    followUpStatus: row.follow_up_status, followUpCompletedAt: row.follow_up_completed_at, followUpCompletedByEmail: row.follow_up_completed_by_email,
    createdAt: row.created_at, createdByEmail: row.created_by_email
  };
}

function createCustomerActivityRouter({ pool, appOrigin }) {
  const router = express.Router();
  const authenticated = requireAuth(pool);
  const sameOrigin = requireSameOrigin(appOrigin);

  async function findCustomer(id) {
    const [rows] = await pool.execute("SELECT id, archived_at FROM customers WHERE id = ? LIMIT 1", [id]);
    return rows[0] || null;
  }

  router.get("/customers/:customerId/activities", authenticated, async (req, res, next) => {
    try {
      if (!/^[1-9]\d{0,19}$/.test(req.params.customerId)) return res.status(404).json({ error: "customer_not_found" });
      const customer = await findCustomer(req.params.customerId);
      if (!customer) return res.status(404).json({ error: "customer_not_found" });
      const [rows] = await pool.execute(
        "SELECT a.id, a.customer_id, a.type, a.summary, a.occurred_on, a.follow_up_date, a.follow_up_status, " +
        "a.follow_up_completed_at, a.created_at, u.email AS created_by_email, completed_by.email AS follow_up_completed_by_email " +
        "FROM customer_activities a LEFT JOIN users u ON u.id = a.created_by " +
        "LEFT JOIN users completed_by ON completed_by.id = a.follow_up_completed_by " +
        "WHERE a.customer_id = ? ORDER BY a.occurred_on DESC, a.id DESC LIMIT 300",
        [req.params.customerId]
      );
      res.set("Cache-Control", "private, no-store");
      res.json({ activities: rows.map(asActivity), limit: 300 });
    } catch (error) { next(error); }
  });

  router.post("/customers/:customerId/activities", sameOrigin, authenticated, async (req, res, next) => {
    try {
      if (!/^[1-9]\d{0,19}$/.test(req.params.customerId)) return res.status(404).json({ error: "customer_not_found" });
      const customer = await findCustomer(req.params.customerId);
      if (!customer) return res.status(404).json({ error: "customer_not_found" });
      if (customer.archived_at) return res.status(409).json({ error: "customer_archived" });
      const activity = validateActivity(req.body);
      if (!activity) return res.status(400).json({ error: "invalid_customer_activity" });
      const [result] = await pool.execute(
        "INSERT INTO customer_activities (customer_id, type, summary, occurred_on, follow_up_date, follow_up_status, created_by) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        [req.params.customerId, activity.type, activity.summary, activity.occurredOn,
          activity.followUpDate, activity.followUpDate ? "pending" : null, req.user.id]
      );
      res.status(201).json({ activity: {
        id: result.insertId, customerId: req.params.customerId, ...activity,
        followUpStatus: activity.followUpDate ? "pending" : null
      } });
    } catch (error) { next(error); }
  });

  router.patch("/activities/:id/follow-up", sameOrigin, authenticated, async (req, res, next) => {
    try {
      if (!/^[1-9]\d{0,19}$/.test(req.params.id)) return res.status(404).json({ error: "activity_not_found" });
      if (!req.body || req.body.status !== "completed") return res.status(400).json({ error: "invalid_follow_up_status" });
      const [result] = await pool.execute(
        "UPDATE customer_activities SET follow_up_status = 'completed', follow_up_completed_at = CURRENT_TIMESTAMP, " +
        "follow_up_completed_by = ? WHERE id = ? AND follow_up_date IS NOT NULL AND follow_up_status = 'pending'",
        [req.user.id, req.params.id]
      );
      if (!result.affectedRows) return res.status(409).json({ error: "follow_up_not_pending" });
      res.json({ activity: { id: req.params.id, followUpStatus: "completed" } });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = { createCustomerActivityRouter, validateActivity };
