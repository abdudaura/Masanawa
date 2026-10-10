#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

function fail(message, code = 1) {
  const error = new Error(message);
  error.exitCode = code;
  throw error;
}

const REQUIRED_VALIDATION_CATEGORIES = Object.freeze(["CABLEBILLS", "UTILITYBILLS"]);

export function validateProductionQualificationInputs(env = process.env) {
  const raw = env.FLUTTERWAVE_QUALIFICATION_TARGETS_JSON?.trim() ?? "";
  if (!raw) {
    fail(
      "FLUTTERWAVE_QUALIFICATION_TARGETS_JSON is required with real Cable and Electricity validation targets",
      2,
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail("FLUTTERWAVE_QUALIFICATION_TARGETS_JSON is not valid JSON", 1);
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    fail("qualification targets must be a non-empty array", 2);
  }

  const categories = new Set(
    parsed
      .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
      .map((entry) => String(entry.categoryCode ?? "").trim())
      .filter(Boolean),
  );

  const missing = REQUIRED_VALIDATION_CATEGORIES.filter((code) => !categories.has(code));
  if (missing.length > 0) {
    fail(
      `qualification targets are missing required categories: ${missing.join(",")}`,
      2,
    );
  }

  return Object.freeze({
    targetCount: parsed.length,
    requiredValidationCategories: REQUIRED_VALIDATION_CATEGORIES,
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolve({ code: code ?? 1, signal, stdout, stderr });
    });
  });
}

async function main() {
  validateProductionQualificationInputs();
  const dir = await mkdtemp(join(tmpdir(), "masanawa-billing-qualification-"));
  const reportPath = join(dir, "flutterwave-report.json");
  try {
    const collector = await run(process.execPath, [
      "scripts/flutterwave-billing-catalog-qualification.mjs",
    ]);
    if (collector.code !== 0) {
      process.stderr.write(collector.stderr);
      fail("read-only Flutterwave qualification collector failed", collector.code || 1);
    }

    // Parse before persisting to make malformed output fail closed.
    const report = JSON.parse(collector.stdout);
    await writeFile(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 });

    const gate = await run(process.execPath, [
      "scripts/flutterwave-billing-qualification-gate.mjs",
      reportPath,
    ]);

    if (gate.stdout) process.stdout.write(gate.stdout);
    if (gate.stderr) process.stderr.write(gate.stderr);

    if (gate.code === 0) {
      process.stderr.write("[billing-qualification] launch evidence accepted\n");
      return;
    }
    if (gate.code === 2) {
      fail("launch billing evidence is incomplete; billing must remain disabled", 2);
    }
    fail("billing qualification gate failed", gate.code || 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// Importing this module for read-only validation must never start provider
// qualification. Only an explicit CLI invocation may attempt its preflight.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    const code =
      error && typeof error === "object" && Number.isInteger(error.exitCode)
        ? error.exitCode
        : 1;
    process.stderr.write(
      `billing production qualification failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = code;
  });
}
