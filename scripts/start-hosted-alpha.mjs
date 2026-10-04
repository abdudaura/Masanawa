import { createServer } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createPostgresPool, runMigrations, characterContextMigrationRoots } from "@masanawa/postgres";
import { decryptNurainGeminiCredentials } from "./import-nurain-gemini.mjs";
import { selectAlphaGeminiCredentials } from "./alpha-credential-selection.mjs";

if (process.env.MASANAWA_ALPHA_GEMINI_IMPORTED_CREDENTIALS_JSON) {
  try {
    if (process.env.MASANAWA_ALPHA_GEMINI_API_KEY || process.env.MASANAWA_ALPHA_GEMINI_API_KEYS_JSON) throw new Error();
    // Legacy names are read only by this explicit migration bridge on the reused worker.
    const previous = (process.env["CREDENTIAL_ENCRYPTION_KEY_PREVIOUS"] ?? "").split(",").map(value => value.trim()).filter(Boolean);
    const keys = decryptNurainGeminiCredentials(process.env.MASANAWA_ALPHA_GEMINI_IMPORTED_CREDENTIALS_JSON, [process.env["CREDENTIAL_ENCRYPTION_KEY"], ...previous]);
    process.env.MASANAWA_ALPHA_GEMINI_API_KEYS_JSON = JSON.stringify(selectAlphaGeminiCredentials(keys, process.env.MASANAWA_ALPHA_GEMINI_ACTIVE_CREDENTIAL_INDEX));
    delete process.env.MASANAWA_ALPHA_GEMINI_IMPORTED_CREDENTIALS_JSON;
  } catch {
    console.error("Hosted Alpha credential import failed; no key values are logged.");
    process.exit(1);
  }
}
const needed = ["MASANAWA_BOOTSTRAP_ADMIN_DATABASE_URL", "MASANAWA_ALPHA_DEV_TOKEN", "MASANAWA_ALPHA_GEMINI_MODEL"];
const missing = needed.filter(key => !process.env[key]?.trim());
if (!process.env.MASANAWA_ALPHA_GEMINI_API_KEY?.trim() && !process.env.MASANAWA_ALPHA_GEMINI_API_KEYS_JSON?.trim()) missing.push("MASANAWA_ALPHA_GEMINI_API_KEYS_JSON");
if (missing.length) {
  // A real setup endpoint, never an imitation of the Agent API or successful readiness.
  createServer((request, response) => {
    response.setHeader("Content-Type", "application/json");
    response.setHeader("Cache-Control", "no-store");
    response.statusCode = request.url === "/healthz" ? 200 : 503;
    response.end(JSON.stringify({ service: "masanawa-hosted-alpha-setup", status: "configuration_required", ready: false, missing }));
  }).listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
} else {
  try { await start(); } catch {
    // Keep connection strings, bootstrap output and provider keys out of hosted logs.
    console.error("Hosted Alpha initialization failed. Check database access/configuration in the hosting dashboard.");
    process.exitCode = 1;
  }
}

async function start() {
  const adminUrl = new URL(process.env.MASANAWA_BOOTSTRAP_ADMIN_DATABASE_URL);
  if (!["postgres:", "postgresql:"].includes(adminUrl.protocol)) throw new Error("Invalid database protocol");
  const databaseName = "masanawa_alpha";
  const admin = createPostgresPool({ connectionString: adminUrl.toString(), applicationName: "masanawa-alpha-provision", max: 1 });
  try {
    const version = await admin.query("SHOW server_version_num");
    if (Number(version.rows[0].server_version_num) < 180000 || Number(version.rows[0].server_version_num) >= 190000) throw new Error("PostgreSQL 18 required");
    const existing = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
    if (!existing.rowCount) await admin.query('CREATE DATABASE "masanawa_alpha" TEMPLATE template0');
  } finally { await admin.end(); }
  adminUrl.pathname = `/${databaseName}`;
  const connectionString = adminUrl.toString();
  const pool = createPostgresPool({ connectionString, applicationName: "masanawa-alpha-initialize", max: 2 });
  const client = await pool.connect();
  const key = "masanawa-hosted-alpha-v1";
  let values;
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [key]);
    await client.query(`CREATE TABLE IF NOT EXISTS public.masanawa_hosted_alpha_config (
      deployment_key text PRIMARY KEY, identity_references jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CHECK (NOT (identity_references ? 'MASANAWA_ALPHA_DEV_TOKEN'))
    )`);
    const existing = await client.query("SELECT identity_references FROM public.masanawa_hosted_alpha_config WHERE deployment_key = $1", [key]);
    if (existing.rows[0]) {
      values = existing.rows[0].identity_references;
      // Upgrade the registered Alpha through checksum-checked, transactional migrations;
      // never rerun bootstrap or replace its canonical identities.
      await runMigrations(pool, characterContextMigrationRoots());
    }
    else {
      // Never adopt an unrelated existing database or silently add a second Alpha.
      const canonical = await client.query("SELECT to_regclass('identity.tenants') AS tenants");
      if (canonical.rows[0].tenants) throw new Error("Existing unregistered canonical database requires operator adoption");
      const directory = mkdtempSync(join(tmpdir(), "masanawa-alpha-"));
      try {
        const output = join(directory, "config.json");
        const result = spawnSync(process.execPath, ["--conditions=production", "scripts/alpha-bootstrap.mjs", "--output", output],
          { env: { ...process.env, MASANAWA_DATABASE_URL: connectionString, DATABASE_URL: connectionString }, stdio: "pipe" });
        if (result.status !== 0 || result.error) throw new Error("Canonical bootstrap failed");
        values = JSON.parse(readFileSync(output, "utf8"));
        delete values.MASANAWA_ALPHA_DEV_TOKEN;
        await client.query("INSERT INTO public.masanawa_hosted_alpha_config (deployment_key, identity_references) VALUES ($1, $2::jsonb)", [key, JSON.stringify(values)]);
      } finally { rmSync(directory, { recursive: true, force: true }); }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [key]);
    client.release(); await pool.end();
  }
  const allowed = ["MASANAWA_ALPHA_ENABLED", "MASANAWA_ALPHA_TENANT_ID", "MASANAWA_ALPHA_USER_ID", "MASANAWA_ALPHA_POLICY_REVISION", "MASANAWA_ALPHA_RELATIONSHIPS_JSON"];
  if (Object.keys(values).some(name => !allowed.includes(name)) || allowed.some(name => typeof values[name] !== "string" || !values[name])) throw new Error("Invalid deployment references");
  Object.assign(process.env, values, { MASANAWA_DATABASE_URL: connectionString, DATABASE_URL: connectionString });
  // This infrastructure table holds bootstrap references only. Identity remains canonical.
  const { startGatewayService } = await import("../services/gateway/dist/main.js");
  if (process.argv.includes("--verify-credentials")) {
    const keys = JSON.parse(process.env.MASANAWA_ALPHA_GEMINI_API_KEYS_JSON ?? JSON.stringify([process.env.MASANAWA_ALPHA_GEMINI_API_KEY]));
    const results = await Promise.all(keys.map(async (apiKey, index) => {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.MASANAWA_ALPHA_GEMINI_MODEL)}`, {
          headers: { "x-goog-api-key": apiKey }, redirect: "error", signal: AbortSignal.timeout(15000),
        });
        return { index, status: response.status };
      } catch { return { index, status: "unreachable" }; }
    }));
    console.info(`Hosted Alpha credential metadata checks: ${JSON.stringify(results)}`);
  }
  await startGatewayService();
  if (process.argv.includes("--verify-live-audio")) {
    try {
      const { createGeminiLiveAudioRenderer } = await import("../services/gateway/dist/native_audio.js");
      const keys = JSON.parse(process.env.MASANAWA_ALPHA_GEMINI_API_KEYS_JSON ?? JSON.stringify([process.env.MASANAWA_ALPHA_GEMINI_API_KEY]));
      const renderer = createGeminiLiveAudioRenderer({
        apiKey: keys[0],
        model: process.env.MASANAWA_ALPHA_GEMINI_LIVE_MODEL ?? "gemini-3.8-live",
        voiceName: process.env.MASANAWA_ALPHA_GEMINI_LIVE_VOICE ?? "Kore",
        timeoutMs: 20000,
      });
      const result = await renderer.render("Hello. This is a Masanawa native audio verification.");
      console.info(`Hosted Alpha Live audio verification: ${JSON.stringify({ passed: true, mimeType: result.mimeType, durationMs: result.durationMs, byteLength: Buffer.from(result.dataBase64, "base64").length })}`);
    } catch (error) {
      console.error(`Hosted Alpha Live audio verification failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }
  if (process.argv.includes('--verify')) {
    try {
      const { verifyHostedAlpha } = await import('./verify-hosted-alpha.mjs');
      const result = await verifyHostedAlpha({ baseUrl: `http://127.0.0.1:${process.env.PORT ?? 3000}`,
        token: process.env.MASANAWA_ALPHA_DEV_TOKEN });
      console.info(`Hosted Alpha verification: ${JSON.stringify(result)}`);
    } catch (error) {
      console.error(`Hosted Alpha verification failed: ${error.message}`);
      const diagnostic = createPostgresPool({ connectionString, applicationName: "masanawa-alpha-smoke-diagnostic", max: 1 });
      try {
        const result = await diagnostic.query("SELECT failure_code FROM agents.agent_runs WHERE state = 'failed' ORDER BY started_at DESC LIMIT 1");
        const code = result.rows[0]?.failure_code;
        const safeCodes = new Set(["inference.rate_limited", "inference.unavailable", "inference.rejected", "inference.invalid_response", "inference.deadline_exceeded", "alpha.strategy_failed", "alpha.media_strategy_failed"]);
        console.error(`Hosted Alpha failure category: ${safeCodes.has(code) ? code : "unknown"}`);
      } catch { console.error("Hosted Alpha failure category: unavailable"); }
      finally { await diagnostic.end(); }
    }
  }
}
