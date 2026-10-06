import { fingerprintCanonicalJson } from "@masanawa/security";
import type {
  StudioArtifactParent,
  StudioArtifactSourceEvidence,
} from "./model.js";

function sortedParents(parents: readonly StudioArtifactParent[]) {
  return [...parents]
    .map((parent) => ({
      mediaArtifactId: parent.mediaArtifactId,
      revision: parent.revision,
    }))
    .sort((a, b) =>
      `${a.mediaArtifactId}@${a.revision}`.localeCompare(
        `${b.mediaArtifactId}@${b.revision}`,
      ),
    );
}

function sortedSources(sources: readonly StudioArtifactSourceEvidence[]) {
  return [...sources]
    .map((source) => ({
      sourceType: source.sourceType,
      reference: source.reference,
      contentHash: source.contentHash,
      operationId: source.operationId,
    }))
    .sort((a, b) =>
      [
        a.sourceType,
        a.reference,
        a.contentHash,
        a.operationId ?? "",
      ].join("|").localeCompare(
        [b.sourceType, b.reference, b.contentHash, b.operationId ?? ""].join("|"),
      ),
    );
}

export function studioArtifactProvenanceHash(input: {
  readonly tenantId: string;
  readonly mediaProjectId: string;
  readonly characterId: string;
  readonly mediaArtifactId: string;
  readonly revision: number;
  readonly kind: string;
  readonly mediaType: string;
  readonly contentHash: string;
  readonly parents: readonly StudioArtifactParent[];
  readonly sources: readonly StudioArtifactSourceEvidence[];
}): string {
  return fingerprintCanonicalJson({
    tenantId: input.tenantId,
    mediaProjectId: input.mediaProjectId,
    characterId: input.characterId,
    mediaArtifactId: input.mediaArtifactId,
    revision: input.revision,
    kind: input.kind,
    mediaType: input.mediaType,
    contentHash: input.contentHash,
    parents: sortedParents(input.parents),
    sources: sortedSources(input.sources),
  });
}

export function assertStudioProvenanceHash(input: {
  readonly expected: string;
  readonly actual: string;
}): void {
  if (input.expected !== input.actual) {
    throw new Error("StudioArtifact provenance hash does not match immutable lineage");
  }
}
