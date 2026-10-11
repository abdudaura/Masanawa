import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type WorkspaceKind = "package" | "adapter" | "infra" | "service" | "app";

interface WorkspaceManifest {
  readonly name?: string;
  readonly version?: string;
  readonly exports?: Readonly<Record<string, unknown>>;
}

interface ApiDeprecation {
  readonly id: string;
  readonly surfaceKind:
    | "workspace-symbol"
    | "http-route"
    | "event-schema"
    | "payload-schema"
    | "tool-version"
    | "provider-version";
  readonly surface: string;
  readonly deprecatedIn: string;
  readonly removalTarget: string;
  readonly replacement: string;
  readonly reason: string;
}

interface ApiLifecycle {
  readonly schemaVersion: number;
  readonly workspace: {
    readonly versionScheme: string;
    readonly reusableExportPolicy: string;
    readonly preReleaseVersion: string;
  };
  readonly http: {
    readonly currentMajor: number;
    readonly supportedMajors: readonly number[];
    readonly operationalUnversionedPaths: readonly string[];
    readonly compatibilityUnversionedPrefixes: readonly string[];
    readonly compatibilityUnversionedRoutes: readonly { readonly method: string; readonly path: string }[];
  };
  readonly deprecations: readonly ApiDeprecation[];
}

interface Workspace {
  readonly root: string;
  readonly kind: WorkspaceKind;
  readonly manifest: WorkspaceManifest;
}

const semver =
  /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u;
const deprecationId = /^[a-z0-9][a-z0-9._-]*$/u;
const surfaceKinds = new Set([
  "workspace-symbol",
  "http-route",
  "event-schema",
  "payload-schema",
  "tool-version",
  "provider-version",
]);

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
    if (entry.isDirectory()) {
      if (["node_modules", "dist", ".next", ".dart_tool", "build", "coverage"].includes(entry.name)) return [];
      return sourceFiles(full);
    }
    return entry.isFile() && /\.(?:ts|tsx|mts|cts|js|mjs|cjs)$/u.test(entry.name)
      ? [full]
      : [];
  });
}

function discover(root: string, kind: WorkspaceKind): Workspace[] {
  if (!fs.existsSync(root)) return [];
  const manifestPath = path.join(root, "package.json");
  if (fs.existsSync(manifestPath)) {
    return [{
      root,
      kind,
      manifest: readJson<WorkspaceManifest>(manifestPath),
    }];
  }
  return directories(root).flatMap((name) =>
    discover(path.join(root, name), kind),
  );
}

const workspaces = [
  ...discover(path.resolve("packages"), "package"),
  ...discover(path.resolve("adapters"), "adapter"),
  ...discover(path.resolve("infra"), "infra"),
  ...discover(path.resolve("services"), "service"),
  ...discover(path.resolve("apps"), "app"),
];

const lifecycle = readJson<ApiLifecycle>(
  path.resolve("docs/API-LIFECYCLE.json"),
);

describe("public API lifecycle", () => {
  it("keeps one valid machine-readable compatibility policy", () => {
    expect(lifecycle.schemaVersion).toBe(1);
    expect(lifecycle.workspace).toEqual({
      versionScheme: "semver",
      reusableExportPolicy: "root-only",
      preReleaseVersion: "0.0.0",
    });

    expect(Number.isSafeInteger(lifecycle.http.currentMajor)).toBe(true);
    expect(lifecycle.http.currentMajor).toBeGreaterThan(0);
    expect(lifecycle.http.supportedMajors).toContain(
      lifecycle.http.currentMajor,
    );
    expect(
      [...new Set(lifecycle.http.supportedMajors)].sort((a, b) => a - b),
    ).toEqual([...lifecycle.http.supportedMajors]);
    for (const major of lifecycle.http.supportedMajors) {
      expect(Number.isSafeInteger(major)).toBe(true);
      expect(major).toBeGreaterThan(0);
    }
    expect(lifecycle.http.operationalUnversionedPaths).toEqual([
      "/healthz",
      "/readyz",
    ]);
    expect(lifecycle.http.compatibilityUnversionedPrefixes).toEqual([
      "/agent",
      "/auth",
      "/billing/return",
      "/creator",
      "/fulfillments",
      "/offers",
      "/quotes",
    ]);
  });

  it("uses SemVer metadata and root-only exports for reusable workspaces", () => {
    for (const workspace of workspaces) {
      expect(
        workspace.manifest.version,
        `${path.relative(process.cwd(), workspace.root)} needs valid SemVer`,
      ).toMatch(semver);

      if (
        workspace.kind !== "package" &&
        workspace.kind !== "adapter" &&
        workspace.kind !== "infra"
      ) {
        continue;
      }

      expect(
        workspace.manifest.exports,
        `${workspace.manifest.name ?? workspace.root} must expose one public root`,
      ).toEqual({
        ".": {
          types: "./src/index.ts",
          production: "./dist/index.js",
          default: "./src/index.ts",
        },
      });
    }
  });

  it("forbids deep Masanawa workspace imports across all production roots", () => {
    const offenders: string[] = [];
    const roots = ["packages", "adapters", "infra", "services", "apps"];

    for (const root of roots) {
      for (const file of sourceFiles(path.resolve(root))) {
        const source = fs.readFileSync(file, "utf8");
        for (const match of source.matchAll(
          /(?:from\s+["']|import\s*\(\s*["']|import\s+["'])(@masanawa\/[^"']+)["']/gu,
        )) {
          const specifier = match[1]!;
          if (!/^@masanawa\/[^/]+$/u.test(specifier)) {
            offenders.push(
              `${path.relative(process.cwd(), file)} -> ${specifier}`,
            );
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it("versions service contract routes while leaving only probes unversioned", () => {
    const operational = new Set(
      lifecycle.http.operationalUnversionedPaths,
    );
    const supported = new Set(
      lifecycle.http.supportedMajors.map((major) => `/v${major}`),
    );
    const compatibility = lifecycle.http.compatibilityUnversionedPrefixes;
    const legacyRoutes = new Set(lifecycle.http.compatibilityUnversionedRoutes.map(route => `${route.method} ${route.path}`));
    const retained = new Set<string>();
    expect(legacyRoutes.size).toBe(lifecycle.http.compatibilityUnversionedRoutes.length);
    for (const route of lifecycle.http.compatibilityUnversionedRoutes) {
      expect(route.method).toMatch(/^(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/u);
      expect(route.path).toMatch(/^\/(?!v\d+(?:\/|$))/u);
      expect(operational.has(route.path)).toBe(false);
    }
    const offenders: string[] = [];

    for (const file of sourceFiles(path.resolve("services")).filter(file => !/\.(?:test|spec)\./u.test(file))) {
      const source = fs.readFileSync(file, "utf8");
      for (const match of source.matchAll(
        /\b(?:app|server|router|routes)\.(get|post|put|patch|delete|options|head)(?:<[^()]*>)?\(\s*["'`]([^"'`]+)["'`]/gu,
      )) {
        const route = match[2]!;
        const key = `${match[1]!.toUpperCase()} ${route}`;
        if (legacyRoutes.has(key)) { retained.add(key); continue; }
        if (operational.has(route)) continue;
        if (compatibility.some(
          (prefix) => route === prefix || route.startsWith(`${prefix}/`),
        )) continue;

        const valid = [...supported].some(
          (prefix) => route === prefix || route.startsWith(`${prefix}/`),
        );
        if (!valid) {
          offenders.push(
            `${path.relative(process.cwd(), file)} -> ${route}`,
          );
        }
      }
    }

    expect(offenders).toEqual([]);
    expect([...legacyRoutes].filter(route => !retained.has(route))).toEqual([]);
  });

  it("requires every source deprecation to be registered and auditable", () => {
    const entries = new Map<string, ApiDeprecation>();
    for (const entry of lifecycle.deprecations) {
      expect(entry.id).toMatch(deprecationId);
      expect(entries.has(entry.id), `duplicate deprecation id ${entry.id}`).toBe(
        false,
      );
      expect(surfaceKinds.has(entry.surfaceKind)).toBe(true);
      for (const value of [
        entry.surface,
        entry.deprecatedIn,
        entry.removalTarget,
        entry.replacement,
        entry.reason,
      ]) {
        expect(value.trim().length).toBeGreaterThan(0);
      }
      entries.set(entry.id, entry);
    }

    const annotated = new Set<string>();
    const invalid: string[] = [];
    for (const root of ["packages", "adapters", "infra", "services", "apps"]) {
      for (const file of sourceFiles(path.resolve(root))) {
        const source = fs.readFileSync(file, "utf8");
        for (const match of source.matchAll(/@deprecated\b([^\r\n]*)/gu)) {
          const suffix = match[1] ?? "";
          const idMatch = /masanawa:([a-z0-9][a-z0-9._-]*)/u.exec(suffix);
          if (!idMatch) {
            invalid.push(path.relative(process.cwd(), file));
            continue;
          }
          const id = idMatch[1]!;
          annotated.add(id);
          expect(
            entries.has(id),
            `${path.relative(process.cwd(), file)} references unknown deprecation ${id}`,
          ).toBe(true);
        }
      }
    }

    expect(invalid).toEqual([]);
    for (const entry of lifecycle.deprecations) {
      if (entry.surfaceKind === "workspace-symbol") {
        expect(
          annotated.has(entry.id),
          `workspace-symbol deprecation ${entry.id} needs a source annotation`,
        ).toBe(true);
      }
    }
  });
});
