import { PlatformError, type ToolVersionId } from "@masanawa/contracts";
import {
  type ToolDefinition,
  type ToolRegistry,
} from "@masanawa/tools";
import {
  normalizeSkillVersionDefinition,
  type SkillToolReference,
  type SkillVersion,
} from "./model.js";

export interface ResolvedSkillToolReference {
  readonly reference: SkillToolReference;
  readonly candidates: readonly ToolDefinition[];
}

function requirementError(
  code: string,
  message: string,
): PlatformError {
  return new PlatformError({
    code,
    category: "validation",
    message,
    retryable: false,
  });
}

function sortTools(
  values: readonly ToolDefinition[],
): readonly ToolDefinition[] {
  return Object.freeze(
    [...values].sort(
      (left, right) =>
        left.key.localeCompare(right.key) ||
        left.version.localeCompare(right.version) ||
        left.toolVersionId.localeCompare(right.toolVersionId),
    ),
  );
}

function resolveExactTool(
  toolVersionId: ToolVersionId,
  reference: SkillToolReference,
  tools: ToolRegistry,
): ToolDefinition {
  const tool = tools.getToolVersion(toolVersionId);
  if (tool === null) {
    throw requirementError(
      "skill.tool_reference_not_found",
      "Skill Tool reference pins an unknown ToolVersionId",
    );
  }
  if (!tool.capabilities.includes(reference.capability)) {
    throw requirementError(
      "skill.tool_reference_capability_mismatch",
      "Pinned ToolVersion does not provide the required capability",
    );
  }
  return tool;
}

export function resolveSkillToolReferences(
  input: SkillVersion,
  tools: ToolRegistry,
): readonly ResolvedSkillToolReference[] {
  const skill = normalizeSkillVersionDefinition(input);

  for (const capability of skill.requiredToolCapabilities) {
    if (tools.getCapability(capability) === null) {
      throw requirementError(
        "skill.required_tool_capability_not_registered",
        "Skill requires an unregistered Tool capability",
      );
    }
  }

  return Object.freeze(
    skill.toolReferences.map((reference) => {
      if (reference.toolVersionId !== null) {
        return Object.freeze({
          reference,
          candidates: Object.freeze([
            resolveExactTool(reference.toolVersionId, reference, tools),
          ]),
        });
      }

      const candidates = sortTools(
        tools
          .listToolVersions()
          .filter((tool) => tool.capabilities.includes(reference.capability)),
      );
      if (candidates.length < 1) {
        throw requirementError(
          "skill.tool_reference_unresolved",
          "No registered ToolVersion provides the required capability",
        );
      }

      return Object.freeze({ reference, candidates });
    }),
  );
}
