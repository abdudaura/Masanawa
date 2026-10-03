import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));

export function agentRuntimeVerificationPlan({ unitOnly = false } = {}) {
  return [
    ["--filter", "@masanawa/gateway-service...", "build"],
    ["--filter", "@masanawa/ops-service...", "build"],
    ["exec", "tsc", "-p", "tsconfig.json"],
    ["--filter", "@masanawa/gateway-service...", "typecheck"],
    ["--filter", "@masanawa/ops-service...", "typecheck"],
    ["exec", "vitest", "run", "packages/agents", "packages/memory", "packages/world", "services/gateway", "services/ops", "test/architecture", "tests/contracts", "adapters/storage/postgres/src/agents/context.test.ts"],
    ...(!unitOnly ? [[
      "exec", "vitest", "run",
      "tests/integration/character-session-acceptance.test.ts",
      "tests/integration/agent-run-acceptance.test.ts",
    ]] : []),
  ];
}

export function verifyAgentRuntime({ args, env, run = spawnSync }) {
  if (args.some((arg) => arg !== "--unit-only")) {
    throw new Error("Supported option: --unit-only");
  }
  const unitOnly = args.includes("--unit-only");
  if (!unitOnly) {
    const connection = env.MASANAWA_TEST_DATABASE_URL?.trim();
    if (!connection) {
      throw new Error("MASANAWA_TEST_DATABASE_URL is required; PostgreSQL acceptance must not silently skip. Use --unit-only only for checks without database acceptance.");
    }
    let url;
    try { url = new URL(connection); } catch { throw new Error("Invalid test database URL."); }
    if (!["postgres:", "postgresql:"].includes(url.protocol)) {
      throw new Error("Invalid test database URL protocol.");
    }
  }
  // npm_execpath is the actual pnpm launcher set by pnpm run. pnpm 12 may
  // provide a standalone executable; older installers use a JS launcher.
  if (!env.npm_execpath || !/pnpm/i.test(env.npm_execpath)) {
    throw new Error("Run this helper through pnpm alpha:verify.");
  }
  for (const step of agentRuntimeVerificationPlan({ unitOnly })) {
    console.log("Agent runtime check:", step.join(" "));
    const javascript = /\.[cm]?js$/i.test(env.npm_execpath);
    const result = run(
      javascript ? process.execPath : env.npm_execpath,
      javascript ? [env.npm_execpath, ...step] : step,
      {
      cwd: root, env, stdio: "inherit", shell: false,
      },
    );
    if (result.error || result.status !== 0) {
      throw new Error("Agent runtime verification failed; see the preceding check output.");
    }
  }
  console.log(unitOnly
    ? "Build/typecheck/unit/architecture checks passed. PostgreSQL acceptance was NOT run."
    : "Build/typecheck/unit/architecture and PostgreSQL runtime acceptance checks passed. The full Foundation CI and mobile gates remain separate.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    verifyAgentRuntime({ args: process.argv.slice(2), env: process.env });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Agent runtime verification failed.");
    process.exitCode = 1;
  }
}
