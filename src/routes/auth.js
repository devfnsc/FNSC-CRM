const express = require("express");
const bcrypt = require("bcryptjs");
const { rateLimit } = require("express-rate-limit");
const { requireAuth, requireSameOrigin } = require("../middleware/auth");

function createAuthRouter({ pool, appOrigin }) {
  const router = express.Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "too_many_attempts" }
  });
  const sameOrigin = requireSameOrigin(appOrigin);
  const authenticated = requireAuth(pool);

  router.post("/login", sameOrigin, loginLimiter, async (req, res, next) => {
    try {
      const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
      const password = typeof req.body.password === "string" ? req.body.password : "";
      if (!email || !password || email.length > 254 || Buffer.byteLength(password, "utf8") > 72) {
        return res.status(400).json({ error: "invalid_credentials" });
      }

      const [rows] = await pool.execute(
        "SELECT id, email, password_hash FROM users WHERE email = ? AND active = 1 LIMIT 1",
        [email]
      );
      const user = rows[0];
      const comparisonHash = user ? user.password_hash : await DUMMY_HASH_PROMISE;
      const valid = await bcrypt.compare(password, comparisonHash);
      if (!user || !valid) {
        return res.status(401).json({ error: "invalid_credentials" });
      }

      req.session.regenerate((error) => {
        if (error) return next(error);
        req.session.userId = user.id;
        req.session.save((saveError) => {
          if (saveError) return next(saveError);
          res.json({ user: { id: user.id, email: user.email } });
        });
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", authenticated, (req, res) => {
    res.json({ user: req.user });
  });

  router.post("/logout", sameOrigin, authenticated, (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie("fnsc.sid", { path: "/" });
      res.status(204).end();
    });
  });

  return router;
}

const DUMMY_HASH_PROMISE = bcrypt.hash("fnsc-invalid-account-placeholder", 12);

module.exports = { createAuthRouter };