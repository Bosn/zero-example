import fs from "node:fs/promises";
import mysql from "mysql2/promise";

function log(message) {
  console.log(`[create-clean-db] ${message}`);
}

function parseBaseConnection(baseConnectionString) {
  const url = new URL(baseConnectionString);
  if (url.protocol !== "mysql:") {
    throw new Error(`Expected mysql:// connection string, got: ${url.protocol}`);
  }

  return {
    url,
    config: {
      host: url.hostname,
      port: url.port ? Number(url.port) : 4000,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, "") || undefined,
      ssl: { minVersion: "TLSv1.2" }
    }
  };
}

function buildDbName() {
  const runId = process.env.GITHUB_RUN_ID || `${Date.now()}`;
  const attempt = process.env.GITHUB_RUN_ATTEMPT || "1";
  const dbName = `ci_${runId}_${attempt}`.replace(/[^a-zA-Z0-9_]/g, "_");
  if (!/^[a-zA-Z0-9_]+$/.test(dbName)) {
    throw new Error(`Generated database name is invalid: ${dbName}`);
  }
  return dbName;
}

async function writeGitHubEnv(values) {
  const envFile = process.env.GITHUB_ENV;
  if (!envFile) {
    return;
  }
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  await fs.appendFile(envFile, `${lines.join("\n")}\n`);
}

async function main() {
  const baseConnectionString = process.env.BASE_CONNECTION_STRING;
  const expiresAt = process.env.EXPIRES_AT || "";
  if (!baseConnectionString) {
    throw new Error("BASE_CONNECTION_STRING is required");
  }

  const dbName = buildDbName();
  const { url, config } = parseBaseConnection(baseConnectionString);
  const connection = await mysql.createConnection(config);

  try {
    const escapedDbName = `\`${dbName.replace(/`/g, "``")}\``;
    await connection.query(`CREATE DATABASE ${escapedDbName}`);
    log(`Created database ${dbName}`);

    const dbUrl = new URL(url.toString());
    dbUrl.pathname = `/${dbName}`;
    const databaseUrl = dbUrl.toString();

    await writeGitHubEnv({
      CI_DB_NAME: dbName,
      CLEAN_DB_NAME: dbName,
      DATABASE_URL: databaseUrl,
      EXPIRES_AT: expiresAt
    });

    log("Exported CI_DB_NAME, CLEAN_DB_NAME, DATABASE_URL and EXPIRES_AT to GITHUB_ENV");
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`[create-clean-db] ERROR: ${error.message}`);
  process.exit(1);
});
