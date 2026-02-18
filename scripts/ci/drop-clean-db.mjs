import mysql from "mysql2/promise";

function log(message) {
  console.log(`[drop-clean-db] ${message}`);
}

function parseBaseConnection(baseConnectionString) {
  const url = new URL(baseConnectionString);
  if (url.protocol !== "mysql:") {
    throw new Error(`Expected mysql:// connection string, got: ${url.protocol}`);
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "") || undefined,
    ssl: { minVersion: "TLSv1.2" }
  };
}

async function main() {
  const baseConnectionString = process.env.BASE_CONNECTION_STRING;
  const dbName = process.env.CLEAN_DB_NAME;

  if (!dbName) {
    log("CLEAN_DB_NAME is empty. Skipping drop.");
    return;
  }

  if (!baseConnectionString) {
    throw new Error("BASE_CONNECTION_STRING is required");
  }

  const connection = await mysql.createConnection(parseBaseConnection(baseConnectionString));
  try {
    const escapedDbName = `\`${dbName.replace(/`/g, "``")}\``;
    await connection.query(`DROP DATABASE IF EXISTS ${escapedDbName}`);
    log(`Dropped database ${dbName}`);
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`[drop-clean-db] ERROR: ${error.message}`);
  process.exit(1);
});
