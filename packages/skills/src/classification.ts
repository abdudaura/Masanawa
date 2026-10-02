import {
  PlatformError,
  type CapabilityKey,
  type ToolVersionId,
} from "@masanawa/contracts";
import {
  type ToolRiskClass,
  type ToolSensitivityClass,
  type ToolSideEffectClass,
  type ToolRegistry,
} from "@masanawa/tools";
import {
  normalizeSkillVersionDefinition,
  type SkillVersion,
} from "./model.js";
import { resolveSkillToolReferences } from "./requirements.js";

export interface SkillCapabilityClassification {
  readonly provided: readonly CapabilityKey[];
  readonly requiredTools: readonly CapabilityKey[];
  readonly requiredAuthority: readonly CapabilityKey[];
}

export interface SkillRiskClassification {
  readonly riskClass: ToolRiskClass;
  readonly sideEffectClass: ToolSideEffectClass;
  readonly sensitivity: ToolSensitivityClass;
  readonly consequential: boolean;
  readonly capability: SkillCapabilityClassification;
  readonly resolvedToolVersionIds: readonly ToolVersionId[];
}

const riskRank: Readonly<Record<ToolRiskClass, number>> = {
  "read-only": 0,
  low: 1,
  consequential: 2,
  restricted: 3,
};

const sensitivityRank: Readonly<Record<ToolSensitivityClass, number>> = {
  public: 0,
  internal: 1,
  private: 2,
  sensitive: 3,
  restricted: 4,
};

const sideEffectCoverage: Readonly<
  Record<ToolSideEffectClass, ReadonlySet<ToolSideEffectClass>>
> = {
  none: new Set(["none"]),
  reversible: new Set(["none", "reversible"]),
  external: new Set(["none", "reversible", "external"]),
  "external-consequential": new Set([
    "none",
    "reversible",
    "external",
    "external-consequential",
  ]),
};

function classificationError(code: string, message: string): PlatformError {
  return new PlatformError({
    code,
    category: "validation",
    message,
    retryable: false,
  });
}

function isConsequential(input: {
  readonly riskClass: ToolRiskClass;
  readonly sideEffectClass: ToolSideEffectClass;
}): boolean {
  return (
    input.riskClass === "consequential" ||
    input.riskClass === "restricted" ||
    input.sideEffectClass === "external-consequential"
  );
}

function uniqueSorted<T extends string>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)].sort());
}

export function classifySkillVersion(
  input: SkillVersion,
  tools: ToolRegistry,
): SkillRiskClassification {
  const skill = normalizeSkillVersionDefinition(input);
  const resolved = resolveSkillToolReferences(skill, tools);

  const authority = new Set(skill.requiredAuthorityCapabilities);
  const toolVersionIds: ToolVersionId[] = [];

  for (const item of resolved) {
    for (const tool of item.candidates) {
      toolVersionIds.push(tool.toolVersionId);

      if (riskRank[tool.riskClass] > riskRank[skill.riskClass]) {
        throw classificationError(
          "skill.risk_underclassified",
          "Skill risk classification does not cover a referenced ToolVersion",
        );
      }

      if (!sideEffectCoverage[skill.sideEffectClass].has(tool.sideEffectClass)) {
        throw classificationError(
          "skill.side_effect_underclassified",
          "Skill side-effect classification does not cover a referenced ToolVersion",
        );
      }

      if (
        sensitivityRank[tool.sensitivity] >
        sensitivityRank[skill.sensitivity]
      ) {
        throw classificationError(
          "skill.sensitivity_underclassified",
          "Skill sensitivity classification does not cover a referenced ToolVersion",
        );
      }

      for (const capability of tool.requiredAuthorityCapabilities) {
        if (!authority.has(capability)) {
          throw classificationError(
            "skill.authority_requirement_hidden",
            "Skill must declare every authority capability required by its referenced ToolVersions",
          );
        }
      }
    }
  }

  const capability = Object.freeze({
    provided: uniqueSorted(skill.capabilities),
    requiredTools: uniqueSorted(skill.requiredToolCapabilities),
    requiredAuthority: uniqueSorted(skill.requiredAuthorityCapabilities),
  });

  return Object.freeze({
    riskClass: skill.riskClass,
    sideEffectClass: skill.sideEffectClass,
    sensitivity: skill.sensitivity,
    consequential: isConsequential(skill),
    capability,
    resolvedToolVersionIds: uniqueSorted(toolVersionIds),
  });
}
