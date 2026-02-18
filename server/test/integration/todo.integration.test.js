import test from "node:test";
import assert from "node:assert/strict";
import mysql from "mysql2/promise";

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
    ssl: { minVersion: "TLSv1.2" }
  };
}

test("integration: can read/write todos in clean database", async () => {
  const databaseUrl = process.env.DATABASE_URL;
  assert.ok(databaseUrl, "DATABASE_URL must be set");

  const connection = await mysql.createConnection(parseDatabaseUrl(databaseUrl));
  try {
    const [tableRows] = await connection.query("SHOW TABLES LIKE 'todos'");
    assert.equal(tableRows.length, 1, "todos table should exist after migrations");

    const title = `ci-integration-${Date.now()}`;
    const author = "ci-bot";
    const [insertResult] = await connection.execute(
      "INSERT INTO todos (title, author, completed) VALUES (?, ?, ?)",
      [title, author, false]
    );
    assert.ok(insertResult.insertId, "insert should return an insertId");

    const [rows] = await connection.execute("SELECT title, author, completed FROM todos WHERE id = ?", [
      insertResult.insertId
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, title);
    assert.equal(rows[0].author, author);
    assert.equal(Boolean(rows[0].completed), false);

    const [updateResult] = await connection.execute("UPDATE todos SET completed = ? WHERE id = ?", [
      true,
      insertResult.insertId
    ]);
    assert.equal(updateResult.affectedRows, 1);
  } finally {
    await connection.end();
  }
});
