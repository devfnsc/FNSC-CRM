require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { createPool } = require("../src/config/database");

async function applySchema(pool) {
  const schemaPath = path.join(__dirname, "..", "src", "db", "schema.sql");
  const sql = fs.readFileSync(schemaPath, "utf8");
  await pool.query(sql);
}

async function main() {
  const pool = createPool(process.env);
  try {
    await applySchema(pool);
    console.log("PostgreSQL schema is ready.");
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Could not prepare PostgreSQL schema:", error.message);
    process.exitCode = 1;
  });
}

module.exports = { applySchema };
