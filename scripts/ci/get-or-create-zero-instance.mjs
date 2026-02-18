import fs from "node:fs/promises";
import path from "node:path";

const ZERO_API_ENDPOINT = process.env.ZERO_API_ENDPOINT || "https://zero.tidbapi.com/v1alpha1/instances";
const ZERO_INSTANCE_FILE = process.env.ZERO_INSTANCE_FILE || ".ci/zero-instance.json";
const ZERO_API_KEY = process.env.ZERO_API_KEY;
const ZERO_TAG = process.env.ZERO_TAG || `ci-${(process.env.GITHUB_REPOSITORY || "local").replace("/", "-")}`;
const REUSE_BUFFER_MS = 5 * 60 * 1000;

function log(message) {
  console.log(`[zero-instance] ${message}`);
}

function toBaseConnectionString(connectionString) {
  const url = new URL(connectionString);
  if (url.protocol !== "mysql:") {
    throw new Error(`Expected mysql:// connection string, got: ${url.protocol}`);
  }
  url.pathname = "/";
  return url.toString();
}

function maskConnectionString(connectionString) {
  const url = new URL(connectionString);
  return `mysql://${decodeURIComponent(url.username)}@${url.host}/`;
}

function isReusable(metadata) {
  if (!metadata?.baseConnectionString || !metadata?.expiresAt) {
    return false;
  }
  const expiresAtMs = Date.parse(metadata.expiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return false;
  }
  return expiresAtMs - Date.now() > REUSE_BUFFER_MS;
}

async function readCachedMetadata(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function createInstance() {
  log(`Requesting a new Zero instance from ${ZERO_API_ENDPOINT}`);

  const headers = {
    "Content-Type": "application/json"
  };

  if (ZERO_API_KEY) {
    headers.Authorization = `Bearer ${ZERO_API_KEY}`;
    headers["X-API-Key"] = ZERO_API_KEY;
  }

  const response = await fetch(ZERO_API_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ tag: ZERO_TAG })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Zero API request failed (${response.status}): ${body}`);
  }

  const payload = await response.json();
  const connectionString = payload?.connectionString || payload?.instance?.connectionString;
  const expiresAt = payload?.expiresAt || payload?.instance?.expiresAt;

  if (!connectionString || !expiresAt) {
    throw new Error("Zero API response missing connectionString/expiresAt");
  }

  return {
    baseConnectionString: toBaseConnectionString(connectionString),
    expiresAt
  };
}

async function writeMetadata(filePath, metadata) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
}

async function writeGitHubOutput(outputs) {
  if (!process.env.GITHUB_OUTPUT) {
    return;
  }
  const lines = Object.entries(outputs).map(([key, value]) => `${key}=${value}`);
  await fs.appendFile(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
}

async function main() {
  const cached = await readCachedMetadata(ZERO_INSTANCE_FILE);
  let metadata = cached;
  let cacheUpdated = false;

  if (isReusable(cached)) {
    log(`Reusing cached instance, expiresAt=${cached.expiresAt}`);
  } else {
    metadata = await createInstance();
    await writeMetadata(ZERO_INSTANCE_FILE, metadata);
    cacheUpdated = true;
    log(`Created new instance, expiresAt=${metadata.expiresAt}`);
  }

  log(`Base connection: ${maskConnectionString(metadata.baseConnectionString)}`);

  await writeGitHubOutput({
    base_connection_string: metadata.baseConnectionString,
    expires_at: metadata.expiresAt,
    cache_updated: cacheUpdated ? "true" : "false"
  });
}

main().catch((error) => {
  console.error(`[zero-instance] ERROR: ${error.message}`);
  process.exit(1);
});
