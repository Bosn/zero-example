import fs from "node:fs";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

function parseDatabaseUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  if (url.protocol !== "mysql:") {
    throw new Error("DATABASE_URL must start with mysql://");
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "")
  };
}

function buildSslOptions() {
  if (process.env.TIDB_ENABLE_SSL === "false") {
    return undefined;
  }

  const caPath = process.env.TIDB_CA_PATH;
  if (caPath) {
    return {
      minVersion: "TLSv1.2",
      ca: fs.readFileSync(caPath, "utf8")
    };
  }

  return {
    minVersion: "TLSv1.2"
  };
}

function getPoolConfig() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Copy it from your TiDB Cloud Zero instance.");
  }

  return {
    ...parseDatabaseUrl(databaseUrl),
    ssl: buildSslOptions(),
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    namedPlaceholders: true
  };
}

const pool = mysql.createPool(getPoolConfig());

export async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS todos (
      id BIGINT PRIMARY KEY AUTO_INCREMENT,
      title VARCHAR(255) NOT NULL,
      author VARCHAR(255) NOT NULL,
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    ALTER TABLE todos
    ADD COLUMN IF NOT EXISTS author VARCHAR(255) NOT NULL DEFAULT 'unknown'
  `);
}

export async function execute(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

export default pool;
