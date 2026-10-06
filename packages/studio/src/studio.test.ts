import { describe, expect, it } from "vitest";
import {
  archiveStudioProject,
  assertStudioProjectAcceptsArtifact,
  assertStudioProvenanceHash,
  normalizeStudioArtifactRevision,
  normalizeStudioProject,
  studioArtifactProvenanceHash,
  type StudioArtifactRevision,
  type StudioProject,
} from "./index.js";

const tenantId =
  "tenant_01890f4c-0000-7000-8000-000000000001" as never;
const characterId =
  "character_01890f4c-0000-7000-8000-000000000002" as never;
const projectId =
  "media-project_01890f4c-0000-7000-8000-000000000003" as never;
const artifactId =
  "media-artifact_01890f4c-0000-7000-8000-000000000004" as never;
const parentId =
  "media-artifact_01890f4c-0000-7000-8000-000000000005" as never;
const operationId =
  "operation_01890f4c-0000-7000-8000-000000000006" as never;
const hashA = "a".repeat(64);
const hashB = "b".repeat(64);

function project(overrides: Partial<StudioProject> = {}): StudioProject {
  return {
    schemaVersion: 1,
    tenantId,
    mediaProjectId: projectId,
    characterId,
    title: "Launch story",
    state: "active",
    revision: 1,
    createdAt: "2026-10-06T10:00:00.000Z" as never,
    updatedAt: "2026-10-06T10:00:00.000Z" as never,
    archivedAt: null,
    ...overrides,
  };
}

function artifact(
  overrides: Partial<StudioArtifactRevision> = {},
): StudioArtifactRevision {
  const base = {
    schemaVersion: 1 as const,
    tenantId,
    mediaProjectId: projectId,
    characterId,
    mediaArtifactId: artifactId,
    revision: 2,
    kind: "script" as const,
    mediaType: "text/plain",
    contentRef: "artifact://studio/script-v2",
    contentHash: hashA,
    parents: [{ mediaArtifactId: parentId, revision: 1 }],
    sources: [{
      sourceType: "operation" as const,
      reference: "operation-output:script",
      contentHash: hashB,
      operationId,
    }],
    provenanceHash: "",
    createdAt: "2026-10-06T10:05:00.000Z" as never,
  };
  const merged = { ...base, ...overrides };
  const provenanceHash = studioArtifactProvenanceHash({
    tenantId: merged.tenantId,
    mediaProjectId: merged.mediaProjectId,
    characterId: merged.characterId,
    mediaArtifactId: merged.mediaArtifactId,
    revision: merged.revision,
    kind: merged.kind,
    mediaType: merged.mediaType,
    contentHash: merged.contentHash,
    parents: merged.parents,
    sources: merged.sources,
  });
  return { ...merged, provenanceHash };
}

describe("Studio project/artifact provenance", () => {
  it("normalizes canonical project scope and archives monotonically", () => {
    const current = normalizeStudioProject(project());
    expect(current.state).toBe("active");

    const archived = archiveStudioProject({
      current,
      expectedRevision: 1,
      archivedAt: "2026-10-06T11:00:00.000Z" as never,
    });
    expect(archived).toMatchObject({
      state: "archived",
      revision: 2,
      archivedAt: "2026-10-06T11:00:00.000Z",
    });

    expect(() =>
      archiveStudioProject({
        current,
        expectedRevision: 2,
        archivedAt: "2026-10-06T11:00:00.000Z" as never,
      }),
    ).toThrow("stale");
  });

  it("accepts an immutable artifact only inside the exact active project scope", () => {
    expect(() =>
      assertStudioProjectAcceptsArtifact({
        project: project(),
        artifact: artifact(),
      }),
    ).not.toThrow();

    expect(() =>
      assertStudioProjectAcceptsArtifact({
        project: project({
          characterId:
            "character_01890f4c-0000-7000-8000-000000000099" as never,
        }),
        artifact: artifact(),
      }),
    ).toThrow("scope");
  });

  it("rejects new artifacts after archive", () => {
    expect(() =>
      assertStudioProjectAcceptsArtifact({
        project: project({
          state: "archived",
          revision: 2,
          updatedAt: "2026-10-06T11:00:00.000Z" as never,
          archivedAt: "2026-10-06T11:00:00.000Z" as never,
        }),
        artifact: artifact(),
      }),
    ).toThrow("Archived");
  });

  it("makes provenance deterministic independent of parent/source ordering", () => {
    const parents = [
      { mediaArtifactId: parentId, revision: 1 },
      {
        mediaArtifactId:
          "media-artifact_01890f4c-0000-7000-8000-000000000007" as never,
        revision: 3,
      },
    ];
    const sources = [
      {
        sourceType: "operation" as const,
        reference: "op:a",
        contentHash: hashA,
        operationId,
      },
      {
        sourceType: "user-input" as const,
        reference: "prompt:1",
        contentHash: hashB,
        operationId: null,
      },
    ];
    const left = studioArtifactProvenanceHash({
      tenantId,
      mediaProjectId: projectId,
      characterId,
      mediaArtifactId: artifactId,
      revision: 4,
      kind: "storyboard",
      mediaType: "application/json",
      contentHash: hashA,
      parents,
      sources,
    });
    const right = studioArtifactProvenanceHash({
      tenantId,
      mediaProjectId: projectId,
      characterId,
      mediaArtifactId: artifactId,
      revision: 4,
      kind: "storyboard",
      mediaType: "application/json",
      contentHash: hashA,
      parents: [...parents].reverse(),
      sources: [...sources].reverse(),
    });
    expect(left).toBe(right);
  });

  it("detects tampered lineage and rejects duplicate/self-future parents", () => {
    const normalized = normalizeStudioArtifactRevision(artifact());
    const actual = studioArtifactProvenanceHash({
      tenantId: normalized.tenantId,
      mediaProjectId: normalized.mediaProjectId,
      characterId: normalized.characterId,
      mediaArtifactId: normalized.mediaArtifactId,
      revision: normalized.revision,
      kind: normalized.kind,
      mediaType: normalized.mediaType,
      contentHash: normalized.contentHash,
      parents: normalized.parents,
      sources: normalized.sources,
    });
    expect(() =>
      assertStudioProvenanceHash({
        expected: normalized.provenanceHash,
        actual,
      }),
    ).not.toThrow();
    expect(() =>
      assertStudioProvenanceHash({
        expected: normalized.provenanceHash,
        actual: "f".repeat(64),
      }),
    ).toThrow("does not match");

    expect(() =>
      normalizeStudioArtifactRevision(
        artifact({
          parents: [
            { mediaArtifactId: parentId, revision: 1 },
            { mediaArtifactId: parentId, revision: 1 },
          ],
        }),
      ),
    ).toThrow("unique");

    expect(() =>
      normalizeStudioArtifactRevision(
        artifact({
          revision: 2,
          parents: [{ mediaArtifactId: artifactId, revision: 2 }],
        }),
      ),
    ).toThrow("same/future");
  });

  it("rejects runtime-invalid kind/source values and malformed hashes", () => {
    expect(() =>
      normalizeStudioArtifactRevision(
        artifact({ kind: "executable" as never }),
      ),
    ).toThrow("kind");

    expect(() =>
      normalizeStudioArtifactRevision(
        artifact({
          sources: [{
            sourceType: "hidden" as never,
            reference: "bad",
            contentHash: hashA,
            operationId: null,
          }],
        }),
      ),
    ).toThrow("sourceType");

    expect(() =>
      normalizeStudioArtifactRevision(
        artifact({ contentHash: "not-a-hash" }),
      ),
    ).toThrow("SHA-256");
  });
});
