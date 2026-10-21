const mysql = require("mysql2/promise");

function createPool(env = process.env) {
  const required = ["DB_HOST", "DB_NAME", "DB_USER"];
  for (const name of required) {
    if (!env[name]) throw new Error("Missing required database setting: " + name);
  }

  return mysql.createPool({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD || "",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4"
  });
}

module.exports = { createPool };