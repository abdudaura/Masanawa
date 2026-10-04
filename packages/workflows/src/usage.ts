import { createHash } from "node:crypto";
import {
  workflowUsageLimits,
  type WorkflowUsageEvidence,
  type WorkflowUsageTotals,
} from "./usage-model.js";

const stableKeyPattern = /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]*$/u;
const allowedCategories = new Set([
  "inference",
  "tool",
  "provider",
  "workflow",
]);

function fail(message: string): never {
  throw new TypeError(message);
}

function boundedOptionalKey(
  value: string | null,
  name: string,
  maxLength: number,
): string | null {
  if (value === null) return null;
  if (
    value.length === 0 ||
    value.length > maxLength ||
    !stableKeyPattern.test(value)
  ) {
    fail(`${name} must use a stable bounded key format`);
  }
  return value;
}

function nonNegativeSafeInteger(
  value: unknown,
  name: string,
  max: number,
): number {
  if (
    !Number.isSafeInteger(value) ||
    (value as number) < 0 ||
    (value as number) > max
  ) {
    fail(`${name} must be a non-negative safe integer no greater than ${max}`);
  }
  return value as number;
}

export function createWorkflowUsageEvidence(
  input: WorkflowUsageEvidence,
): WorkflowUsageEvidence {
  if (!allowedCategories.has(input.category)) {
    fail("usage category is not supported");
  }
  const evidenceKey = boundedOptionalKey(
    input.evidenceKey,
    "evidenceKey",
    workflowUsageLimits.maxEvidenceKeyLength,
  );
  if (evidenceKey === null) {
    fail("evidenceKey is required");
  }

  return Object.freeze({
    usageEventId: input.usageEventId,
    tenantId: input.tenantId,
    workflowRunId: input.workflowRunId,
    taskId: input.taskId,
    operationId: input.operationId,
    providerId: input.providerId,
    category: input.category,
    providerKey: boundedOptionalKey(
      input.providerKey,
      "providerKey",
      workflowUsageLimits.maxProviderKeyLength,
    ),
    modelKey: boundedOptionalKey(
      input.modelKey,
      "modelKey",
      workflowUsageLimits.maxModelKeyLength,
    ),
    inputUnits: nonNegativeSafeInteger(
      input.inputUnits,
      "inputUnits",
      workflowUsageLimits.maxUnits,
    ),
    outputUnits: nonNegativeSafeInteger(
      input.outputUnits,
      "outputUnits",
      workflowUsageLimits.maxUnits,
    ),
    costMicros: nonNegativeSafeInteger(
      input.costMicros,
      "costMicros",
      workflowUsageLimits.maxCostMicros,
    ),
    latencyMs: nonNegativeSafeInteger(
      input.latencyMs,
      "latencyMs",
      workflowUsageLimits.maxLatencyMs,
    ),
    evidenceKey,
    occurredAt: input.occurredAt,
  });
}

export function workflowUsageFingerprint(
  input: WorkflowUsageEvidence,
): string {
  const usage = createWorkflowUsageEvidence(input);
  return createHash("sha256")
    .update(
      JSON.stringify({
        usageEventId: usage.usageEventId,
        tenantId: usage.tenantId,
        workflowRunId: usage.workflowRunId,
        taskId: usage.taskId,
        operationId: usage.operationId,
        providerId: usage.providerId,
        category: usage.category,
        providerKey: usage.providerKey,
        modelKey: usage.modelKey,
        inputUnits: usage.inputUnits,
        outputUnits: usage.outputUnits,
        costMicros: usage.costMicros,
        latencyMs: usage.latencyMs,
        evidenceKey: usage.evidenceKey,
        occurredAt: usage.occurredAt,
      }),
      "utf8",
    )
    .digest("hex");
}

export function totalWorkflowUsage(
  records: readonly WorkflowUsageEvidence[],
): WorkflowUsageTotals {
  let inputUnits = 0;
  let outputUnits = 0;
  let costMicros = 0;
  let latencyMs = 0;

  for (const raw of records) {
    const record = createWorkflowUsageEvidence(raw);
    inputUnits += record.inputUnits;
    outputUnits += record.outputUnits;
    costMicros += record.costMicros;
    latencyMs += record.latencyMs;
    if (
      !Number.isSafeInteger(inputUnits) ||
      !Number.isSafeInteger(outputUnits) ||
      !Number.isSafeInteger(costMicros) ||
      !Number.isSafeInteger(latencyMs)
    ) {
      fail("workflow usage aggregate exceeds safe integer range");
    }
  }

  return Object.freeze({
    recordCount: records.length,
    inputUnits,
    outputUnits,
    costMicros,
    latencyMs,
  });
}
