function requireAuth(pool) {
  return async function authenticate(req, res, next) {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "authentication_required" });
    }
    try {
      const [rows] = await pool.execute(
        "SELECT id, email FROM users WHERE id = ? AND active = TRUE LIMIT 1",
        [req.session.userId]
      );
      if (!rows[0]) {
        req.session.destroy(() => {});
        res.clearCookie("fnsc.sid", { path: "/" });
        return res.status(401).json({ error: "authentication_required" });
      }
      req.user = rows[0];
      next();
    } catch (error) {
      next(error);
    }
  };
}

function requireSameOrigin(appOrigin) {
  const expectedOrigin = new URL(appOrigin).origin;
  return function sameOrigin(req, res, next) {
    const origin = req.get("origin");
    if (!origin || origin !== expectedOrigin) {
      return res.status(403).json({ error: "invalid_origin" });
    }
    next();
  };
}

module.exports = { requireAuth, requireSameOrigin };