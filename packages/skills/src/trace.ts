import {
  PlatformError,
  isCanonicalId,
  type SkillVersionId,
  type ToolVersionId,
} from "@masanawa/contracts";
import { fingerprintCanonicalJson } from "@masanawa/security";
import type { ToolInvocation } from "@masanawa/tools";
import type { SkillExecutionPlan } from "./planning.js";

export const skillTraceKinds = ["step", "tool", "subskill"] as const;
export type SkillTraceKind = (typeof skillTraceKinds)[number];

export interface SkillTraceMetadata {
  readonly schemaVersion: 1;
  readonly kind: SkillTraceKind;
  readonly rootSkillVersionId: SkillVersionId;
  readonly skillVersionId: SkillVersionId;
  readonly stepOrdinal: number;
  readonly planHash: string;
  readonly referenceKey: string | null;
  readonly toolVersionId: ToolVersionId | null;
  readonly targetSkillVersionId: SkillVersionId | null;
}

function traceError(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "validation",
    message,
    retryable: false,
  });
}

/** Copies only bounded trace fields; caller-owned objects are never evidence. */
export function normalizeSkillTraceMetadata(
  input: SkillTraceMetadata,
): SkillTraceMetadata {
  const invalid = (): never => {
    throw traceError(
      "skill.trace_metadata_invalid",
      "Skill trace metadata is invalid",
    );
  };
  if (input === null || typeof input !== "object") return invalid();
  const {
    schemaVersion, kind, rootSkillVersionId, skillVersionId, stepOrdinal,
    planHash, referenceKey, toolVersionId, targetSkillVersionId,
  } = input;
  if (
    schemaVersion !== 1 ||
    !(skillTraceKinds as readonly string[]).includes(kind) ||
    !isCanonicalId("skill-version", rootSkillVersionId) ||
    !isCanonicalId("skill-version", skillVersionId) ||
    !Number.isSafeInteger(stepOrdinal) || stepOrdinal < 0 ||
    typeof planHash !== "string" || !/^sha256:[0-9a-f]{64}$/u.test(planHash)
  ) return invalid();

  if (kind === "tool") {
    if (
      typeof referenceKey !== "string" || referenceKey.length > 128 ||
      !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(referenceKey) ||
      !isCanonicalId("tool-version", toolVersionId) ||
      targetSkillVersionId !== null
    ) return invalid();
  } else if (
    referenceKey !== null || toolVersionId !== null ||
    (kind === "step" ? targetSkillVersionId !== null :
      !isCanonicalId("skill-version", targetSkillVersionId))
  ) return invalid();

  return Object.freeze({
    schemaVersion, kind, rootSkillVersionId, skillVersionId, stepOrdinal,
    planHash, referenceKey, toolVersionId, targetSkillVersionId,
  });
}

function planStep(
  plan: SkillExecutionPlan,
  ordinal: number,
): SkillExecutionPlan["steps"][number] {
  if (
    !Number.isSafeInteger(ordinal) ||
    ordinal < 0 ||
    ordinal >= plan.steps.length
  ) {
    throw traceError(
      "skill.trace_step_not_found",
      "Skill trace step is not present in the exact execution plan",
    );
  }
  return plan.steps[ordinal]!;
}

export function skillExecutionPlanTraceHash(
  plan: SkillExecutionPlan,
): string {
  return `sha256:${fingerprintCanonicalJson({
    rootSkillVersionId: plan.rootSkillVersionId,
    orderedSkillVersionIds: plan.orderedSkillVersionIds,
    steps: plan.steps.map((step) => ({
      ordinal: step.ordinal,
      skillVersionId: step.skillVersionId,
      dependencyOrdinals: step.dependencyOrdinals,
      toolReferences: step.toolReferences.map((reference) => ({
        referenceKey: reference.referenceKey,
        capability: reference.capability,
        toolVersionId: reference.toolVersionId,
      })),
    })),
  })}`;
}

function metadata(
  plan: SkillExecutionPlan,
  stepOrdinal: number,
  input: {
    readonly kind: SkillTraceKind;
    readonly referenceKey: string | null;
    readonly toolVersionId: ToolVersionId | null;
    readonly targetSkillVersionId: SkillVersionId | null;
  },
): SkillTraceMetadata {
  const step = planStep(plan, stepOrdinal);
  return normalizeSkillTraceMetadata({
    schemaVersion: 1 as const,
    kind: input.kind,
    rootSkillVersionId: plan.rootSkillVersionId,
    skillVersionId: step.skillVersionId,
    stepOrdinal,
    planHash: skillExecutionPlanTraceHash(plan),
    referenceKey: input.referenceKey,
    toolVersionId: input.toolVersionId,
    targetSkillVersionId: input.targetSkillVersionId,
  });
}

export function createSkillStepTraceMetadata(
  plan: SkillExecutionPlan,
  stepOrdinal: number,
): SkillTraceMetadata {
  return metadata(plan, stepOrdinal, {
    kind: "step",
    referenceKey: null,
    toolVersionId: null,
    targetSkillVersionId: null,
  });
}

export function createSkillToolTraceMetadata(
  plan: SkillExecutionPlan,
  stepOrdinal: number,
  referenceKeyInput: string,
  invocation: ToolInvocation,
): SkillTraceMetadata {
  const step = planStep(plan, stepOrdinal);
  const referenceKey = referenceKeyInput.trim().toLowerCase();
  const reference = step.toolReferences.find(
    (item) => item.referenceKey === referenceKey,
  );
  if (!reference) {
    throw traceError(
      "skill.trace_tool_reference_not_declared",
      "Skill trace Tool reference is not declared by the exact SkillVersion",
    );
  }
  if (!isCanonicalId("tool-version", invocation.toolVersionId)) {
    throw traceError(
      "skill.trace_tool_version_invalid",
      "Skill trace ToolVersionId is invalid",
    );
  }
  if (
    reference.toolVersionId !== null &&
    reference.toolVersionId !== invocation.toolVersionId
  ) {
    throw traceError(
      "skill.trace_tool_pin_mismatch",
      "Skill trace ToolVersion does not match the declared exact Tool pin",
    );
  }

  return metadata(plan, stepOrdinal, {
    kind: "tool",
    referenceKey,
    toolVersionId: invocation.toolVersionId,
    targetSkillVersionId: null,
  });
}

export function createSkillSubskillTraceMetadata(
  plan: SkillExecutionPlan,
  callerStepOrdinal: number,
  targetSkillVersionId: SkillVersionId,
): SkillTraceMetadata {
  if (!isCanonicalId("skill-version", targetSkillVersionId)) {
    throw traceError(
      "skill.trace_subskill_version_invalid",
      "Skill trace subskill SkillVersionId is invalid",
    );
  }
  const caller = planStep(plan, callerStepOrdinal);
  const dependencyIndex = caller.skill.dependencies.indexOf(
    targetSkillVersionId,
  );
  if (dependencyIndex < 0) {
    throw traceError(
      "skill.trace_subskill_not_declared",
      "Skill trace subskill must be an exact direct dependency",
    );
  }
  const targetOrdinal = caller.dependencyOrdinals[dependencyIndex];
  if (
    targetOrdinal === undefined ||
    targetOrdinal >= callerStepOrdinal ||
    plan.steps[targetOrdinal]?.skillVersionId !== targetSkillVersionId
  ) {
    throw traceError(
      "skill.trace_subskill_plan_mismatch",
      "Skill trace subskill does not match the exact execution plan",
    );
  }

  return metadata(plan, callerStepOrdinal, {
    kind: "subskill",
    referenceKey: null,
    toolVersionId: null,
    targetSkillVersionId,
  });
}
