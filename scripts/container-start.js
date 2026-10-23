require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const bcrypt = require("bcryptjs");
const { createPool } = require("../src/config/database");
const { startServer } = require("../src/start");

async function prepareDemoDatabase() {
  const env = process.env;
  if (env.FNSC_DEMO_MODE !== "1" || env.DB_NAME !== "fnsc_crm_demo") {
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
    if (!ready) throw new Error("MySQL did not become ready.");

    const root = path.join(__dirname, "..");
    await pool.query(fs.readFileSync(path.join(root, "src/db/schema.sql"), "utf8"));
    await pool.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (" +
      "name VARCHAR(255) NOT NULL PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    const migrationsDir = path.join(root, "src/db/migrations");
    const files = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql") && /^\d{3}_/u.test(file))

    for (const name of files) {
      const [applied] = await pool.execute("SELECT name FROM schema_migrations WHERE name = ?", [name]);
      if (applied.length) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, name), "utf8");
      const statements = sql.split(";").map((statement) => statement.trim()).filter(Boolean);
      for (const statement of statements) await pool.query(statement);
      await pool.execute("INSERT INTO schema_migrations (name) VALUES (?)", [name]);
      console.log("Applied migration:", name);
    }

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
