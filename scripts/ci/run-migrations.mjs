import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import mysql from "mysql2/promise";

function log(message) {
  console.log(`[migrate] ${message}`);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32"
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function detectMigrationTool() {
  if (
    (await fileExists(path.join(process.cwd(), "prisma/schema.prisma"))) ||
    (await fileExists(path.join(process.cwd(), "server/prisma/schema.prisma")))
  ) {
    return { type: "prisma", command: "npx", args: ["prisma", "migrate", "deploy"] };
  }

  if (
    (await fileExists(path.join(process.cwd(), "knexfile.js"))) ||
    (await fileExists(path.join(process.cwd(), "knexfile.ts")))
  ) {
    return { type: "knex", command: "npx", args: ["knex", "migrate:latest"] };
  }

  if (
    (await fileExists(path.join(process.cwd(), "ormconfig.js"))) ||
    (await fileExists(path.join(process.cwd(), "ormconfig.ts"))) ||
    (await fileExists(path.join(process.cwd(), "typeorm.config.js")))
  ) {
    return { type: "typeorm", command: "npx", args: ["typeorm", "migration:run"] };
  }

  return null;
}

async function collectSqlMigrations() {
  const sqlDirs = ["migrations", "server/migrations", "db/migrations"];
  const files = [];

  for (const dir of sqlDirs) {
    const fullDir = path.join(process.cwd(), dir);
    if (!(await fileExists(fullDir))) {
      continue;
    }
    const entries = await fs.readdir(fullDir);
    for (const entry of entries) {
      if (entry.endsWith(".sql")) {
        files.push(path.join(fullDir, entry));
      }
    }
  }

  files.sort((a, b) => a.localeCompare(b));
  return files;
}

function parseDatabaseUrl(databaseUrl) {
  const url = new URL(databaseUrl);
  if (url.protocol !== "mysql:") {
    throw new Error(`Expected mysql:// DATABASE_URL, got: ${url.protocol}`);
  }

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: { minVersion: "TLSv1.2" },
    multipleStatements: true
  };
}

async function runSqlMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for SQL migrations");
  }

  const files = await collectSqlMigrations();
  if (files.length === 0) {
    throw new Error("No migration tool detected and no SQL files found in migrations/ directories");
  }

  log(`Running ${files.length} SQL migration file(s)`);
  const connection = await mysql.createConnection(parseDatabaseUrl(databaseUrl));
  try {
    for (const file of files) {
      const sql = await fs.readFile(file, "utf8");
      log(`Applying ${path.relative(process.cwd(), file)}`);
      await connection.query(sql);
    }
  } finally {
    await connection.end();
  }
}

async function main() {
  const tool = await detectMigrationTool();
  if (tool) {
    log(`Detected ${tool.type}. Running: ${tool.command} ${tool.args.join(" ")}`);
    await runCommand(tool.command, tool.args);
    return;
  }

  log("No framework migration tool detected. Falling back to SQL migrations.");
  await runSqlMigrations();
  log("SQL migrations completed.");
}

main().catch((error) => {
  console.error(`[migrate] ERROR: ${error.message}`);
  process.exit(1);
});
