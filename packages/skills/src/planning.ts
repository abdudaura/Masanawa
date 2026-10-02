import {
  type CapabilityKey,
  type SkillVersionId,
} from "@masanawa/contracts";
import type { SkillToolReference, SkillVersion } from "./model.js";
import type { SkillRegistry } from "./registry.js";

export interface SkillExecutionPlanStep {
  readonly ordinal: number;
  readonly skillVersionId: SkillVersionId;
  readonly skill: SkillVersion;
  readonly dependencyOrdinals: readonly number[];
  readonly toolReferences: readonly SkillToolReference[];
}

export interface SkillExecutionPlan {
  readonly rootSkillVersionId: SkillVersionId;
  readonly steps: readonly SkillExecutionPlanStep[];
  readonly orderedSkillVersionIds: readonly SkillVersionId[];
  readonly requiredToolCapabilities: readonly CapabilityKey[];
}

export function composeSkillExecutionPlan(
  registry: SkillRegistry,
  rootSkillVersionId: SkillVersionId,
): SkillExecutionPlan {
  const ordered = registry.resolveExecutionPlan(rootSkillVersionId);
  const ordinalByVersionId = new Map<SkillVersionId, number>();

  ordered.forEach((skill, ordinal) => {
    ordinalByVersionId.set(skill.skillVersionId, ordinal);
  });

  const steps = ordered.map((skill, ordinal) => {
    const dependencyOrdinals = skill.dependencies.map((dependency) => {
      const dependencyOrdinal = ordinalByVersionId.get(dependency);
      if (
        dependencyOrdinal === undefined ||
        dependencyOrdinal >= ordinal
      ) {
        throw new TypeError(
          "Skill execution plan dependency order is invalid",
        );
      }
      return dependencyOrdinal;
    });

    return Object.freeze({
      ordinal,
      skillVersionId: skill.skillVersionId,
      skill,
      dependencyOrdinals: Object.freeze(dependencyOrdinals),
      toolReferences: skill.toolReferences,
    });
  });

  if (
    steps.length < 1 ||
    steps.at(-1)?.skillVersionId !== rootSkillVersionId
  ) {
    throw new TypeError("Skill execution plan root ordering is invalid");
  }

  return Object.freeze({
    rootSkillVersionId,
    steps: Object.freeze(steps),
    orderedSkillVersionIds: Object.freeze(
      steps.map((step) => step.skillVersionId),
    ),
    requiredToolCapabilities:
      registry.requiredToolCapabilities(rootSkillVersionId),
  });
}
