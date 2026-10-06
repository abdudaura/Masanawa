#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function fail(message, code = 1) {
  const error = new Error(message);
  error.exitCode = code;
  throw error;
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
