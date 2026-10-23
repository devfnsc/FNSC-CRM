const path = require("node:path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const { createApiRouter } = require("./routes");
const { requireAuth } = require("./middleware/auth");

function createApp({ pool, sessionStore, env = process.env }) {
  if (!env.APP_ORIGIN) throw new Error("APP_ORIGIN is required");
  if (!env.SESSION_SECRET || Buffer.byteLength(env.SESSION_SECRET) < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 bytes");
  }

  const app = express();
  if (env.TRUST_PROXY_HOPS !== undefined && env.TRUST_PROXY_HOPS !== "") {
    const trustProxyHops = Number(env.TRUST_PROXY_HOPS);
    if (!Number.isSafeInteger(trustProxyHops) || trustProxyHops < 0) {
      throw new Error("TRUST_PROXY_HOPS must be a non-negative integer");
    }
    app.set("trust proxy", trustProxyHops);
  }
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "64kb" }));
  app.use(session({
    name: "fnsc.sid",
    secret: env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000,
      path: "/"
    }
  }));

  app.use("/api", createApiRouter({ pool, appOrigin: env.APP_ORIGIN }));
  app.use(express.static(path.join(__dirname, "public"), { index: "index.html" }));
  app.get("/app", requireAuth(pool), (_req, res) => {
    res.sendFile(path.join(__dirname, "private", "app.html"));
  });

  app.use((error, _req, res, _next) => {
    console.error("Request failed:", error.message);
    res.status(500).json({ error: "internal_server_error" });
  });

  return app;
}

module.exports = { createApp };
