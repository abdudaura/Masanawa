import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const canonicalAdapterFamilies = Object.freeze([
  "storage",
  "providers",
  "channels",
  "devices",
  "media",
  "inference",
] as const);

interface PackageManifest {
  readonly name?: string;
  readonly private?: boolean;
  readonly type?: string;
  readonly scripts?: Readonly<Record<string, string>>;
  readonly exports?: Readonly<Record<string, unknown>>;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
}

interface TypeScriptConfig {
  readonly extends?: string;
  readonly exclude?: readonly string[];
  readonly compilerOptions?: Readonly<Record<string, unknown>>;
}

interface AdapterManifest {
  readonly schemaVersion?: number;
  readonly family?: string;
  readonly implementation?: string;
  readonly package?: string;
  readonly registration?: string;
}

type WorkspaceKind = "package" | "service" | "app" | "adapter" | "infra";

interface WorkspacePackage {
  readonly root: string;
  readonly kind: WorkspaceKind;
  readonly manifest: PackageManifest;
}

interface AdapterPackage extends WorkspacePackage {
  readonly family: string;
  readonly implementation: string;
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function directories(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function sourceFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.isFile() && /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/u.test(entry.name)
      ? [full]
      : [];
  });
}

function discoverWorkspaces(root: string, kind: WorkspaceKind): WorkspacePackage[] {
  if (!fs.existsSync(root)) return [];
  const packageJson = path.join(root, "package.json");
  if (fs.existsSync(packageJson)) {
    return [Object.freeze({
      root,
      kind,
      manifest: readJson<PackageManifest>(packageJson),
    })];
  }
  return directories(root).flatMap((name) =>
    discoverWorkspaces(path.join(root, name), kind),
  );
}

function internalPackageName(specifier: string): string | null {
  const match = /^(@masanawa\/[^/]+)(?:\/.*)?$/u.exec(specifier);
  return match?.[1] ?? null;
}

const workspacePackages = [
  ...discoverWorkspaces(path.resolve("packages"), "package"),
  ...discoverWorkspaces(path.resolve("services"), "service"),
  ...discoverWorkspaces(path.resolve("apps"), "app"),
  ...discoverWorkspaces(path.resolve("adapters"), "adapter"),
  ...discoverWorkspaces(path.resolve("infra"), "infra"),
];

const workspaceByName = new Map(
  workspacePackages.flatMap((workspace) =>
    workspace.manifest.name ? [[workspace.manifest.name, workspace] as const] : [],
  ),
);

const adapterRoot = path.resolve("adapters");
const adapterPackages: AdapterPackage[] = canonicalAdapterFamilies.flatMap((family) =>
  directories(path.join(adapterRoot, family))
    .filter((implementation) =>
      fs.existsSync(path.join(adapterRoot, family, implementation, "package.json")),
    )
    .map((implementation) => {
      const root = path.join(adapterRoot, family, implementation);
      return Object.freeze({
        root,
        kind: "adapter" as const,
        family,
        implementation,
        manifest: readJson<PackageManifest>(path.join(root, "package.json")),
      });
    }),
);

describe("adapter architecture", () => {
  it("uses only canonical external-edge adapter families", () => {
    const unknown = directories(adapterRoot).filter(
      (family) =>
        !(canonicalAdapterFamilies as readonly string[]).includes(family),
    );
    expect(unknown).toEqual([]);
  });

  it("keeps Node service hosting outside the adapter tree", () => {
    expect(fs.existsSync(path.join(adapterRoot, "runtime"))).toBe(false);
    expect(fs.existsSync(path.resolve("infra/runtime/node/package.json"))).toBe(true);
  });

  for (const adapter of adapterPackages) {
    describe(`${adapter.family}/${adapter.implementation}`, () => {
      it("declares explicit registration and a public package boundary", () => {
        const registration = readJson<AdapterManifest>(
          path.join(adapter.root, "adapter.json"),
        );
        expect(registration).toEqual({
          schemaVersion: 1,
          family: adapter.family,
          implementation: adapter.implementation,
          package: adapter.manifest.name,
          registration: "explicit",
        });
        expect(adapter.manifest.private).toBe(true);
        expect(adapter.manifest.type).toBe("module");
        expect(adapter.manifest.scripts?.typecheck).toBe("tsc -p tsconfig.json");
        expect(adapter.manifest.scripts?.build).toBe("tsc -p tsconfig.build.json");
        expect(adapter.manifest.exports?.["."]).toEqual({
          types: "./src/index.ts",
          production: "./dist/index.js",
          default: "./src/index.ts",
        });
        expect(fs.existsSync(path.join(adapter.root, "src/index.ts"))).toBe(true);
      });

      it("inherits the strict root config and emits declaration-bearing builds", () => {
        const config = readJson<TypeScriptConfig>(
          path.join(adapter.root, "tsconfig.json"),
        );
        const build = readJson<TypeScriptConfig>(
          path.join(adapter.root, "tsconfig.build.json"),
        );
        expect(config.extends).toBe("../../../tsconfig.base.json");
        expect(build.extends).toBe("./tsconfig.json");
        expect(build.compilerOptions).toMatchObject({
          noEmit: false,
          rootDir: "./src",
          outDir: "./dist",
          declaration: true,
          declarationMap: true,
          sourceMap: true,
        });
        expect(build.exclude).toContain("src/**/*.test.ts");
      });

      it("depends inward only on canonical packages and never on another adapter", () => {
        const declared = new Set([
          ...Object.keys(adapter.manifest.dependencies ?? {}),
          ...Object.keys(adapter.manifest.devDependencies ?? {}),
        ]);

        for (const dependency of declared) {
          const target = workspaceByName.get(dependency);
          if (!target) continue;
          expect(
            target.kind,
            `${adapter.manifest.name} must not depend on ${dependency} from ${target.kind}`,
          ).toBe("package");
        }

        for (const file of sourceFiles(path.join(adapter.root, "src"))) {
          const source = fs.readFileSync(file, "utf8");
          for (const match of source.matchAll(
            /(?:from\s+|import\s*\()\s*["']([^"']+)["']/gu,
          )) {
            const specifier = match[1]!;
            if (specifier.startsWith(".")) {
              const resolved = path.resolve(path.dirname(file), specifier);
              expect(
                resolved === adapter.root ||
                  resolved.startsWith(`${adapter.root}${path.sep}`),
                `${path.relative(process.cwd(), file)} must not escape its adapter package via ${specifier}`,
              ).toBe(true);
              continue;
            }

            const packageName = internalPackageName(specifier);
            if (!packageName) continue;
            const target = workspaceByName.get(packageName);
            expect(
              target,
              `${path.relative(process.cwd(), file)} imports unknown workspace package ${packageName}`,
            ).toBeDefined();
            expect(
              target?.kind,
              `${path.relative(process.cwd(), file)} must depend inward on packages, not ${target?.kind ?? "unknown"} ${packageName}`,
            ).toBe("package");
            expect(
              declared.has(packageName),
              `${path.relative(process.cwd(), file)} must declare ${packageName} in its manifest`,
            ).toBe(true);
          }
        }
      });
    });
  }
});
