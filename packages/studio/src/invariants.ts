import {
  parseCanonicalId,
  toInstant,
  type Instant,
} from "@masanawa/contracts";
import type {
  StudioArtifactRevision,
  StudioProject,
  StudioProjectState,
} from "./model.js";

const sha256 = /^[a-f0-9]{64}$/u;

function bounded(value: string, name: string, min: number, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (normalized.length < min || normalized.length > max) {
    throw new RangeError(`${name} must be between ${min} and ${max} characters`);
  }
  return normalized;
}

function revision(value: number, name = "revision"): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
  return value;
}

function hash(value: string, name: string): string {
  const normalized = bounded(value, name, 64, 64).toLowerCase();
  if (!sha256.test(normalized)) throw new TypeError(`${name} must be SHA-256 hex`);
  return normalized;
}

export function normalizeStudioProject(input: StudioProject): StudioProject {
  if (input.schemaVersion !== 1) throw new TypeError("Unsupported StudioProject schemaVersion");
  if (input.state !== "active" && input.state !== "archived") {
    throw new TypeError("StudioProject state is invalid");
  }
  const createdAt = toInstant(input.createdAt);
  const updatedAt = toInstant(input.updatedAt);
  const archivedAt = input.archivedAt === null ? null : toInstant(input.archivedAt);
  if (updatedAt < createdAt) throw new Error("updatedAt cannot predate createdAt");
  if (
    (input.state === "active" && archivedAt !== null) ||
    (input.state === "archived" && (archivedAt === null || archivedAt !== updatedAt))
  ) {
    throw new Error("StudioProject lifecycle is inconsistent");
  }
  return Object.freeze({
    schemaVersion: 1,
    tenantId: parseCanonicalId("tenant", input.tenantId),
    mediaProjectId: parseCanonicalId("media-project", input.mediaProjectId),
    characterId: parseCanonicalId("character", input.characterId),
    title: bounded(input.title, "title", 1, 200),
    state: input.state,
    revision: revision(input.revision),
    createdAt,
    updatedAt,
    archivedAt,
  });
}

export function archiveStudioProject(input: {
  readonly current: StudioProject;
  readonly expectedRevision: number;
  readonly archivedAt: Instant;
}): StudioProject {
  const current = normalizeStudioProject(input.current);
  if (current.revision !== revision(input.expectedRevision, "expectedRevision")) {
    throw new Error("StudioProject revision is stale");
  }
  if (current.state === "archived") return current;
  const archivedAt = toInstant(input.archivedAt);
  if (archivedAt < current.updatedAt) throw new Error("archive cannot move time backwards");
  return normalizeStudioProject({
    ...current,
    state: "archived",
    revision: current.revision + 1,
    updatedAt: archivedAt,
    archivedAt,
  });
}

export function normalizeStudioArtifactRevision(
  input: StudioArtifactRevision,
): StudioArtifactRevision {
  if (input.schemaVersion !== 1) throw new TypeError("Unsupported StudioArtifact schemaVersion");
  const parents = input.parents.map((parent) => Object.freeze({
    mediaArtifactId: parseCanonicalId("media-artifact", parent.mediaArtifactId),
    revision: revision(parent.revision, "parent.revision"),
  }));
  const parentKeys = parents.map((p) => `${p.mediaArtifactId}@${p.revision}`);
  if (new Set(parentKeys).size !== parentKeys.length) {
    throw new Error("StudioArtifact parents must be unique");
  }
  if (parents.some((parent) => parent.mediaArtifactId === input.mediaArtifactId && parent.revision >= input.revision)) {
    throw new Error("StudioArtifact cannot depend on itself at same/future revision");
  }

  const sources = input.sources.map((source) => Object.freeze({
    sourceType: source.sourceType,
    reference: bounded(source.reference, "source.reference", 1, 2048),
    contentHash: hash(source.contentHash, "source.contentHash"),
    operationId:
      source.operationId === null
        ? null
        : parseCanonicalId("operation", source.operationId),
  }));
  if (sources.length < 1 || sources.length > 64) {
    throw new RangeError("StudioArtifact requires 1 to 64 provenance sources");
  }

  return Object.freeze({
    schemaVersion: 1,
    tenantId: parseCanonicalId("tenant", input.tenantId),
    mediaProjectId: parseCanonicalId("media-project", input.mediaProjectId),
    characterId: parseCanonicalId("character", input.characterId),
    mediaArtifactId: parseCanonicalId("media-artifact", input.mediaArtifactId),
    revision: revision(input.revision),
    kind: input.kind,
    mediaType: bounded(input.mediaType, "mediaType", 3, 160).toLowerCase(),
    contentRef: bounded(input.contentRef, "contentRef", 1, 2048),
    contentHash: hash(input.contentHash, "contentHash"),
    parents: Object.freeze(parents),
    sources: Object.freeze(sources),
    provenanceHash: hash(input.provenanceHash, "provenanceHash"),
    createdAt: toInstant(input.createdAt),
  });
}

export function assertStudioProjectAcceptsArtifact(input: {
  readonly project: StudioProject;
  readonly artifact: StudioArtifactRevision;
}): void {
  const project = normalizeStudioProject(input.project);
  const artifact = normalizeStudioArtifactRevision(input.artifact);
  if (project.state !== "active") throw new Error("Archived StudioProject cannot accept artifacts");
  if (
    project.tenantId !== artifact.tenantId ||
    project.mediaProjectId !== artifact.mediaProjectId ||
    project.characterId !== artifact.characterId
  ) {
    throw new Error("StudioArtifact scope does not match StudioProject");
  }
}
