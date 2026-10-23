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
    const schemaPath = path.join(__dirname, "..", "src", "db", "schema.sql");
    const customerPath = path.join(__dirname, "..", "src", "db", "migrations", "003_customers.sql");
    const archivePath = path.join(__dirname, "..", "src", "db", "migrations", "004_customer_archive.sql");

    await pool.query(fs.readFileSync(schemaPath, "utf8"));
    await pool.query(fs.readFileSync(customerPath, "utf8"));

    const [columns] = await pool.execute(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS " +
      "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'archived_at'"
    );
    if (columns.length === 0) {
      await pool.query(fs.readFileSync(archivePath, "utf8"));
    }
    console.log("Customer integration schema is ready.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Could not prepare customer integration database:", error.message);
  process.exitCode = 1;
});
