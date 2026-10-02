import {
  PlatformError,
  type SkillVersionId,
  type ToolVersionId,
} from "@masanawa/contracts";
import {
  canonicalJson,
  type AuthorityContext,
  type CanonicalJson,
} from "@masanawa/security";
import {
  normalizeToolInvocation,
  type ToolInvocation,
  type ToolRegistry,
} from "@masanawa/tools";
import type { SkillExecutionPlan } from "./planning.js";

export interface SkillToolCall {
  readonly stepOrdinal: number;
  readonly referenceKey: string;
  readonly toolVersionId?: ToolVersionId;
  readonly authority: AuthorityContext;
  readonly input: CanonicalJson;
  readonly idempotencyKey: string | null;
}

export interface SkillSubskillCall {
  readonly stepOrdinal: number;
  readonly dependencySkillVersionId: SkillVersionId;
  readonly authority: AuthorityContext;
  readonly input: CanonicalJson;
}

export interface SkillSubskillInvocation {
  readonly callerSkillVersionId: SkillVersionId;
  readonly targetSkillVersionId: SkillVersionId;
  readonly targetStepOrdinal: number;
  readonly authority: AuthorityContext;
  readonly input: CanonicalJson;
}

function boundaryError(
  code: string,
  category: "validation" | "not-found" | "authorization",
  message: string,
): PlatformError {
  return new PlatformError({
    code,
    category,
    message,
    retryable: false,
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
    throw boundaryError(
      "skill.execution_step_not_found",
      "not-found",
      "Skill execution step is not present in the execution plan",
    );
  }
  return plan.steps[ordinal]!;
}

function freezeCanonical(value: CanonicalJson): CanonicalJson {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(freezeCanonical));
  }
  if (value !== null && typeof value === "object") {
    const output: Record<string, CanonicalJson> = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = freezeCanonical(item);
    }
    return Object.freeze(output);
  }
  return value;
}

function normalizeBoundaryInput(value: CanonicalJson): CanonicalJson {
  return freezeCanonical(
    JSON.parse(canonicalJson(value)) as CanonicalJson,
  );
}

export function bindSkillToolInvocation(
  plan: SkillExecutionPlan,
  tools: ToolRegistry,
  call: SkillToolCall,
): ToolInvocation {
  const step = planStep(plan, call.stepOrdinal);
  const reference = step.toolReferences.find(
    (item) => item.referenceKey === call.referenceKey.trim().toLowerCase(),
  );
  if (!reference) {
    throw boundaryError(
      "skill.tool_reference_not_declared",
      "authorization",
      "Skill may invoke only a Tool reference declared by its exact SkillVersion",
    );
  }

  let toolVersionId: ToolVersionId;
  if (reference.toolVersionId !== null) {
    if (
      call.toolVersionId !== undefined &&
      call.toolVersionId !== reference.toolVersionId
    ) {
      throw boundaryError(
        "skill.tool_reference_pin_mismatch",
        "authorization",
        "Skill Tool call cannot override an exact ToolVersion pin",
      );
    }
    toolVersionId = reference.toolVersionId;
  } else {
    if (call.toolVersionId === undefined) {
      throw boundaryError(
        "skill.tool_version_required",
        "validation",
        "Provider-neutral Skill Tool references require an exact ToolVersion at execution time",
      );
    }
    toolVersionId = call.toolVersionId;
  }

  const tool = tools.getToolVersion(toolVersionId);
  if (!tool) {
    throw boundaryError(
      "skill.tool_version_not_found",
      "not-found",
      "Skill Tool call targets an unknown ToolVersion",
    );
  }
  if (!tool.capabilities.includes(reference.capability)) {
    throw boundaryError(
      "skill.tool_reference_capability_mismatch",
      "authorization",
      "Selected ToolVersion does not satisfy the declared Skill Tool capability",
    );
  }

  return normalizeToolInvocation({
    toolVersionId,
    authority: call.authority,
    input: call.input,
    idempotencyKey: call.idempotencyKey,
    providerSelection: null,
  });
}

export function bindSkillSubskillInvocation(
  plan: SkillExecutionPlan,
  call: SkillSubskillCall,
): SkillSubskillInvocation {
  const caller = planStep(plan, call.stepOrdinal);

  const dependencyIndex = caller.skill.dependencies.indexOf(
    call.dependencySkillVersionId,
  );
  if (dependencyIndex < 0) {
    throw boundaryError(
      "skill.subskill_not_declared",
      "authorization",
      "Skill may invoke only an exact direct subskill dependency declared by its SkillVersion",
    );
  }

  const targetStepOrdinal =
    caller.dependencyOrdinals[dependencyIndex];
  if (
    targetStepOrdinal === undefined ||
    targetStepOrdinal >= caller.ordinal
  ) {
    throw boundaryError(
      "skill.subskill_plan_mismatch",
      "validation",
      "Declared subskill dependency is not represented by an earlier execution-plan step",
    );
  }

  const target = planStep(plan, targetStepOrdinal);
  if (target.skillVersionId !== call.dependencySkillVersionId) {
    throw boundaryError(
      "skill.subskill_plan_mismatch",
      "validation",
      "Execution-plan dependency ordinal does not match the declared SkillVersion",
    );
  }

  return Object.freeze({
    callerSkillVersionId: caller.skillVersionId,
    targetSkillVersionId: target.skillVersionId,
    targetStepOrdinal,
    authority: call.authority,
    input: normalizeBoundaryInput(call.input),
  });
}
