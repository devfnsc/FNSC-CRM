const express = require("express");
const { requireAuth, requireSameOrigin } = require("../middleware/auth");

function optionalText(value, maxLength, required = false) {
  if (value === undefined || value === null || value === "") return required ? null : null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maxLength || /[\u0000-\u001f\u007f]/u.test(normalized)) return undefined;
  return normalized || null;
}

function validDate(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1000) return undefined;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? undefined : value;
}

function validateTask(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const title = optionalText(body.title, 160, true);
  const details = optionalText(body.details, 2000);
  const dueDate = validDate(body.dueDate);
  const status = body.status === undefined ? "pending" : body.status;
  if (!title || details === undefined || dueDate === undefined ||
      !["pending", "in_progress", "done"].includes(status)) return null;
  return { title, details, dueDate, status };
}

function asTask(row) {
  return {
    id: row.id,
    contractId: row.contract_id,
    title: row.title,
    details: row.details,
    dueDate: row.due_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function createOnboardingRouter({ pool, appOrigin }) {
  const router = express.Router();
  const authenticated = requireAuth(pool);
  const sameOrigin = requireSameOrigin(appOrigin);

  async function signedContract(contractId) {
    const [rows] = await pool.execute(
      "SELECT id, status FROM contracts WHERE id = ? LIMIT 1", [contractId]
    );
    return rows[0] || null;
  }

  router.get("/contracts/:contractId/tasks", authenticated, async (req, res, next) => {
    try {
      if (!/^[1-9]\d{0,19}$/.test(req.params.contractId)) return res.status(404).json({ error: "contract_not_found" });
      const contract = await signedContract(req.params.contractId);
      if (!contract) return res.status(404).json({ error: "contract_not_found" });
      if (contract.status !== "signed") return res.status(409).json({ error: "onboarding_requires_signed_contract" });
      const [rows] = await pool.execute(
        "SELECT id, contract_id, title, details, due_date, status, created_at, updated_at " +
        "FROM onboarding_tasks WHERE contract_id = ? " +
        "ORDER BY CASE status WHEN 'pending' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END, " +
        "due_date IS NULL, due_date ASC, id ASC",
        [req.params.contractId]
      );
      res.set("Cache-Control", "private, no-store");
      res.json({ tasks: rows.map(asTask) });
    } catch (error) { next(error); }
  });

  router.post("/contracts/:contractId/tasks", sameOrigin, authenticated, async (req, res, next) => {
    try {
      if (!/^[1-9]\d{0,19}$/.test(req.params.contractId)) return res.status(404).json({ error: "contract_not_found" });
      const contract = await signedContract(req.params.contractId);
      if (!contract) return res.status(404).json({ error: "contract_not_found" });
      if (contract.status !== "signed") return res.status(409).json({ error: "onboarding_requires_signed_contract" });
      const task = validateTask(req.body);
      if (!task) return res.status(400).json({ error: "invalid_onboarding_task" });
      const [result] = await pool.execute(
        "INSERT INTO onboarding_tasks (contract_id, title, details, due_date, status, created_by, updated_by) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        [req.params.contractId, task.title, task.details, task.dueDate, task.status, req.user.id, req.user.id]
      );
      res.status(201).json({ task: { id: result.insertId, contractId: req.params.contractId, ...task } });
    } catch (error) { next(error); }
  });

  router.put("/tasks/:id", sameOrigin, authenticated, async (req, res, next) => {
    try {
      if (!/^[1-9]\d{0,19}$/.test(req.params.id)) return res.status(404).json({ error: "onboarding_task_not_found" });
      const task = validateTask(req.body);
      if (!task) return res.status(400).json({ error: "invalid_onboarding_task" });
      const [matches] = await pool.execute(
        "SELECT t.id, t.contract_id, c.status AS contract_status FROM onboarding_tasks t " +
        "JOIN contracts c ON c.id = t.contract_id WHERE t.id = ? LIMIT 1",
        [req.params.id]
      );
      if (!matches[0]) return res.status(404).json({ error: "onboarding_task_not_found" });
      if (matches[0].contract_status !== "signed") return res.status(409).json({ error: "onboarding_requires_signed_contract" });
      await pool.execute(
        "UPDATE onboarding_tasks SET title = ?, details = ?, due_date = ?, status = ?, updated_by = ? WHERE id = ?",
        [task.title, task.details, task.dueDate, task.status, req.user.id, req.params.id]
      );
      res.json({ task: { id: req.params.id, contractId: matches[0].contract_id, ...task } });
    } catch (error) { next(error); }
  });

  return router;
}

module.exports = { createOnboardingRouter, validateTask };
