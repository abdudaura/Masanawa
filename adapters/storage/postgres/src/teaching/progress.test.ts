import {
  createCanonicalId,
  toInstant,
  type MemoryRecordId,
  type MemoryRevisionId,
} from "@masanawa/contracts";
import {
  type AppendMemoryRevisionInput,
  type CreateMemoryRecordInput,
  type MemoryRecordSnapshot,
  type MemoryRepository,
} from "@masanawa/memory";
import {
  type TeachingFreeResponseAttempt,
  type TeachingProgressHandoff,
  type TeachingSelectionAttempt,
} from "@masanawa/skills";
import { describe, expect, it } from "vitest";

import {
  createTeachingMemoryProgressPort,
  type TeachingMemoryTransaction,
} from "./progress.js";

const tenantId = createCanonicalId("tenant");
const relationshipId = createCanonicalId("relationship");
const skillVersionId = createCanonicalId("skill-version");

function progress(step = "step-1"): TeachingProgressHandoff {
  return {
    relationshipId,
    skillVersionId,
    lessonStepKey: step,
    completedExerciseKeys: Object.freeze([]),
    understanding: "unknown",
    sequenceCompleted: false,
  };
}

function selectionAttempt(
  requestId = createCanonicalId("request"),
): TeachingSelectionAttempt {
  return Object.freeze({
    requestId,
    payloadHash: "sha256:" + "1".repeat(64),
    planHash: "sha256:" + "2".repeat(64),
    relationshipId,
    skillVersionId,
    lessonStepKey: "step-1",
    exerciseKey: "exercise-1",
    selectedOptionKeys: Object.freeze(["a"]),
    evaluation: Object.freeze({
      correctness: "correct" as const,
      understanding: "demonstrated" as const,
      feedback: "Correct",
      misconception: null,
    }),
    progress: progress(),
    recordedAt: toInstant(new Date("2026-10-06T10:00:00.000Z")),
  });
}

function freeAttempt(
  requestId = createCanonicalId("request"),
): TeachingFreeResponseAttempt {
  return Object.freeze({
    requestId,
    payloadHash: "sha256:" + "3".repeat(64),
    planHash: "sha256:" + "2".repeat(64),
    cardHash: "sha256:" + "4".repeat(64),
    relationshipId,
    skillVersionId,
    lessonStepKey: "step-1",
    exerciseKey: "exercise-free",
    responseText: "My answer",
    evaluation: Object.freeze({
      correctness: "correct" as const,
      understanding: "demonstrated" as const,
      feedback: "Good",
      misconception: null,
    }),
    progress: progress("step-2"),
    recordedAt: toInstant(new Date("2026-10-06T10:01:00.000Z")),
  });
}

class MemoryFake implements MemoryRepository {
  snapshot: MemoryRecordSnapshot | null = null;

  async createMemoryRecord(
    input: CreateMemoryRecordInput,
  ): Promise<MemoryRecordSnapshot> {
    if (this.snapshot !== null) throw new Error("duplicate create");
    this.snapshot = snapshotFromCreate(input);
    return this.snapshot;
  }

  async appendMemoryRevision(
    input: AppendMemoryRevisionInput,
  ): Promise<MemoryRecordSnapshot> {
    const current = this.snapshot;
    if (current === null) throw new Error("missing");
    if (current.record.revision !== input.expectedRevision) {
      throw new Error("stale");
    }
    this.snapshot = Object.freeze({
      record: Object.freeze({
        ...current.record,
        currentRevisionId: input.memoryRevisionId,
        revision: current.record.revision + 1,
        updatedAt: input.updatedAt,
      }),
      currentRevision: Object.freeze({
        ...current.currentRevision,
        memoryRevisionId: input.memoryRevisionId,
        revisionNumber: current.currentRevision.revisionNumber + 1,
        content: input.content,
        payload: input.payload ?? {},
        createdAt: input.updatedAt,
        observedAt: input.observedAt,
        eventTime: input.eventTime ?? null,
        evidence: Object.freeze(
          input.evidence.map((entry, ordinal) =>
            Object.freeze({
              ordinal,
              sourceKind: entry.sourceKind,
              sourceReference: entry.sourceReference,
              sourceContentHash: entry.sourceContentHash,
              verbatimText: entry.verbatimText ?? null,
              observedAt: entry.observedAt,
            }),
          ),
        ),
      }),
    });
    return this.snapshot;
  }

  async getMemoryRecordInScope(): Promise<MemoryRecordSnapshot | null> {
    return this.snapshot;
  }

  async listMemoryRecordsByScopes(): Promise<readonly MemoryRecordSnapshot[]> {
    return this.snapshot === null ? Object.freeze([]) : Object.freeze([this.snapshot]);
  }

  async linkMemoryRecords(): Promise<never> {
    throw new Error("unused");
  }
}

function snapshotFromCreate(
  input: CreateMemoryRecordInput,
): MemoryRecordSnapshot {
  return Object.freeze({
    record: Object.freeze({
      tenantId: input.tenantId,
      memoryRecordId: input.memoryRecordId as MemoryRecordId,
      memoryType: input.memoryType,
      scope: input.scope,
      lifecycleState: "active" as const,
      currentRevisionId: input.memoryRevisionId as MemoryRevisionId,
      revision: 1,
      lifecycleRevision: 1,
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    }),
    currentRevision: Object.freeze({
      tenantId: input.tenantId,
      memoryRevisionId: input.memoryRevisionId,
      memoryRecordId: input.memoryRecordId,
      revisionNumber: 1,
      content: input.content,
      payload: input.payload ?? {},
      confidence: input.confidence ?? 1,
      extraction: Object.freeze({
        method: input.extractionMethod,
        modelVersion: input.extractionModelVersion ?? null,
      }),
      eventTime: input.eventTime ?? null,
      observedAt: input.observedAt,
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
      expiresAt: input.expiresAt ?? null,
      createdAt: input.createdAt,
      evidence: Object.freeze(
        input.evidence.map((entry, ordinal) =>
          Object.freeze({
            ordinal,
            sourceKind: entry.sourceKind,
            sourceReference: entry.sourceReference,
            sourceContentHash: entry.sourceContentHash,
            verbatimText: entry.verbatimText ?? null,
            observedAt: entry.observedAt,
          }),
        ),
      ),
    }),
  });
}

function harness() {
  const memory = new MemoryFake();
  const locks: string[] = [];
  const port = createTeachingMemoryProgressPort({
    tenantId,
    transaction: async <T>(
      fn: (transaction: TeachingMemoryTransaction) => Promise<T>,
    ): Promise<T> =>
      fn({
        client: {
          query: async (query: string, values?: readonly unknown[]) => {
            locks.push(String(values?.[0] ?? query));
            return { rows: [], rowCount: 0 } as never;
          },
        },
        memory,
      }),
  });
  return { port, memory, locks };
}

describe("Teaching Memory progress persistence", () => {
  it("stores and resumes Relationship-private progress", async () => {
    const { port, memory, locks } = harness();
    const attempt = selectionAttempt();

    await expect(port.commitSelectionAttempt(attempt)).resolves.toBe("stored");
    await expect(
      port.load({ relationshipId, skillVersionId }),
    ).resolves.toEqual({
      planHash: attempt.planHash,
      progress: attempt.progress,
    });

    expect(memory.snapshot?.record.scope).toEqual({
      kind: "relationship",
      relationshipId,
    });
    expect(memory.snapshot?.record.memoryType).toBe("state");
    expect(locks.length).toBe(2);
  });

  it("returns replay for identical RequestId without a new revision", async () => {
    const { port, memory } = harness();
    const attempt = selectionAttempt();
    await port.commitSelectionAttempt(attempt);
    const revision = memory.snapshot?.record.revision;

    await expect(port.commitSelectionAttempt(attempt)).resolves.toBe("replay");
    expect(memory.snapshot?.record.revision).toBe(revision);
  });

  it("rejects changed payload under an existing RequestId", async () => {
    const { port } = harness();
    const attempt = selectionAttempt();
    await port.commitSelectionAttempt(attempt);

    await expect(
      port.commitSelectionAttempt({
        ...attempt,
        payloadHash: "sha256:" + "9".repeat(64),
      }),
    ).rejects.toMatchObject({ code: "teaching.request_conflict" });
  });

  it("stores free response in the same canonical progress record", async () => {
    const { port, memory } = harness();
    await port.commitSelectionAttempt(selectionAttempt());
    const attempt = freeAttempt();

    await expect(port.commitFreeResponseAttempt(attempt)).resolves.toBe("stored");
    expect(memory.snapshot?.record.revision).toBe(2);
    await expect(
      port.load({ relationshipId, skillVersionId }),
    ).resolves.toEqual({
      planHash: attempt.planHash,
      progress: attempt.progress,
    });
  });

  it("rejects pedagogical plan drift", async () => {
    const { port } = harness();
    await port.commitSelectionAttempt(selectionAttempt());

    const next = freeAttempt();
    await expect(
      port.commitFreeResponseAttempt({
        ...next,
        planHash: "sha256:" + "8".repeat(64),
      }),
    ).rejects.toMatchObject({ code: "teaching.plan_conflict" });
  });
});
