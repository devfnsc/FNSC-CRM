const { Pool } = require("pg");

const ID_TABLES = new Set([
  "users", "company_profile", "customers", "services", "proposals", "proposal_items",
  "proposal_status_history", "contracts", "contract_items", "contract_revisions",
  "contract_status_history", "finance_transactions", "onboarding_tasks", "customer_activities"
]);

function buildPoolOptions(env = process.env) {
  if (!env.DATABASE_URL) throw new Error("Missing required database setting: DATABASE_URL");

  let parsed;
  try {
    parsed = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL.");
  }

  const isLocal = ["localhost", "127.0.0.1", "database"].includes(parsed.hostname);
  if (env.NODE_ENV === "production" && isLocal) {
    throw new Error("Production DATABASE_URL cannot point to a local database.");
  }
  parsed.searchParams.delete("sslmode");
  parsed.searchParams.delete("sslrootcert");

  let ssl = false;
  if (env.DATABASE_SSL !== "disable") {
    ssl = env.DATABASE_SSL_CA
      ? { ca: env.DATABASE_SSL_CA.replace(/\\n/g, "\n"), rejectUnauthorized: true }
      : { rejectUnauthorized: true };
  } else if (!isLocal && env.NODE_ENV === "production") {
    throw new Error("TLS cannot be disabled for a production database.");
  }

  const max = Number(env.DB_POOL_MAX || 5);
  if (!Number.isSafeInteger(max) || max < 1 || max > 20) {
    throw new Error("DB_POOL_MAX must be an integer between 1 and 20.");
  }

  return {
    connectionString: parsed.toString(),
    ssl,
    max,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    application_name: "fnsc-crm"
  };
}

function toPostgresSql(sql) {
  let index = 0;
  return sql.replace(/\?/gu, () => "$" + (++index));
}

function executeOn(client, sql, values = []) {
  let statement = toPostgresSql(sql);
  const match = statement.match(/^\s*INSERT\s+INTO\s+(\w+)/iu);
  const returnsId = match && ID_TABLES.has(match[1].toLowerCase()) && !/\bRETURNING\b/iu.test(statement);
  if (returnsId) statement += " RETURNING id";

  return client.query(statement, values).then((result) => {
    const metadata = {
      affectedRows: result.rowCount,
      ...(returnsId && result.rows[0] ? { insertId: result.rows[0].id } : {})
    };
    const isMutation = ["INSERT", "UPDATE", "DELETE"].some((keyword) => statement.trimStart().startsWith(keyword + " "));
    return isMutation ? [metadata, result.rows] : [result.rows, metadata];
  });
}

function adaptClient(client) {
  return {
    query: (sql, values) => client.query(toPostgresSql(sql), values),
    execute: (sql, values = []) => executeOn(client, sql, values),
    beginTransaction: () => client.query("BEGIN"),
    commit: () => client.query("COMMIT"),
    rollback: () => client.query("ROLLBACK"),
    release: () => client.release()
  };
}

function createPool(env = process.env) {
  const nativePool = new Pool(buildPoolOptions(env));
  return {
    nativePool,
    query: (sql, values) => nativePool.query(toPostgresSql(sql), values),
    execute: (sql, values = []) => executeOn(nativePool, sql, values),
    getConnection: async () => adaptClient(await nativePool.connect()),
    end: () => nativePool.end()
  };
}

module.exports = { createPool, buildPoolOptions, toPostgresSql };