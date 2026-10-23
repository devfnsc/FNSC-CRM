require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { createPool } = require("../src/config/database");

async function main() {
  const env = process.env;
  if (!env.DB_NAME || !env.DB_NAME.endsWith("_test")) {
    throw new Error("Refusing to prepare a database that does not end with _test.");
  }

  const pool = createPool(env);
  try {
    const root = path.join(__dirname, "..");
    await pool.query(fs.readFileSync(path.join(root, "src/db/schema.sql"), "utf8"));
    await pool.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (" +
      "name VARCHAR(255) NOT NULL PRIMARY KEY, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP" +
      ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    const migrationsDir = path.join(root, "src/db/migrations");
    const migrations = fs.readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql") && /^\\d{3}_/u.test(file))
      .sort();

    for (const name of migrations) {
      const [applied] = await pool.execute("SELECT name FROM schema_migrations WHERE name = ?", [name]);
      if (applied.length) continue;

      const sql = fs.readFileSync(path.join(migrationsDir, name), "utf8");
      const statements = sql.split(";").map((statement) => statement.trim()).filter(Boolean);
      for (const statement of statements) await pool.query(statement);
      await pool.execute("INSERT INTO schema_migrations (name) VALUES (?)", [name]);
      console.log("Applied test migration:", name);
    }

    console.log("Full MySQL integration schema is ready.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Could not prepare MySQL integration database:", error.message);
  process.exitCode = 1;
});
