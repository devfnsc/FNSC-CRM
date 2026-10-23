const test = require("node:test");
const assert = require("node:assert/strict");

const { buildPoolOptions } = require("../src/config/database");

const baseEnv = {
  DB_HOST: "db.example.test",
  DB_NAME: "fnsc_crm_test",
  DB_USER: "crm_test"
};

test("buildPoolOptions requires host, database and user", () => {
  for (const key of ["DB_HOST", "DB_NAME", "DB_USER"]) {
    const env = { ...baseEnv };
    delete env[key];

    assert.throws(
      () => buildPoolOptions(env),
      new RegExp("Missing required database setting: " + key)
    );
  }
});

test("buildPoolOptions applies safe MySQL defaults and port", () => {
  const options = buildPoolOptions(baseEnv);

  assert.equal(options.host, baseEnv.DB_HOST);
  assert.equal(options.database, baseEnv.DB_NAME);
  assert.equal(options.user, baseEnv.DB_USER);
  assert.equal(options.port, 3306);
  assert.equal(options.password, "");
  assert.equal(options.charset, "utf8mb4");
  assert.equal(options.waitForConnections, true);
  assert.equal(options.connectionLimit, 10);
  assert.equal(options.queueLimit, 0);
  assert.equal("ssl" in options, false);
});

test("buildPoolOptions parses a custom port and configures the supplied TLS CA", () => {
  const ca = "-----BEGIN CERTIFICATE-----\\nexample\\n-----END CERTIFICATE-----";
  const options = buildPoolOptions({
    ...baseEnv,
    DB_PORT: "2443",
    DB_PASSWORD: "secret",
    DB_SSL_CA: ca
  });

  assert.equal(options.port, 2443);
  assert.equal(options.password, "secret");
  assert.deepEqual(options.ssl, { ca });
});
