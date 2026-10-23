const mysql = require("mysql2/promise");

function buildPoolOptions(env = process.env) {
  const required = ["DB_HOST", "DB_NAME", "DB_USER"];
  for (const name of required) {
    if (!env[name]) throw new Error("Missing required database setting: " + name);
  }

  const ssl = env.DB_SSL_CA ? { ca: env.DB_SSL_CA } : undefined;

  return {
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD || "",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: "utf8mb4",
    ...(ssl ? { ssl } : {})
  };
}

function createPool(env = process.env) {
  return mysql.createPool(buildPoolOptions(env));
}

module.exports = { createPool, buildPoolOptions };