const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const { createPool } = require("./config/database");
const { createApp } = require("./app");

async function startServer({ env = process.env, logger = console, processRef = process } = {}) {
  const pool = createPool(env);
  const sessionStore = new MySQLStore({
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 8 * 60 * 60 * 1000,
    createDatabaseTable: true
  }, pool);

  try {
    await sessionStore.onReady();
    const app = createApp({ pool, sessionStore, env });
    const port = Number(env.PORT || 3000);
    const server = app.listen(port, () => logger.log("FNSC-CRM listening on port " + port));

    let isShuttingDown = false;
    const shutdown = () => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      server.close(async (error) => {
        if (error) {
          logger.error("HTTP server shutdown failed:", error.message);
          processRef.exitCode = 1;
        }

        try {
          await sessionStore.close();
          await pool.end();
        } catch (closeError) {
          logger.error("Database shutdown failed:", closeError.message);
          processRef.exitCode = 1;
        }
      });
    };

    processRef.once("SIGINT", shutdown);
    processRef.once("SIGTERM", shutdown);
    return { app, server, sessionStore, pool, shutdown };
  } catch (error) {
    try { await sessionStore.close(); } catch (_closeError) { /* preserve startup error */ }
    try { await pool.end(); } catch (_closeError) { /* preserve startup error */ }
    throw error;
  }
}

module.exports = { startServer };
