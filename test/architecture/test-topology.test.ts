import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const suites = Object.freeze([
  "contracts",
  "integration",
  "e2e",
  "parity",
  "security",
  "recovery",
  "load",
  "chaos",
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

    for (const suite of suites) {
      expect(manifest.scripts?.[`test:${suite}`]).toBe(
        `vitest run tests/${suite} --passWithNoTests`,
      );
    }
  });

  it("keeps CI failure classes visible without changing the local check sequence", () => {
    const workflow = fs.readFileSync(
      path.resolve(".github/workflows/foundation-ci.yml"),
      "utf8",
    );
    expect(workflow).toContain("- name: Typecheck\n        run: pnpm typecheck");
    expect(workflow).toContain("- name: Test\n        run: pnpm test:ci");
    expect(workflow).toContain("- name: Build\n        run: pnpm build");
    expect(workflow).not.toContain("run: pnpm check");
  });

  it("starts recovery and chaos with real deterministic evidence, not sentinels", () => {
    expect(
      fs.existsSync(path.resolve("tests/recovery/restart-scenario.test.ts")),
    ).toBe(true);
    expect(
      fs.existsSync(path.resolve("tests/chaos/fault-injection.test.ts")),
    ).toBe(true);
    expect(
      fs.existsSync(path.resolve("test/support/fault-injection.test.ts")),
    ).toBe(false);
  });
});
