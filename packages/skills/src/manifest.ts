import Type from "typebox";
import Schema from "typebox/schema";
import { fingerprintCanonicalJson } from "@masanawa/security";
import {
  normalizeSkillKey,
  normalizeSkillVersion,
  skillTrustTiers,
  skillVisibilityStates,
  type SkillProvenance,
  type SkillTrustTier,
  type SkillVisibility,
} from "./model.js";

export const skillManifestResourceKinds = [
  "reference",
  "asset",
  "template",
  "script",
] as const;

export type SkillManifestResourceKind =
  (typeof skillManifestResourceKinds)[number];

export interface SkillManifestResource {
  readonly path: string;
  readonly kind: SkillManifestResourceKind;
}

export interface SkillManifestV1 {
  readonly schemaVersion: 1;
  readonly key: string;
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly entrypoint: "SKILL.md";
  readonly visibility: SkillVisibility;
  readonly activationExamples: readonly string[];
  readonly negativeActivationExamples: readonly string[];
  readonly resources: readonly SkillManifestResource[];
}

export interface SkillImportSource {
  readonly sourceSystem: string;
  readonly sourceReference: string;
  readonly sourceRevision: string | null;
  readonly trustTier: SkillTrustTier;
}

export interface SkillImportOptions {
  readonly allowScripts?: boolean;
}

export interface SkillImportBundle {
  readonly manifest: unknown;
  readonly instructions: string;
  readonly source: SkillImportSource;
}

export interface SkillImportCandidate {
  readonly state: "quarantined";
  readonly manifest: SkillManifestV1;
  readonly instructions: string;
  readonly provenance: SkillProvenance;
  readonly importedResources: readonly SkillManifestResource[];
  readonly skippedScripts: readonly string[];
}

const maxInstructionsLength = 262_144;

const SkillManifestResourceSchema = Type.Object(
  {
    path: Type.String({ minLength: 1, maxLength: 512 }),
    kind: Type.Union([\n      Type.Literal("reference"),\n      Type.Literal("asset"),\n      Type.Literal("template"),\n      Type.Literal("script"),\n    ]),
  },
  { additionalProperties: false },
);

export const SkillManifestV1Schema = Type.Object(
  {
    schemaVersion: Type.Literal(1),
    key: Type.String({ minLength: 1, maxLength: 128 }),
    version: Type.String({ minLength: 1, maxLength: 128 }),
    name: Type.String({ minLength: 1, maxLength: 200 }),
    description: Type.String({ minLength: 1, maxLength: 2_000 }),
    entrypoint: Type.Literal("SKILL.md"),
    visibility: Type.Optional(
      Type.Union([Type.Literal("model-visible"), Type.Literal("model-hidden")]),
    ),
    activationExamples: Type.Optional(
      Type.Array(Type.String({ minLength: 1, maxLength: 1_000 }), {
        maxItems: 128,
      }),
    ),
    negativeActivationExamples: Type.Optional(
      Type.Array(Type.String({ minLength: 1, maxLength: 1_000 }), {
        maxItems: 128,
      }),
    ),
    resources: Type.Optional(
      Type.Array(SkillManifestResourceSchema, { maxItems: 256 }),
    ),
  },
  { additionalProperties: false },
);

const SkillManifestV1Validator = Schema.Compile(SkillManifestV1Schema);

function bounded(value: string, name: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new TypeError(`${name} must be a string`);
  }
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > maxLength) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function normalizeExamples(
  value: readonly string[] | undefined,
  name: string,
): readonly string[] {
  const values = value ?? [];
  if (values.length > 128) {
    throw new RangeError(`${name} has too many entries`);
  }
  const normalized = values.map((item) => bounded(item, name, 1_000));
  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError(`${name} must be unique`);
  }
  return Object.freeze(normalized);
}

export function normalizeSkillResourcePath(value: string): string {
  const path = bounded(value, "skill resource path", 512);
  if (
    path.includes("\\") ||
    path.includes("\0") ||
    path.startsWith("/") ||
    /^[A-Za-z]:/u.test(path)
  ) {
    throw new TypeError("skill resource path must be a relative POSIX path");
  }

  const segments = path.split("/");
  if (
    segments.some(
      (segment) => segment.length === 0 || segment === "." || segment === "..",
    )
  ) {
    throw new TypeError("skill resource path contains an unsafe segment");
  }
  return segments.join("/");
}

function normalizeResources(
  resources: readonly SkillManifestResource[] | undefined,
): readonly SkillManifestResource[] {
  const normalized = (resources ?? []).map((resource) =>
    Object.freeze({
      path: normalizeSkillResourcePath(resource.path),
      kind: resource.kind,
    }),
  );
  const paths = normalized.map((resource) => resource.path);
  if (new Set(paths).size !== paths.length) {
    throw new TypeError("skill manifest resource paths must be unique");
  }
  return Object.freeze(normalized);
}

export function parseSkillManifestV1(value: unknown): SkillManifestV1 {
  if (!SkillManifestV1Validator.Check(value)) {
    throw new TypeError("skill manifest does not match schemaVersion 1");
  }

  const input = value as {
    readonly schemaVersion: 1;
    readonly key: string;
    readonly version: string;
    readonly name: string;
    readonly description: string;
    readonly entrypoint: "SKILL.md";
    readonly visibility?: SkillVisibility;
    readonly activationExamples?: readonly string[];
    readonly negativeActivationExamples?: readonly string[];
    readonly resources?: readonly SkillManifestResource[];
  };

  return Object.freeze({
    schemaVersion: 1 as const,
    key: normalizeSkillKey(input.key),
    version: normalizeSkillVersion(input.version),
    name: bounded(input.name, "skill manifest name", 200),
    description: bounded(input.description, "skill manifest description", 2_000),
    entrypoint: "SKILL.md" as const,
    visibility: input.visibility ?? "model-visible",
    activationExamples: normalizeExamples(
      input.activationExamples,
      "skill manifest activationExamples",
    ),
    negativeActivationExamples: normalizeExamples(
      input.negativeActivationExamples,
      "skill manifest negativeActivationExamples",
    ),
    resources: normalizeResources(input.resources),
  });
}

function normalizeSource(input: SkillImportSource): SkillImportSource {
  const sourceSystem = bounded(
    input.sourceSystem,
    "skill import sourceSystem",
    128,
  ).toLowerCase();
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(sourceSystem)) {
    throw new TypeError("skill import sourceSystem is invalid");
  }
  if (!(skillTrustTiers as readonly string[]).includes(input.trustTier)) {
    throw new TypeError("skill import trustTier is invalid");
  }

  return Object.freeze({
    sourceSystem,
    sourceReference: bounded(
      input.sourceReference,
      "skill import sourceReference",
      2_000,
    ),
    sourceRevision:
      input.sourceRevision === null
        ? null
        : bounded(
            input.sourceRevision,
            "skill import sourceRevision",
            256,
          ),
    trustTier: input.trustTier,
  });
}

function normalizeInstructions(value: string): string {
  if (typeof value !== "string") {
    throw new TypeError("skill instructions must be a string");
  }
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (
    normalized.length < 1 ||
    normalized.length > maxInstructionsLength ||
    normalized.includes("\0")
  ) {
    throw new TypeError("skill instructions are invalid");
  }
  return normalized;
}

export function importSkillBundle(
  input: SkillImportBundle,
  options: SkillImportOptions = {},
): SkillImportCandidate {
  const manifest = parseSkillManifestV1(input.manifest);
  const instructions = normalizeInstructions(input.instructions);
  const source = normalizeSource(input.source);
  const importedResources: SkillManifestResource[] = [];
  const skippedScripts: string[] = [];

  for (const resource of manifest.resources) {
    if (resource.kind === "script" && options.allowScripts !== true) {
      skippedScripts.push(resource.path);
      continue;
    }
    importedResources.push(resource);
  }

  const provenance: SkillProvenance = Object.freeze({
    sourceKind: "imported",
    sourceSystem: source.sourceSystem,
    sourceReference: source.sourceReference,
    sourceRevision: source.sourceRevision,
    sourceContentHash: `sha256:${fingerprintCanonicalJson({
      manifest,
      instructions,
    })}`,
    trustTier: source.trustTier,
  });

  return Object.freeze({
    state: "quarantined" as const,
    manifest,
    instructions,
    provenance,
    importedResources: Object.freeze(importedResources),
    skippedScripts: Object.freeze(skippedScripts),
  });
}

export interface SkillMarkdownImportDescriptor {
  readonly key: string;
  readonly version: string;
  readonly source: SkillImportSource;
}

function unquoteFrontmatterValue(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function importSkillMarkdown(
  document: string,
  descriptor: SkillMarkdownImportDescriptor,
): SkillImportCandidate {
  if (typeof document !== "string") {
    throw new TypeError("SKILL.md document must be a string");
  }
  const normalized = document.replace(/\r\n?/gu, "\n");
  if (!normalized.startsWith("---\n")) {
    throw new TypeError("SKILL.md requires frontmatter");
  }
  const closing = normalized.indexOf("\n---\n", 4);
  if (closing < 0) {
    throw new TypeError("SKILL.md frontmatter is unterminated");
  }

  const fields = new Map<string, string>();
  for (const line of normalized.slice(4, closing).split("\n")) {
    if (line.trim() === "" || line.trimStart().startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator < 1) {
      throw new TypeError("SKILL.md frontmatter line is invalid");
    }
    const key = line.slice(0, separator).trim();
    const value = unquoteFrontmatterValue(line.slice(separator + 1));
    if (!["name", "description"].includes(key)) {
      throw new TypeError(`Unsupported SKILL.md frontmatter field: ${key}`);
    }
    if (fields.has(key)) {
      throw new TypeError(`Duplicate SKILL.md frontmatter field: ${key}`);
    }
    fields.set(key, value);
  }

  const name = fields.get("name");
  const description = fields.get("description");
  if (!name || !description) {
    throw new TypeError("SKILL.md requires name and description frontmatter");
  }

  return importSkillBundle({
    manifest: {
      schemaVersion: 1,
      key: descriptor.key,
      version: descriptor.version,
      name,
      description,
      entrypoint: "SKILL.md",
    },
    instructions: normalized.slice(closing + 5),
    source: descriptor.source,
  });
}
