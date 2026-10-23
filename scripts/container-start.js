require("dotenv").config();

const bcrypt = require("bcryptjs");
const { createPool } = require("../src/config/database");
const { applySchema } = require("./migrate");
const { startServer } = require("../src/start");

function databaseName(connectionString) {
  try { return new URL(connectionString).pathname.replace(/^\//u, ""); }
  catch { return ""; }
}

async function prepareDemoDatabase() {
  const env = process.env;
  if (env.FNSC_DEMO_MODE !== "1" || databaseName(env.DATABASE_URL) !== "fnsc_crm_demo") {
    throw new Error("Refusing demo bootstrap outside the isolated fnsc_crm_demo database.");
  }

  const pool = createPool(env);
  try {
    let ready = false;
    for (let attempt = 1; attempt <= 60; attempt += 1) {
      try {
        await pool.query("SELECT 1");
        ready = true;
        break;
      } catch (error) {
        if (attempt === 60) throw error;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    if (!ready) throw new Error("PostgreSQL did not become ready.");

    await applySchema(pool);
    const email = (env.CRM_DEMO_EMAIL || "").trim().toLowerCase();
    const password = env.CRM_DEMO_PASSWORD || "";
    if (!email || Buffer.byteLength(password, "utf8") < 12) {
      throw new Error("Set CRM_DEMO_EMAIL and a CRM_DEMO_PASSWORD with at least 12 bytes.");
    }
    const [existing] = await pool.execute("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length === 0) {
      const passwordHash = await bcrypt.hash(password, 12);
      await pool.execute("INSERT INTO users (email, password_hash) VALUES (?, ?)", [email, passwordHash]);
      console.log("Created local demo administrator:", email);
    }
  } finally {
    await pool.end();
  }
}

prepareDemoDatabase()
  .then(() => startServer())
  .catch((error) => {
    console.error("Could not start the local CRM demo:", error.message);
    process.exitCode = 1;
  });
