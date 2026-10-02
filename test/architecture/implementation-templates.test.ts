import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  readonly name?: string;
  readonly private?: boolean;
  readonly type?: string;
  readonly scripts?: Readonly<Record<string, string>>;
  readonly exports?: Readonly<Record<string, unknown>>;
}

interface TypeScriptConfig {
  readonly extends?: string;
  readonly include?: readonly string[];
  readonly exclude?: readonly string[];
  readonly compilerOptions?: Readonly<Record<string, unknown>>;
}

const packageRoot = path.resolve("packages");
const serviceRoot = path.resolve("services");
const canonicalServices = Object.freeze(["gateway", "ops", "presence", "worker"]);

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

function implementedComponents(root: string): string[] {
  return directories(root).filter((name) =>
    fs.existsSync(path.join(root, name, "package.json")),
  );
}

function expectFile(componentRoot: string, relativePath: string): void {
  expect(
    fs.existsSync(path.join(componentRoot, relativePath)),
    `${path.relative(process.cwd(), componentRoot)} must contain ${relativePath}`,
  ).toBe(true);
}

function expectBaseTsConfig(componentRoot: string): void {
  const config = readJson<TypeScriptConfig>(path.join(componentRoot, "tsconfig.json"));
  expect(config.extends).toBe("../../tsconfig.base.json");
  expect(config.include).toContain("src/**/*.ts");
}

describe("production implementation templates", () => {
  it("runs every implemented workspace build through the root production gate", () => {
    const rootManifest = readJson<PackageManifest>(path.resolve("package.json"));
    expect(rootManifest.scripts?.build).toBe("pnpm -r --if-present build");
  });

  it("keeps the service topology coarse and canonical", () => {
    expect(directories(serviceRoot)).toEqual([...canonicalServices]);
  });

  for (const packageName of implementedComponents(packageRoot)) {
    describe(`package ${packageName}`, () => {
      const componentRoot = path.join(packageRoot, packageName);

      it("has the canonical package manifest and public root entrypoint", () => {
        const manifest = readJson<PackageManifest>(
          path.join(componentRoot, "package.json"),
        );
        expect(manifest.name).toBe(`@masanawa/${packageName}`);
        expect(manifest.private).toBe(true);
        expect(manifest.type).toBe("module");
        expect(manifest.scripts?.typecheck).toBe("tsc -p tsconfig.json");
        expect(manifest.scripts?.build).toBe("tsc -p tsconfig.build.json");
        expect(manifest.exports?.["."]).toEqual({
          types: "./src/index.ts",
          production: "./dist/index.js",
          default: "./src/index.ts",
        });
        expectFile(componentRoot, "src/index.ts");
      });

      it("inherits strict TypeScript and emits a declaration-bearing production build", () => {
        expectFile(componentRoot, "tsconfig.json");
        expectFile(componentRoot, "tsconfig.build.json");
        expectBaseTsConfig(componentRoot);

        const build = readJson<TypeScriptConfig>(
          path.join(componentRoot, "tsconfig.build.json"),
        );
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
    });
  }

  for (const serviceName of implementedComponents(serviceRoot)) {
    describe(`service ${serviceName}`, () => {
      const componentRoot = path.join(serviceRoot, serviceName);

      it("has the canonical service manifest and lifecycle entrypoints", () => {
        expect(canonicalServices).toContain(serviceName);
        const manifest = readJson<PackageManifest>(
          path.join(componentRoot, "package.json"),
        );
        expect(manifest.name).toBe(`@masanawa/${serviceName}-service`);
        expect(manifest.private).toBe(true);
        expect(manifest.type).toBe("module");
        expect(manifest.scripts?.typecheck).toBe("tsc -p tsconfig.json");
        expect(manifest.scripts?.build).toBe("tsc -p tsconfig.build.json");
        expect(manifest.scripts?.start).toBe(
          "node --conditions=production dist/main.js",
        );
        expectFile(componentRoot, "src/app.ts");
        expectFile(componentRoot, "src/main.ts");
        expectFile(componentRoot, "src/app.test.ts");
      });

      it("inherits strict TypeScript and emits an executable production build", () => {
        expectFile(componentRoot, "tsconfig.json");
        expectFile(componentRoot, "tsconfig.build.json");
        expectBaseTsConfig(componentRoot);

        const build = readJson<TypeScriptConfig>(
          path.join(componentRoot, "tsconfig.build.json"),
        );
        expect(build.extends).toBe("./tsconfig.json");
        expect(build.compilerOptions).toMatchObject({
          noEmit: false,
          rootDir: "./src",
          outDir: "./dist",
          declaration: false,
          sourceMap: true,
        });
        expect(build.exclude).toContain("src/**/*.test.ts");
      });
    });
  }
});
