import {
  PlatformError,
  createCanonicalId,
  isCanonicalId,
  type TenantId,
} from "@masanawa/contracts";
import {
  type JsonObject,
  type MemoryRecordSnapshot,
  type MemoryRepository,
} from "@masanawa/memory";
import { fingerprintCanonicalJson } from "@masanawa/security";
import {
  normalizeTeachingProgressHandoff,
  type TeachingFreeResponseAttempt,
  type TeachingProgressKey,
  type TeachingProgressPort,
  type TeachingSelectionAttempt,
  type TeachingStoredProgress,
} from "@masanawa/skills";
import type { Pool, PoolClient } from "pg";

import { createPostgresMemoryRepository } from "../memory/repository.js";
import { withTransaction } from "../transaction.js";

const teachingProgressKind = "core-teaching-progress-v1";
const maxAttemptReceipts = 4096;

type TeachingAttempt =
  | TeachingSelectionAttempt
  | TeachingFreeResponseAttempt;

interface StoredAttemptReceipt {
  readonly payloadHash: string;
  readonly kind: "selection" | "free-response";
}

interface TeachingProgressPayload {
  readonly kind: typeof teachingProgressKind;
  readonly skillVersionId: string;
  readonly planHash: string;
  readonly progress: JsonObject;
  readonly attempts: Readonly<Record<string, StoredAttemptReceipt>>;
}

export interface TeachingMemoryTransaction {
  readonly client: Pick<PoolClient, "query">;
  readonly memory: MemoryRepository;
}

export type TeachingMemoryTransactionRunner = <T>(
  fn: (transaction: TeachingMemoryTransaction) => Promise<T>,
) => Promise<T>;

export interface TeachingMemoryProgressPortOptions {
  readonly tenantId: TenantId;
  readonly transaction: TeachingMemoryTransactionRunner;
}

function conflict(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "conflict",
    message,
    retryable: false,
  });
}

function invalidStoredProgress(message: string): Error {
  return new Error(`Invalid stored Core Teaching progress: ${message}`);
}

function teachingLockKey(
  tenantId: TenantId,
  key: TeachingProgressKey,
): string {
  return [
    teachingProgressKind,
    tenantId,
    key.relationshipId,
    key.skillVersionId,
  ].join(":");
}

async function lockTeachingProgress(
  client: Pick<PoolClient, "query">,
  tenantId: TenantId,
  key: TeachingProgressKey,
): Promise<void> {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    [teachingLockKey(tenantId, key)],
  );
}

function isObject(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseAttemptReceipts(
  value: unknown,
): Readonly<Record<string, StoredAttemptReceipt>> {
  if (!isObject(value)) {
    throw invalidStoredProgress("attempt receipts are missing");
  }
  const entries = Object.entries(value);
  if (entries.length > maxAttemptReceipts) {
    throw invalidStoredProgress("attempt receipt bound exceeded");
  }

  const result: Record<string, StoredAttemptReceipt> = {};
  for (const [requestId, raw] of entries) {
    if (!isObject(raw)) {
      throw invalidStoredProgress("attempt receipt is malformed");
    }
    const payloadHash = raw.payloadHash;
    const kind = raw.kind;
    if (
      !isCanonicalId("request", requestId) ||
      typeof payloadHash !== "string" ||
      !/^sha256:[0-9a-f]{64}$/u.test(payloadHash) ||
      (kind !== "selection" && kind !== "free-response")
    ) {
      throw invalidStoredProgress("attempt receipt is malformed");
    }
    result[requestId] = Object.freeze({ payloadHash, kind });
  }
  return Object.freeze(result);
}

function parsePayload(
  snapshot: MemoryRecordSnapshot,
  expectedSkillVersionId: string,
): TeachingProgressPayload {
  const raw = snapshot.currentRevision.payload;
  if (
    raw.kind !== teachingProgressKind ||
    raw.skillVersionId !== expectedSkillVersionId ||
    typeof raw.planHash !== "string" ||
    !/^sha256:[0-9a-f]{64}$/u.test(raw.planHash) ||
    !isObject(raw.progress)
  ) {
    throw invalidStoredProgress("scope or payload does not match Core Teaching");
  }

  return Object.freeze({
    kind: teachingProgressKind,
    skillVersionId: expectedSkillVersionId,
    planHash: raw.planHash,
    progress: raw.progress as JsonObject,
    attempts: parseAttemptReceipts(raw.attempts),
  });
}

function toStoredProgress(
  snapshot: MemoryRecordSnapshot,
  key: TeachingProgressKey,
): TeachingStoredProgress {
  const payload = parsePayload(snapshot, key.skillVersionId);
  return Object.freeze({
    planHash: payload.planHash,
    progress: normalizeTeachingProgressHandoff(
      payload.progress as Parameters<typeof normalizeTeachingProgressHandoff>[0],
    ),
  });
}

async function findProgressRecord(
  memory: MemoryRepository,
  tenantId: TenantId,
  key: TeachingProgressKey,
): Promise<MemoryRecordSnapshot | null> {
  const records = await memory.listMemoryRecordsByScopes({
    tenantId,
    scopes: [
      Object.freeze({
        kind: "relationship" as const,
        relationshipId: key.relationshipId,
      }),
    ],
    lifecycleStates: ["active"],
    limit: 1000,
  });

  const matches = records.filter((snapshot) => {
    const payload = snapshot.currentRevision.payload;
    return (
      snapshot.record.memoryType === "state" &&
      payload.kind === teachingProgressKind &&
      payload.skillVersionId === key.skillVersionId
    );
  });

  if (matches.length === 0 && records.length === 1000) {
    throw invalidStoredProgress(
      "Relationship Memory scan reached its safe bound before locating progress",
    );
  }
  if (matches.length > 1) {
    throw invalidStoredProgress(
      "multiple active records exist for one Relationship and SkillVersion",
    );
  }
  return matches[0] ?? null;
}

function progressJson(
  progress: TeachingSelectionAttempt["progress"],
): JsonObject {
  return JSON.parse(JSON.stringify(progress)) as JsonObject;
}

function attemptKind(attempt: TeachingAttempt): StoredAttemptReceipt["kind"] {
  return "selectedOptionKeys" in attempt ? "selection" : "free-response";
}

function buildPayload(
  attempt: TeachingAttempt,
  previous: TeachingProgressPayload | null,
): TeachingProgressPayload {
  if (
    !/^sha256:[0-9a-f]{64}$/u.test(attempt.payloadHash) ||
    !/^sha256:[0-9a-f]{64}$/u.test(attempt.planHash)
  ) {
    throw new TypeError("Teaching attempt hashes are invalid");
  }
  const normalizedProgress = normalizeTeachingProgressHandoff(attempt.progress);
  if (
    normalizedProgress.relationshipId !== attempt.relationshipId ||
    normalizedProgress.skillVersionId !== attempt.skillVersionId
  ) {
    throw new TypeError(
      "Teaching attempt progress must match Relationship and SkillVersion",
    );
  }
  if (previous !== null && previous.planHash !== attempt.planHash) {
    throw conflict(
      "teaching.plan_conflict",
      "Core Teaching progress cannot change pedagogical plan identity",
    );
  }

  const existing = previous?.attempts[attempt.requestId];
  const kind = attemptKind(attempt);
  if (existing !== undefined) {
    if (
      existing.payloadHash !== attempt.payloadHash ||
      existing.kind !== kind
    ) {
      throw conflict(
        "teaching.request_conflict",
        "Teaching RequestId was already used for different learner input",
      );
    }
    return previous!;
  }

  const priorEntries = Object.entries(previous?.attempts ?? {});
  if (priorEntries.length >= maxAttemptReceipts) {
    throw conflict(
      "teaching.attempt_receipt_limit",
      "Teaching progress has reached its bounded attempt receipt limit",
    );
  }

  return Object.freeze({
    kind: teachingProgressKind,
    skillVersionId: attempt.skillVersionId,
    planHash: attempt.planHash,
    progress: progressJson(normalizedProgress),
    attempts: Object.freeze({
      ...(previous?.attempts ?? {}),
      [attempt.requestId]: Object.freeze({
        payloadHash: attempt.payloadHash,
        kind,
      }),
    }),
  });
}

function evidenceHash(payload: TeachingProgressPayload): string {
  return fingerprintCanonicalJson(payload);
}

function memoryRevisionInput(
  attempt: TeachingAttempt,
  payload: TeachingProgressPayload,
) {
  return {
    content: "Core Teaching learner progress",
    payload: payload as unknown as JsonObject,
    confidence: 1,
    extractionMethod: "core-teaching-runtime",
    extractionModelVersion: null,
    eventTime: attempt.recordedAt,
    observedAt: attempt.recordedAt,
    evidence: [
      Object.freeze({
        sourceKind: "platform-event" as const,
        sourceReference: attempt.requestId,
        sourceContentHash: evidenceHash(payload),
        verbatimText: null,
        observedAt: attempt.recordedAt,
      }),
    ],
  };
}

async function commitAttempt(
  options: TeachingMemoryProgressPortOptions,
  attempt: TeachingAttempt,
): Promise<"stored" | "replay"> {
  const key: TeachingProgressKey = Object.freeze({
    relationshipId: attempt.relationshipId,
    skillVersionId: attempt.skillVersionId,
  });

  return options.transaction(async ({ client, memory }) => {
    await lockTeachingProgress(client, options.tenantId, key);
    const existing = await findProgressRecord(
      memory,
      options.tenantId,
      key,
    );
    const previous =
      existing === null
        ? null
        : parsePayload(existing, attempt.skillVersionId);

    const priorReceipt = previous?.attempts[attempt.requestId];
    if (priorReceipt !== undefined) {
      const kind = attemptKind(attempt);
      if (
        priorReceipt.payloadHash !== attempt.payloadHash ||
        priorReceipt.kind !== kind
      ) {
        throw conflict(
          "teaching.request_conflict",
          "Teaching RequestId was already used for different learner input",
        );
      }
      return "replay";
    }

    const payload = buildPayload(attempt, previous);
    const revision = memoryRevisionInput(attempt, payload);

    if (existing === null) {
      await memory.createMemoryRecord({
        tenantId: options.tenantId,
        memoryRecordId: createCanonicalId("memory-record"),
        memoryRevisionId: createCanonicalId("memory-revision"),
        memoryType: "state",
        scope: Object.freeze({
          kind: "relationship" as const,
          relationshipId: attempt.relationshipId,
        }),
        createdAt: attempt.recordedAt,
        ...revision,
      });
    } else {
      await memory.appendMemoryRevision({
        tenantId: options.tenantId,
        memoryRecordId: existing.record.memoryRecordId,
        memoryRevisionId: createCanonicalId("memory-revision"),
        expectedRevision: existing.record.revision,
        updatedAt: attempt.recordedAt,
        ...revision,
      });
    }

    return "stored";
  });
}

export function createTeachingMemoryProgressPort(
  options: TeachingMemoryProgressPortOptions,
): TeachingProgressPort {
  return Object.freeze({
    async load(
      key: TeachingProgressKey,
    ): Promise<TeachingStoredProgress | null> {
      return options.transaction(async ({ client, memory }) => {
        await lockTeachingProgress(client, options.tenantId, key);
        const snapshot = await findProgressRecord(
          memory,
          options.tenantId,
          key,
        );
        return snapshot === null ? null : toStoredProgress(snapshot, key);
      });
    },

    commitSelectionAttempt: (attempt: TeachingSelectionAttempt) =>
      commitAttempt(options, attempt),

    commitFreeResponseAttempt: (attempt: TeachingFreeResponseAttempt) =>
      commitAttempt(options, attempt),
  });
}

export function createPostgresTeachingProgressPort(input: {
  readonly pool: Pool;
  readonly tenantId: TenantId;
}): TeachingProgressPort {
  return createTeachingMemoryProgressPort({
    tenantId: input.tenantId,
    transaction: <T>(
      fn: (transaction: TeachingMemoryTransaction) => Promise<T>,
    ) =>
      withTransaction(
        input.pool,
        async (client) =>
          fn(
            Object.freeze({
              client,
              memory: createPostgresMemoryRepository(client),
            }),
          ),
        { isolation: "serializable" },
      ),
  });
}
