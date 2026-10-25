require("dotenv").config();

const { createPool } = require("../src/config/database");
const { applySchema } = require("./migrate");

function isTestDatabase(connectionString) {
  try { return new URL(connectionString).pathname.endsWith("_test"); }
  catch { return false; }
}

async function main() {
  const env = process.env;
  if (!isTestDatabase(env.DATABASE_URL)) {
    throw new Error("Refusing to prepare a database whose name does not end with _test.");
  }
  const pool = createPool(env);
  try {
    await applySchema(pool);
    console.log("Full PostgreSQL integration schema is ready.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Could not prepare PostgreSQL integration database:", error.message);
  process.exitCode = 1;
});
