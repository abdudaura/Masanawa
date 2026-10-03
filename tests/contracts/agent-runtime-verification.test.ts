import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("local runtime acceptance gate", () => {
  it("fails before any checks when the database acceptance URL is missing", () => {
    const result = spawnSync(process.execPath, ["scripts/verify-agent-runtime.mjs"], {
      encoding: "utf8",
      env: { ...process.env, MASANAWA_TEST_DATABASE_URL: "", npm_execpath: "pnpm.cjs" },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("must not silently skip");
    expect(result.stdout).not.toContain("Agent runtime check:");
  });

  it("rejects invalid URLs without printing credentials", () => {
    const result = spawnSync(process.execPath, ["scripts/verify-agent-runtime.mjs"], {
      encoding: "utf8",
      env: { ...process.env, MASANAWA_TEST_DATABASE_URL: "https://user:secret@example.test/db", npm_execpath: "pnpm.cjs" },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid test database URL protocol");
    expect(result.stderr).not.toContain("secret");
    expect(result.stdout).toBe("");
  });
});
