import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const allowedDependencies: Readonly<Record<string, ReadonlySet<string>>> = {
  contracts: new Set(),
  rooms: new Set(),
  events: new Set(["contracts"]),
  security: new Set(["contracts", "events"]),
  identity: new Set(["contracts", "events", "security"]),
  world: new Set(["contracts", "events", "security", "identity"]),
  memory: new Set(["contracts", "events", "security", "identity", "world", "workflows"]),
  decisions: new Set(["contracts", "telemetry"]),
  providers: new Set(["contracts", "security", "telemetry"]),
  tools: new Set(["contracts", "security", "events", "providers"]),
  skills: new Set(["contracts", "security", "tools", "workflows"]),
  workflows: new Set(["contracts", "events", "security", "tools", "decisions"]),
  agents: new Set([
    "contracts",
    "identity",
    "memory",
    "world",
    "decisions",
    "skills",
    "workflows",
    "providers",
    "security",
  ]),
  devices: new Set([
    "contracts",
    "events",
    "security",
    "identity",
    "tools",
    "providers",
  ]),
  perception: new Set(["contracts", "security", "events"]),
  proactivity: new Set(["contracts", "security", "events", "workflows", "identity", "world"]),
  commerce: new Set(["contracts", "events", "security", "workflows", "tools", "providers"]),
  telemetry: new Set(["contracts"]),
  plugins: new Set(["contracts", "security", "tools", "skills", "providers", "events"]),
};

function packageNameFromSpecifier(specifier: string): string | null {
  const match = /^@masanawa\/([^/]+)(?:\/.*)?$/u.exec(specifier);
  return match?.[1] ?? null;
}

function sourceFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(full);
    }
    return entry.isFile() && entry.name.endsWith(".ts") ? [full] : [];
  });
}

describe("package architecture", () => {
  const packagesRoot = path.resolve("packages");
  const existing = fs.existsSync(packagesRoot)
    ? fs
        .readdirSync(packagesRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(packagesRoot, entry.name, "package.json")))
        .map((entry) => entry.name)
        .sort()
    : [];

  it("knows every canonical package that exists", () => {
    const unknown = existing.filter((name) => !(name in allowedDependencies));
    expect(unknown).toEqual([]);
  });

  for (const packageName of existing) {
    it(`${packageName} imports only allowed Masanawa packages`, () => {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(packagesRoot, packageName, "package.json"), "utf8"),
      ) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      const declared = new Set([
        ...Object.keys(packageJson.dependencies ?? {}),
        ...Object.keys(packageJson.devDependencies ?? {}),
      ]);
      const masanawaDeclared = [...declared]
        .map(packageNameFromSpecifier)
        .filter((value): value is string => value !== null);

      for (const dependency of masanawaDeclared) {
        expect(
          allowedDependencies[packageName]?.has(dependency),
          `${packageName} must not depend on ${dependency}`,
        ).toBe(true);
      }

      for (const file of sourceFiles(path.join(packagesRoot, packageName, "src"))) {
        const source = fs.readFileSync(file, "utf8");
        for (const match of source.matchAll(
          /(?:from\s+|import\s*\()\s*["'](@masanawa\/[^"']+)["']/gu,
        )) {
          const specifier = match[1]!;
          const dependency = packageNameFromSpecifier(specifier);
          if (!dependency) {
            continue;
          }
          expect(
            allowedDependencies[packageName]?.has(dependency),
            `${path.relative(process.cwd(), file)} must not import ${specifier}`,
          ).toBe(true);
          expect(
            specifier,
            `${path.relative(process.cwd(), file)} must use package public entrypoint`,
          ).toBe(`@masanawa/${dependency}`);
        }
      }
    });
  }
});
