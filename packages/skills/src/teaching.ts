import {
  parseCanonicalId,
  toInstant,
  type CharacterId,
  type Instant,
  type RelationshipId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";

export interface TeachingProgressScope {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly characterId: CharacterId;
  readonly relationshipId: RelationshipId;
}

export interface TeachingProgress extends TeachingProgressScope {
  readonly topic: string;
  readonly goal: string;
  readonly level: string;
  readonly checkpoint: string;
  readonly nextStep: string;
  readonly masteryNotes: readonly string[];
  readonly updatedAt: Instant;
}

export interface TeachingProgressRepository {
  read(scope: TeachingProgressScope): Promise<TeachingProgress | null>;
  upsert(progress: TeachingProgress): Promise<void>;
}

function bounded(value: string, name: string, max: number): string {
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

export function normalizeTeachingProgress(
  input: TeachingProgress,
): TeachingProgress {
  const notes = input.masteryNotes
    .map((value) => bounded(value, "teaching.masteryNote", 300))
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 24);
  return Object.freeze({
    tenantId: parseCanonicalId("tenant", input.tenantId),
    userId: parseCanonicalId("user", input.userId),
    characterId: parseCanonicalId("character", input.characterId),
    relationshipId: parseCanonicalId("relationship", input.relationshipId),
    topic: bounded(input.topic, "teaching.topic", 240),
    goal: bounded(input.goal, "teaching.goal", 500),
    level: bounded(input.level, "teaching.level", 120),
    checkpoint: bounded(input.checkpoint, "teaching.checkpoint", 1000),
    nextStep: bounded(input.nextStep, "teaching.nextStep", 1000),
    masteryNotes: Object.freeze(notes),
    updatedAt: toInstant(input.updatedAt),
  });
}
