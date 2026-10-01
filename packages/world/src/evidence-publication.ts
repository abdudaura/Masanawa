import type {
  CharacterId,
  CharacterVersionId,
  Instant,
  WorldEventId,
  WorldId,
  WorldInteractionId,
} from "@masanawa/contracts";
import type {
  CanonState,
  JsonObject,
  WorldEvent,
  WorldEventProvenance,
  WorldEventVisibility,
  WorldInteraction,
  WorldInteractionParticipant,
} from "./model.js";

export const worldEvidenceRecordedEventType = "world.evidence.recorded";
export const worldEvidenceRecordedSchemaVersion = 1;
export const worldEvidenceMemoryDestination = "memory.world-evidence";
export const worldEvidenceWorkflowDestination = "workflows.world-evidence";

interface WorldEvidenceRecordedBase {
  readonly worldId: WorldId;
  readonly payload: JsonObject;
  readonly provenance: WorldEventProvenance;
  readonly visibility: WorldEventVisibility;
  readonly canonState: CanonState;
  readonly occurrenceKey: string | null;
  readonly effectiveStart: Instant;
  readonly effectiveEnd: Instant | null;
  readonly recordedAt: Instant;
}

export interface WorldEventRecordedEvidence
  extends WorldEvidenceRecordedBase {
  readonly evidenceKind: "event";
  readonly evidenceId: WorldEventId;
  readonly evidenceType: string;
  readonly characterId: CharacterId | null;
  readonly characterVersionId: CharacterVersionId | null;
}

export interface WorldInteractionRecordedEvidence
  extends WorldEvidenceRecordedBase {
  readonly evidenceKind: "interaction";
  readonly evidenceId: WorldInteractionId;
  readonly evidenceType: string;
  readonly participants: readonly WorldInteractionParticipant[];
}

export type WorldEvidenceRecordedPayload =
  | WorldEventRecordedEvidence
  | WorldInteractionRecordedEvidence;

export function worldEventRecordedEvidence(
  event: WorldEvent,
): WorldEventRecordedEvidence {
  return Object.freeze({
    evidenceKind: "event" as const,
    evidenceId: event.worldEventId,
    evidenceType: event.eventKind,
    worldId: event.worldId,
    characterId: event.characterId,
    characterVersionId: event.characterVersionId,
    payload: Object.freeze({ ...event.payload }),
    provenance: event.provenance,
    visibility: event.visibility,
    canonState: event.canonState,
    occurrenceKey: event.occurrenceKey,
    effectiveStart: event.effectiveStart,
    effectiveEnd: event.effectiveEnd,
    recordedAt: event.recordedAt,
  });
}

export function worldInteractionRecordedEvidence(
  interaction: WorldInteraction,
): WorldInteractionRecordedEvidence {
  return Object.freeze({
    evidenceKind: "interaction" as const,
    evidenceId: interaction.worldInteractionId,
    evidenceType: interaction.interactionKind,
    worldId: interaction.worldId,
    participants: Object.freeze(
      interaction.participants.map((participant) =>
        Object.freeze({ ...participant }),
      ),
    ),
    payload: Object.freeze({ ...interaction.payload }),
    provenance: interaction.provenance,
    visibility: interaction.visibility,
    canonState: interaction.canonState,
    occurrenceKey: interaction.occurrenceKey,
    effectiveStart: interaction.effectiveStart,
    effectiveEnd: interaction.effectiveEnd,
    recordedAt: interaction.recordedAt,
  });
}
