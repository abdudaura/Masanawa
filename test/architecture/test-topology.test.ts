import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const futureSuites = Object.freeze([
  "integration",
  "e2e",
  "parity",
] as const);

const requiredSuites = Object.freeze([
  "contracts",
  "security",
  "recovery",
  "load",
  "chaos",
] as const);

const suites = Object.freeze([
  ...futureSuites,
  ...requiredSuites,
] as const);

interface RootManifest {
  readonly scripts?: Readonly<Record<string, string>>;
}

interface RootTsConfig {
  readonly include?: readonly string[];
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

describe("test topology", () => {
  it("keeps every canonical cross-cutting suite explicit and documented", () => {
    for (const suite of suites) {
      const root = path.resolve("tests", suite);
      expect(fs.existsSync(root), `missing tests/${suite}`).toBe(true);
      expect(
        fs.existsSync(path.join(root, "README.md")),
        `tests/${suite} must document suite ownership`,
      ).toBe(true);
      expect(
        fs.existsSync(path.join(root, ".gitkeep")),
        `tests/${suite} must not remain an empty placeholder`,
      ).toBe(false);
    }
  });

  it("typechecks and executes the cross-cutting test tree in the default gate", () => {
    const tsconfig = readJson<RootTsConfig>(path.resolve("tsconfig.json"));
    expect(tsconfig.include).toContain("tests/**/*.ts");

    const vitest = fs.readFileSync(path.resolve("vitest.config.ts"), "utf8");
    expect(vitest).toContain('"tests/**/*.test.ts"');
  });

  it("publishes one focused command for every suite and a single all-tests CI gate", () => {
    const manifest = readJson<RootManifest>(path.resolve("package.json"));
    expect(manifest.scripts?.check).toBe(
      "pnpm typecheck && pnpm test:ci && pnpm build",
    );
    expect(manifest.scripts?.test).toBe("pnpm test:ci");
    expect(manifest.scripts?.["test:ci"]).toBe("vitest run");
    expect(manifest.scripts?.["test:architecture"]).toBe(
      "vitest run test/architecture",
    );
    expect(manifest.scripts?.["architecture:check"]).toBe(
      "pnpm test:architecture",
    );

    for (const suite of futureSuites) {
      expect(manifest.scripts?.[`test:${suite}`]).toBe(
        `vitest run tests/${suite} --passWithNoTests`,
      );
    }
    for (const suite of requiredSuites) {
      expect(manifest.scripts?.[`test:${suite}`]).toBe(
        `vitest run tests/${suite}`,
      );
    }
  });

  it("keeps CI failure classes visible without changing the local check sequence", () => {
    const workflow = fs
      .readFileSync(path.resolve(".github/workflows/foundation-ci.yml"), "utf8")
      .replace(/\r\n/g, "\n");
    expect(workflow).toContain("- name: Typecheck\n        run: pnpm typecheck");
    expect(workflow).toContain("- name: Test\n        run: pnpm test:ci");
    expect(workflow).toContain("- name: Build\n        run: pnpm build");
    expect(workflow).not.toContain("run: pnpm check");
  });

  it("requires real security/recovery/load/chaos evidence, not sentinels", () => {
    const requiredEvidence = [
      "tests/contracts/public-api-lifecycle.test.ts",
      "tests/security/credential-secrecy.test.ts",
      "tests/recovery/restart-scenario.test.ts",
      "tests/load/provider-registry-load.test.ts",
      "tests/chaos/fault-injection.test.ts",
    ];

    for (const file of requiredEvidence) {
      expect(fs.existsSync(path.resolve(file)), `missing ${file}`).toBe(true);
    }
    expect(
      fs.existsSync(path.resolve("test/support/fault-injection.test.ts")),
    ).toBe(false);
  });
});
