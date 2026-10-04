import { createHash } from "node:crypto";
import {
  workflowCheckpointLimits,
  type WorkflowCheckpoint,
  type WorkflowCheckpointCompatibility,
  type WorkflowCheckpointPayload,
  type WorkflowCheckpointValue,
} from "./checkpoint-model.js";

const graphSignaturePattern = /^sha256:[a-f0-9]{64}$/u;
const stateKeyPattern = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/u;
const forbiddenStateKeys = new Set([
  "authority",
  "authoritycontext",
  "authoritycontextid",
  "authorization",
  "capabilities",
  "credential",
  "credentialref",
  "credentials",
  "permission",
  "permissions",
  "secret",
  "token",
]);

function fail(message: string): never {
  throw new TypeError(message);
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function positiveInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    fail(`${name} must be a positive safe integer`);
  }
  return value as number;
}

function nonNegativeInteger(value: unknown, name: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    fail(`${name} must be a non-negative safe integer`);
  }
  return value as number;
}

function normalizeStateKey(value: string, path: string): string {
  if (!stateKeyPattern.test(value)) {
    fail(`${path} contains an invalid checkpoint state key`);
  }
  const compact = value.replaceAll(/[^a-zA-Z0-9]/gu, "").toLowerCase();
  if (forbiddenStateKeys.has(compact)) {
    fail(`${path} contains forbidden restored-authority state`);
  }
  return value;
}

function normalizeValue(
  value: WorkflowCheckpointValue,
  depth: number,
  path: string,
): WorkflowCheckpointValue {
  if (depth > workflowCheckpointLimits.maxDepth) {
    fail(`${path} exceeds maximum checkpoint depth`);
  }
  if (
    value === null ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail(`${path} contains a non-finite number`);
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === "string") {
    if (value.length > workflowCheckpointLimits.maxStringLength) {
      fail(`${path} exceeds maximum checkpoint string length`);
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > workflowCheckpointLimits.maxArrayItems) {
      fail(`${path} exceeds maximum checkpoint array length`);
    }
    return Object.freeze(
      value.map((item, index) =>
        normalizeValue(item, depth + 1, `${path}[${index}]`),
      ),
    );
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      fail(`${path} must contain only plain JSON-like objects`);
    }
    const entries = Object.entries(
      value as Readonly<Record<string, WorkflowCheckpointValue>>,
    );
    if (entries.length > workflowCheckpointLimits.maxObjectKeys) {
      fail(`${path} exceeds maximum checkpoint object key count`);
    }
    const normalized: Record<string, WorkflowCheckpointValue> = {};
    for (const [rawKey, item] of entries.sort(([a], [b]) => compare(a, b))) {
      const key = normalizeStateKey(rawKey, `${path}.${rawKey}`);
      normalized[key] = normalizeValue(item, depth + 1, `${path}.${key}`);
    }
    return Object.freeze(normalized);
  }
  return fail(`${path} contains unsupported checkpoint data`);
}

function normalizeSection(
  section: Readonly<Record<string, WorkflowCheckpointValue>>,
  name: string,
): Readonly<Record<string, WorkflowCheckpointValue>> {
  const entries = Object.entries(section);
  if (entries.length > workflowCheckpointLimits.maxSectionKeys) {
    fail(`${name} exceeds maximum checkpoint section key count`);
  }
  const normalized: Record<string, WorkflowCheckpointValue> = {};
  for (const [rawKey, value] of entries.sort(([a], [b]) => compare(a, b))) {
    const key = normalizeStateKey(rawKey, `${name}.${rawKey}`);
    normalized[key] = normalizeValue(value, 1, `${name}.${key}`);
  }
  return Object.freeze(normalized);
}

export function createWorkflowCheckpointPayload(
  input: WorkflowCheckpointPayload,
): WorkflowCheckpointPayload {
  if (input.evidenceRefs.length > workflowCheckpointLimits.maxEvidenceRefs) {
    fail("evidenceRefs exceeds maximum checkpoint evidence reference count");
  }
  const evidenceRefs = input.evidenceRefs.map((ref, index) => {
    if (!ref || ref.length > 500) {
      fail(`evidenceRefs[${index}] must be non-empty and at most 500 characters`);
    }
    return ref;
  });

  return Object.freeze({
    runState: normalizeSection(input.runState, "runState"),
    taskStates: normalizeSection(input.taskStates, "taskStates"),
    executorStates: normalizeSection(input.executorStates, "executorStates"),
    edgeStates: normalizeSection(input.edgeStates, "edgeStates"),
    pendingRequestStates: normalizeSection(
      input.pendingRequestStates,
      "pendingRequestStates",
    ),
    iteration: nonNegativeInteger(input.iteration, "iteration"),
    superstep: nonNegativeInteger(input.superstep, "superstep"),
    evidenceRefs: Object.freeze([...new Set(evidenceRefs)]),
  });
}

function canonicalCheckpointPayload(payload: WorkflowCheckpointPayload): string {
  return JSON.stringify(payload);
}

export function workflowCheckpointFingerprint(
  payload: WorkflowCheckpointPayload,
): string {
  const normalized = createWorkflowCheckpointPayload(payload);
  return createHash("sha256")
    .update(canonicalCheckpointPayload(normalized), "utf8")
    .digest("hex");
}

export function createWorkflowCheckpoint(
  input: Omit<WorkflowCheckpoint, "payloadFingerprint"> & {
    readonly payloadFingerprint?: string;
  },
): WorkflowCheckpoint {
  if (input.schemaVersion !== 1) {
    fail("unsupported WorkflowCheckpoint schemaVersion");
  }
  if (!graphSignaturePattern.test(input.graphSignature)) {
    fail("checkpoint graphSignature must be canonical sha256");
  }
  const sequence = positiveInteger(input.sequence, "checkpoint.sequence");
  if (
    input.parentSequence !== null &&
    (
      !Number.isSafeInteger(input.parentSequence) ||
      input.parentSequence < 1 ||
      input.parentSequence >= sequence
    )
  ) {
    fail("checkpoint parentSequence must be null or a positive prior sequence");
  }
  if (sequence === 1 && input.parentSequence !== null) {
    fail("first checkpoint cannot have a parentSequence");
  }
  if (sequence > 1 && input.parentSequence === null) {
    fail("non-initial checkpoint requires parentSequence");
  }

  const payload = createWorkflowCheckpointPayload(input.payload);
  const payloadFingerprint = workflowCheckpointFingerprint(payload);
  if (
    input.payloadFingerprint &&
    input.payloadFingerprint !== payloadFingerprint
  ) {
    fail("supplied checkpoint fingerprint does not match payload");
  }

  return Object.freeze({
    schemaVersion: 1,
    tenantId: input.tenantId,
    workflowRunId: input.workflowRunId,
    workflowVersionId: input.workflowVersionId,
    graphSignature: input.graphSignature,
    sequence,
    parentSequence: input.parentSequence,
    workflowRunRevision: positiveInteger(
      input.workflowRunRevision,
      "checkpoint.workflowRunRevision",
    ),
    payload,
    payloadFingerprint,
    createdAt: input.createdAt,
  });
}

export function assertWorkflowCheckpointCompatible(
  checkpoint: WorkflowCheckpoint,
  expected: WorkflowCheckpointCompatibility,
): void {
  if (
    checkpoint.schemaVersion !== expected.schemaVersion ||
    checkpoint.tenantId !== expected.tenantId ||
    checkpoint.workflowRunId !== expected.workflowRunId ||
    checkpoint.workflowVersionId !== expected.workflowVersionId ||
    checkpoint.graphSignature !== expected.graphSignature
  ) {
    fail("WorkflowCheckpoint is incompatible with requested restore target");
  }
}
