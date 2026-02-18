import crypto from "node:crypto";

const tag = process.argv[2] || "todo-app";

async function main() {
  const response = await fetch("https://zero.tidbapi.com/v1alpha1/instances", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID()
    },
    body: JSON.stringify({ tag })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to create TiDB Cloud Zero instance (${response.status}): ${text}`);
  }

  const payload = await response.json();
  const instance = payload?.instance || {};

  if (!instance.connectionString) {
    throw new Error("API response does not include instance.connectionString");
  }

  console.log("Created TiDB Cloud Zero instance");
  console.log(`Tag: ${instance.tag || tag}`);
  console.log(`Expires: ${instance.expiresAt || "unknown"}`);
  console.log("");
  console.log("Add this to /Users/bosn/git/zero-example/server/.env:");
  console.log(`DATABASE_URL=${instance.connectionString}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
