import assert from "node:assert/strict";
import test from "node:test";
import {
  ALPHA_BOOTSTRAP_ACK,
  ALPHA_BOOTSTRAP_REMOTE_ACK,
  assertAlphaBootstrapTarget,
} from "./alpha-bootstrap-safety.mjs";

const good = Object.freeze({
  MASANAWA_DATABASE_URL: "postgresql://demo:secret@127.0.0.1:5432/masanawa_dev",
  MASANAWA_ALPHA_BOOTSTRAP_CONFIRM: ALPHA_BOOTSTRAP_ACK,
  MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_DATABASE: "masanawa_dev",
  MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_HOST: "127.0.0.1",
  NODE_ENV: "development",
});

function rejected(overrides, reason) {
  assert.throws(
    () => assertAlphaBootstrapTarget({ ...good, ...overrides }),
    (error) => error instanceof Error &&
      error.message.startsWith("Alpha bootstrap refused:") &&
      error.message.includes(reason) &&
      !error.message.includes("secret") &&
      !error.message.includes("127.0.0.1"),
  );
}

test("explicitly confirmed localhost development target accepted", () => {
  assert.deepEqual(assertAlphaBootstrapTarget(good), { remote: false });
});

test("DATABASE_URL fallback also requires exact opt-in and host/database pin", () => {
  const env = { ...good, MASANAWA_DATABASE_URL: undefined,
    DATABASE_URL: "postgres://demo:secret@127.0.0.1:5432/masanawa_dev" };
  assert.deepEqual(assertAlphaBootstrapTarget(env), { remote: false });
});

test("PostgreSQL IPv6 loopback accepted only when host pinned", () => {
  const env = { ...good,
    MASANAWA_DATABASE_URL: "postgres://demo:secret@[::1]:5432/masanawa_dev",
    MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_HOST: "::1" };
  assert.deepEqual(assertAlphaBootstrapTarget(env), { remote: false });
});

test("missing or incorrect demo-write acknowledgement denied", () => {
  rejected({ MASANAWA_ALPHA_BOOTSTRAP_CONFIRM: undefined }, "confirmation");
  rejected({ MASANAWA_ALPHA_BOOTSTRAP_CONFIRM: "yes" }, "confirmation");
});

test("all known production environment labels denied before connectivity", () => {
  for (const key of [
    "NODE_ENV", "MASANAWA_ENVIRONMENT", "RAILWAY_ENVIRONMENT",
    "RAILWAY_ENVIRONMENT_NAME", "VERCEL_ENV", "APP_ENV", "ENVIRONMENT"
  ]) {
    rejected({ [key]: "Production" }, "production environment marker");
    rejected({ [key]: "live" }, "production environment marker");
  }
});

test("missing/mismatched target pins denied", () => {
  rejected({ MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_HOST: undefined }, "expected database host");
  rejected({ MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_HOST: "localhost" }, "expected database host");
  rejected({ MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_DATABASE: undefined }, "expected database name");
  rejected({ MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_DATABASE: "masanawa_prod" }, "expected database name");
});

test("invalid/unsupported URL and system DBs denied", () => {
  rejected({ MASANAWA_DATABASE_URL: undefined, DATABASE_URL: undefined }, "connection string");
  rejected({ MASANAWA_DATABASE_URL: "not a URL" }, "invalid PostgreSQL connection string");
  rejected({ MASANAWA_DATABASE_URL: "mysql://demo:secret@127.0.0.1:5432/masanawa_dev" }, "PostgreSQL URL");
  for (const database of ["postgres", "template0", "template1", "bad%2Fname", "bad%00name", ""]) {
    rejected({
      MASANAWA_DATABASE_URL: `postgresql://demo:secret@127.0.0.1:5432/${database}`,
      MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_DATABASE: database,
    }, database === "" ? "database name" : "dedicated non-system database");
  }
});

test("nonlocal host requires distinct opt-in even when target pins match", () => {
  const remote = {
    MASANAWA_DATABASE_URL: "postgresql://demo:secret@db.example.test/masanawa_dev",
    MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_DATABASE: "masanawa_dev",
    MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_HOST: "db.example.test",
  };
  rejected(remote, "nonlocal databases");
  assert.deepEqual(assertAlphaBootstrapTarget({
    ...good, ...remote,
    MASANAWA_ALPHA_BOOTSTRAP_REMOTE_CONFIRM: ALPHA_BOOTSTRAP_REMOTE_ACK,
  }), { remote: true });
});

test("remote production-like and generic railway DB names denied even with opt-ins", () => {
  for (const db of ["railway", "masanawa", "masanawa_production"]) {
    rejected({
      MASANAWA_DATABASE_URL: `postgresql://demo:secret@db.example.test/${db}`,
      MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_DATABASE: db,
      MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_HOST: "db.example.test",
      MASANAWA_ALPHA_BOOTSTRAP_REMOTE_CONFIRM: ALPHA_BOOTSTRAP_REMOTE_ACK,
    }, "nonproduction target");
  }
});

test("no error ever contains raw connection URI or password", () => {
  const uri = "postgresql://user:s3cr3t-value@production.example.test/masanawa_prod";
  try {
    assertAlphaBootstrapTarget({
      ...good,
      MASANAWA_DATABASE_URL: uri,
      MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_HOST: "production.example.test",
      MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_DATABASE: "masanawa_prod",
    });
    assert.fail("must reject");
  } catch (error) {
    assert.doesNotMatch(error.message, /s3cr3t|production\.example|postgresql:\/\//);
  }
});
