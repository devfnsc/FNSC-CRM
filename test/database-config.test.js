const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildPoolOptions, toPostgresSql } = require("../src/config/database");

const localEnv = {
  DATABASE_URL: "postgresql://crm_test:secret@127.0.0.1:5432/fnsc_crm_test",
  DATABASE_SSL: "disable"
};

test("buildPoolOptions requires a PostgreSQL connection URL", () => {
  assert.throws(() => buildPoolOptions({}), /DATABASE_URL/u);
  assert.throws(() => buildPoolOptions({ DATABASE_URL: "not-a-url" }), /valid PostgreSQL/u);
});

test("buildPoolOptions uses a small local pool and allows local TLS to be disabled", () => {
  const options = buildPoolOptions(localEnv);
  assert.equal(options.connectionString, localEnv.DATABASE_URL);
  assert.equal(options.max, 5);
  assert.equal(options.ssl, false);
  assert.equal(options.application_name, "fnsc-crm");
});

test("buildPoolOptions enforces TLS by default and accepts an explicit trusted CA", () => {
  const ca = "-----BEGIN CERTIFICATE-----\\nexample\\n-----END CERTIFICATE-----";
  const options = buildPoolOptions({
    DATABASE_URL: "postgresql://crm:secret@db.example.test:5432/postgres?sslmode=require",
    DATABASE_SSL_CA: ca
  });
  assert.deepEqual(options.ssl, {
    ca: ca.replace(/\\n/g, "\n"),
    rejectUnauthorized: true
  });
  assert.equal(options.connectionString.includes("sslmode"), false);
});

test("production cannot use local databases or disable TLS", () => {
  assert.throws(() => buildPoolOptions({
    ...localEnv, NODE_ENV: "production"
  }), /cannot point to a local/u);
  assert.throws(() => buildPoolOptions({
    DATABASE_URL: "postgresql://crm:secret@db.example.test:5432/postgres",
    NODE_ENV: "production",
    DATABASE_SSL: "disable"
  }), /TLS cannot be disabled/u);
});

test("pool size is bounded and PostgreSQL placeholders are numbered", () => {
  assert.throws(() => buildPoolOptions({ ...localEnv, DB_POOL_MAX: "21" }), /between 1 and 20/u);
  assert.equal(toPostgresSql("SELECT * FROM users WHERE id = ? AND email = ?"), "SELECT * FROM users WHERE id = $1 AND email = $2");
});
