/**
 * Explicit preflight for the DEMO-DATA alpha bootstrap.
 *
 * This command creates users, tenants, skills and demo grants in addition to
 * migrating schema. It is not the production migration CLI.
 * This module intentionally imports no persistence/provider code.
 */
export const ALPHA_BOOTSTRAP_ACK = "I_ACCEPT_DEMO_IDENTITY_WRITES";
export const ALPHA_BOOTSTRAP_REMOTE_ACK = "I_ACCEPT_NONLOCAL_DEMO_WRITES";

const productionValues = new Set(["prod", "production", "live"]);
const productionMarkers = [
  "NODE_ENV",
  "MASANAWA_ENVIRONMENT",
  "RAILWAY_ENVIRONMENT",
  "RAILWAY_ENVIRONMENT_NAME",
  "VERCEL_ENV",
  "APP_ENV",
  "ENVIRONMENT",
];
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const nonProductionDbName = /(?:^|[_-])(?:dev|test|sandbox|staging|rehearsal)(?:$|[_-])/i;

function configured(env, key) {
  const value = env[key];
  return typeof value === "string" ? value.trim() : "";
}

function deny(reason) {
  // Deliberately never interpolate the connection string, credentials or hostname.
  throw new Error(`Alpha bootstrap refused: ${reason}. Use the schema-only migration CLI for production.`);
}

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ remote: boolean }} No credential/host/name leakage in output.
 */
export function assertAlphaBootstrapTarget(env = process.env) {
  if (configured(env, "MASANAWA_ALPHA_BOOTSTRAP_CONFIRM") !== ALPHA_BOOTSTRAP_ACK) {
    deny("explicit demo-write confirmation is required");
  }

  for (const key of productionMarkers) {
    if (productionValues.has(configured(env, key).toLowerCase())) {
      deny("production environment marker is present");
    }
  }

  const connection = configured(env, "MASANAWA_DATABASE_URL") || configured(env, "DATABASE_URL");
  if (!connection) {
    deny("a PostgreSQL connection string is required");
  }

  let url;
  try {
    url = new URL(connection);
  } catch {
    deny("invalid PostgreSQL connection string");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname ||
      url.hash || !url.pathname.startsWith("/")) {
    deny("an explicit PostgreSQL URL and database name are required");
  }

  let databaseName;
  try {
    databaseName = decodeURIComponent(url.pathname.slice(1));
  } catch {
    deny("invalid encoded database name");
  }
  if (!databaseName || databaseName.includes("/") || databaseName.includes("\\") ||
      /[\x00-\x1F\x7F]/.test(databaseName) ||
      ["postgres", "template0", "template1"].includes(databaseName.toLowerCase())) {
    deny("a dedicated non-system database is required");
  }

  const expectedDatabase = configured(env, "MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_DATABASE");
  if (!expectedDatabase || databaseName !== expectedDatabase) {
    deny("explicit expected database name does not match");
  }

  const actualHost = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const expectedHost = configured(env, "MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_HOST").toLowerCase().replace(/^\[|\]$/g, "");
  if (!expectedHost || expectedHost !== actualHost) {
    deny("explicit expected database host does not match");
  }

  const remote = !localHosts.has(actualHost);
  if (remote) {
    if (configured(env, "MASANAWA_ALPHA_BOOTSTRAP_REMOTE_CONFIRM") !== ALPHA_BOOTSTRAP_REMOTE_ACK) {
      deny("nonlocal databases require a separate confirmation");
    }
    if (!nonProductionDbName.test(databaseName)) {
      deny("nonlocal demo database name must clearly identify a nonproduction target");
    }
  }
  return { remote };
}
