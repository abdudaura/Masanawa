import { createHash } from "node:crypto";
import { toInstant, type Instant } from "@masanawa/contracts";
import {
  workflowScheduleLimits,
  type WorkflowOccurrencePlan,
  type WorkflowSchedule,
  type WorkflowScheduleSpec,
} from "./schedule-model.js";

const stableKeyPattern = /^[a-z][a-z0-9_]*(?:[.-][a-z0-9_]+)*$/u;
const graphSignaturePattern = /^sha256:[a-f0-9]{64}$/u;

function fail(message: string): never {
  throw new TypeError(message);
}

function stableKey(value: string, name: string, max: number): string {
  if (
    !stableKeyPattern.test(value) ||
    value.length > max
  ) {
    fail(`${name} must use a stable bounded lowercase key format`);
  }
  return value;
}

function validInstant(value: string, name: string): Instant {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) {
    fail(`${name} must be a valid instant`);
  }
  return toInstant(new Date(time));
}

function normalizeSpec(spec: WorkflowScheduleSpec): WorkflowScheduleSpec {
  if (spec.kind === "once") {
    return Object.freeze({
      kind: "once",
      at: validInstant(spec.at, "schedule.once.at"),
    });
  }

  if (
    !Number.isSafeInteger(spec.everyMs) ||
    spec.everyMs < 1 ||
    spec.everyMs > workflowScheduleLimits.maxIntervalMs
  ) {
    fail("schedule interval everyMs is out of bounds");
  }
  if (
    spec.maxOccurrences !== null &&
    (
      !Number.isSafeInteger(spec.maxOccurrences) ||
      spec.maxOccurrences < 1 ||
      spec.maxOccurrences > workflowScheduleLimits.maxOccurrences
    )
  ) {
    fail("schedule maxOccurrences is out of bounds");
  }

  const firstAt = validInstant(spec.firstAt, "schedule.interval.firstAt");
  const endAt =
    spec.endAt === null
      ? null
      : validInstant(spec.endAt, "schedule.interval.endAt");
  if (endAt !== null && endAt < firstAt) {
    fail("schedule endAt cannot precede firstAt");
  }

  return Object.freeze({
    kind: "interval",
    firstAt,
    everyMs: spec.everyMs,
    maxOccurrences: spec.maxOccurrences,
    endAt,
  });
}

export function createWorkflowSchedule(
  input: WorkflowSchedule,
): WorkflowSchedule {
  if (!graphSignaturePattern.test(input.graphSignature)) {
    fail("schedule graphSignature must be canonical sha256");
  }

  return Object.freeze({
    tenantId: input.tenantId,
    workflowRunId: input.workflowRunId,
    workflowVersionId: input.workflowVersionId,
    graphSignature: input.graphSignature,
    scheduleKey: stableKey(
      input.scheduleKey,
      "scheduleKey",
      workflowScheduleLimits.maxScheduleKeyLength,
    ),
    targetNodeKey: stableKey(
      input.targetNodeKey,
      "targetNodeKey",
      workflowScheduleLimits.maxNodeKeyLength,
    ),
    spec: normalizeSpec(input.spec),
    createdAt: validInstant(input.createdAt, "schedule.createdAt"),
  });
}

export function workflowOccurrenceAt(
  schedule: WorkflowSchedule,
  sequence: number,
): WorkflowOccurrencePlan | null {
  const normalized = createWorkflowSchedule(schedule);
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    fail("occurrence sequence must be a positive safe integer");
  }

  if (normalized.spec.kind === "once") {
    return sequence === 1
      ? Object.freeze({ sequence: 1, dueAt: normalized.spec.at })
      : null;
  }

  if (
    normalized.spec.maxOccurrences !== null &&
    sequence > normalized.spec.maxOccurrences
  ) {
    return null;
  }

  const firstMs = Date.parse(normalized.spec.firstAt);
  const offset = (sequence - 1) * normalized.spec.everyMs;
  if (!Number.isSafeInteger(offset)) {
    fail("occurrence offset exceeds safe integer range");
  }
  const dueAt = toInstant(new Date(firstMs + offset));
  if (
    normalized.spec.endAt !== null &&
    dueAt > normalized.spec.endAt
  ) {
    return null;
  }

  return Object.freeze({ sequence, dueAt });
}

export function workflowScheduleFingerprint(
  schedule: WorkflowSchedule,
): string {
  const normalized = createWorkflowSchedule(schedule);
  return createHash("sha256")
    .update(
      JSON.stringify({
        tenantId: normalized.tenantId,
        workflowRunId: normalized.workflowRunId,
        workflowVersionId: normalized.workflowVersionId,
        graphSignature: normalized.graphSignature,
        scheduleKey: normalized.scheduleKey,
        targetNodeKey: normalized.targetNodeKey,
        spec: normalized.spec,
        createdAt: normalized.createdAt,
      }),
      "utf8",
    )
    .digest("hex");
}
