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
    const workflow = fs.readFileSync(
      path.resolve(".github/workflows/foundation-ci.yml"),
      "utf8",
    );
    expect(workflow).toContain("- name: Typecheck\n        run: pnpm typecheck");
    // Test/provider/build execute even after a failed independent check; the
    // job's earlier failure still remains visible and cannot turn green.
    // Comments between a step label and its guard must not defeat coverage.
    expect(workflow).toMatch(
      /- name: Test\n(?:\s*#.*\n)*\s*if: \$\{\{ !cancelled\(\) \}\}\n\s*run: pnpm test:ci/u,
    );
    expect(workflow).toMatch(
      /- name: Provider qualification tooling tests\n(?:\s*#.*\n)*\s*if: \$\{\{ !cancelled\(\) \}\}\n\s*run: >-/u,
    );
    expect(workflow).toMatch(
      /- name: Build\n(?:\s*#.*\n)*\s*if: \$\{\{ !cancelled\(\) \}\}\n\s*run: pnpm build/u,
    );
    expect(workflow).not.toContain("run: pnpm check");

    const mobile = fs.readFileSync(
      path.resolve(".github/workflows/mobile-build.yml"),
      "utf8",
    );
    // Informational lints remain visible, but do not block real build/tests;
    // compilation errors and analyzer warnings must still fail this step.
    expect(mobile).toMatch(
      /- name: Analyze\n(?:\s*#.*\n)*\s*run: flutter analyze --no-fatal-infos/u,
    );
    expect(mobile).not.toContain("--no-fatal-warnings");
    expect(mobile).not.toContain("flutter analyze || true");
    expect(mobile).toMatch(
      /- name: Test\n(?:\s*#.*\n)*\s*if: \$\{\{ !cancelled\(\) \}\}\n\s*run: flutter test/u,
    );
    expect(mobile).toMatch(
      /- name: Phone \(production APK\)\n(?:\s*#.*\n)*\s*if: \$\{\{ !cancelled\(\) \}\}\n\s*run: flutter build apk --release/u,
    );
    expect(mobile).toMatch(
      /- name: Web \(release\)\n(?:\s*#.*\n)*\s*if: \$\{\{ !cancelled\(\) \}\}\n\s*run: flutter build web --release/u,
    );
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
