require("dotenv").config();

const path = require("node:path");
const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const helmet = require("helmet");
const { createPool } = require("./config/database");
const { createAuthRouter } = require("./routes/auth");
const { createCompanyRouter } = require("./routes/company");
const { createCustomersRouter } = require("./routes/customers");
const { createServicesRouter } = require("./routes/services");
const { createProposalsRouter } = require("./routes/proposals");
const { createContractsRouter } = require("./routes/contracts");
const { createFinanceRouter } = require("./routes/finance");
const { createOnboardingRouter } = require("./routes/onboarding");
const { createCustomerActivityRouter } = require("./routes/customer-activities");
const { requireAuth } = require("./middleware/auth");

function createApp({ pool, sessionStore, env = process.env }) {
  if (!env.APP_ORIGIN) throw new Error("APP_ORIGIN is required");
  if (!env.SESSION_SECRET || Buffer.byteLength(env.SESSION_SECRET) < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 bytes");
  }

  const app = express();
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

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.use("/api/auth", createAuthRouter({ pool, appOrigin: env.APP_ORIGIN }));
  app.use("/api/company", createCompanyRouter({ pool, appOrigin: env.APP_ORIGIN }));
  app.use("/api/customers", createCustomersRouter({ pool, appOrigin: env.APP_ORIGIN }));
  app.use("/api/services", createServicesRouter({ pool, appOrigin: env.APP_ORIGIN }));
  app.use("/api/proposals", createProposalsRouter({ pool, appOrigin: env.APP_ORIGIN }));
  app.use("/api/contracts", createContractsRouter({ pool, appOrigin: env.APP_ORIGIN }));
  app.use("/api/finance", createFinanceRouter({ pool, appOrigin: env.APP_ORIGIN }));
  app.use("/api/onboarding", createOnboardingRouter({ pool, appOrigin: env.APP_ORIGIN }));
  app.use("/api/customer-activities", createCustomerActivityRouter({ pool, appOrigin: env.APP_ORIGIN }));
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

async function start() {
  const pool = createPool();
  const sessionStore = new MySQLStore({
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 8 * 60 * 60 * 1000,
    createDatabaseTable: true
  }, pool);
  await sessionStore.onReady();
  const app = createApp({ pool, sessionStore });
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, () => console.log("FNSC-CRM listening on port " + port));

  const shutdown = () => server.close(async () => {
    await sessionStore.close();
    await pool.end();
    process.exit(0);
  });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (require.main === module) {
  start().catch((error) => {
    console.error("Startup failed:", error.message);
    process.exit(1);
  });
}

module.exports = { createApp };
