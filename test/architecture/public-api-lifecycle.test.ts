import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  readonly name?: string;
  readonly private?: boolean;
  readonly exports?: Readonly<Record<string, unknown>>;
}

const workspaceRoots = ["packages", "services", "apps", "adapters", "infra"] as const;

function directories(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (!entry.isDirectory()) return [];
    if (fs.existsSync(path.join(full, "package.json"))) return [full];
    return directories(full);
  });
}

function sourceFiles(root: string): string[] {
  const sourceRoot = path.join(root, "src");
  if (!fs.existsSync(sourceRoot)) return [];
  const walk = (directory: string): string[] =>
    fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.isFile() && /\.[cm]?[jt]sx?$/u.test(entry.name) ? [full] : [];
    });
  return walk(sourceRoot);
}

function imports(source: string): string[] {
  return [...source.matchAll(
    /(?:from\s+|import\s*\(\s*|import\s+)(?:["'])(@masanawa\/[^"']+)["']/gu,
  )]
    .map((match) => match[1]!)
    .sort();
}

describe("public API architecture", () => {
  const canonicalPackages = directories(path.resolve("packages")).sort();
  const allWorkspaces = workspaceRoots
    .flatMap((root) => directories(path.resolve(root)))
    .sort();

  it("keeps canonical packages private behind one supported root entrypoint", () => {
    for (const root of canonicalPackages) {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(root, "package.json"), "utf8"),
      ) as PackageManifest;

      expect(manifest.name, path.relative(process.cwd(), root)).toMatch(
        /^@masanawa\/[a-z0-9-]+$/u,
      );
      expect(
        manifest.private,
        `${manifest.name} must remain a coordinated private workspace`,
      ).toBe(true);
      expect(
        Object.keys(manifest.exports ?? {}),
        `${manifest.name} must expose only its root API`,
      ).toEqual(["."]);
      expect(manifest.exports?.["."]).toEqual({
        types: "./src/index.ts",
        production: "./dist/index.js",
        default: "./src/index.ts",
      });
      expect(
        fs.existsSync(path.join(root, "src/index.ts")),
        `${manifest.name} needs src/index.ts`,
      ).toBe(true);
    }
  });

  it("forbids deep Masanawa imports across every production workspace", () => {
    for (const workspace of allWorkspaces) {
      for (const file of sourceFiles(workspace)) {
        for (const specifier of imports(fs.readFileSync(file, "utf8"))) {
          expect(
            /^@masanawa\/[a-z0-9-]+$/u.test(specifier),
            `${path.relative(process.cwd(), file)} must import a Masanawa owner through its public root, not ${specifier}`,
          ).toBe(true);
        }
      }
    }
  });
});
