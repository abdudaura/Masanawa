import { PlatformError, parseCanonicalId, type SkillVersionId, type ToolVersionId } from "@masanawa/contracts";
import type { AuthorityContext } from "@masanawa/security";
import type { ToolRegistry } from "@masanawa/tools";
import { createSkillRevisionPin, evaluateSkillEligibility, resolveSkillRevisionPin, type SkillRevisionPin } from "./eligibility.js";
import type { SkillRegistry } from "./registry.js";
import { resolveSkillToolReferences } from "./requirements.js";

export interface SkillToolSelection {
  readonly skillVersionId: SkillVersionId;
  readonly referenceKey: string;
  readonly toolVersionId: ToolVersionId;
}
export interface PreparedSkillSelection {
  readonly revisionPin: SkillRevisionPin;
  readonly tools: readonly SkillToolSelection[];
  /** Preparation is not approval, authority, execution or an action receipt. */
  readonly requiresConfirmation: boolean;
}
export interface SkillSelectionSource {
  prepare(input: { readonly authority: AuthorityContext; readonly skillVersionId: SkillVersionId;
    readonly tools: readonly SkillToolSelection[] }): PreparedSkillSelection;
}
function denied(code: string): never {
  throw new PlatformError({ code, category: "authorization", message: "Skill selection is not admitted by the current registry and authority.", retryable: false });
}

/** Skills owns dependency readiness, exact graph pins and declared Tool requirements. */
export function createSkillSelectionSource(skills: SkillRegistry, tools: ToolRegistry): SkillSelectionSource {
  return Object.freeze({
    prepare(input: Parameters<SkillSelectionSource["prepare"]>[0]): PreparedSkillSelection {
      const root = parseCanonicalId("skill-version", input.skillVersionId);
      if (!Array.isArray(input.tools) || input.tools.length > 64) throw new RangeError("Too many selected Tool references");
      const eligibility = evaluateSkillEligibility(skills, root);
      if (!eligibility.advertised) denied("skill.selection_not_advertised");
      const revisionPin = createSkillRevisionPin(skills, root);
      const plan = resolveSkillRevisionPin(skills, revisionPin);
      if (plan.steps.length > 64) throw new RangeError("Skill selection graph exceeds runtime bound");
      const supplied = input.tools.map(value => {
        if (typeof value.referenceKey !== "string" || value.referenceKey.length < 1 || value.referenceKey.length > 128) throw new TypeError("Selected Tool reference key is invalid");
        return Object.freeze({
        skillVersionId: parseCanonicalId("skill-version", value.skillVersionId),
        referenceKey: value.referenceKey.trim().toLowerCase(),
        toolVersionId: parseCanonicalId("tool-version", value.toolVersionId),
        });
      });
      const consumed = new Set<number>();
      const selected: SkillToolSelection[] = [];
      let requiresConfirmation = false;
      for (const step of plan.steps) {
        if (step.skill.requiredAuthorityCapabilities.some(cap => !input.authority.capabilities.includes(cap))) denied("skill.selection_capability_missing");
        requiresConfirmation ||= step.skill.confirmationPolicy === "required";
        for (const requirement of resolveSkillToolReferences(step.skill, tools)) {
          const indexes = supplied.flatMap((value, index) => value.skillVersionId === step.skillVersionId && value.referenceKey === requirement.reference.referenceKey ? [index] : []);
          if (indexes.length > 1) denied("skill.selection_duplicate_reference");
          const index = indexes[0];
          const explicit = index === undefined ? undefined : supplied[index];
          const toolId = explicit?.toolVersionId ?? requirement.reference.toolVersionId;
          // Capability references require an explicit exact choice; never choose an arbitrary vendor/version.
          if (toolId === null || toolId === undefined) denied("skill.selection_exact_tool_required");
          const tool = requirement.candidates.find(candidate => candidate.toolVersionId === toolId);
          if (!tool) denied("skill.selection_tool_mismatch");
          if (tool.requiredAuthorityCapabilities.some(cap => !input.authority.capabilities.includes(cap))) denied("skill.selection_tool_capability_missing");
          if (index !== undefined) consumed.add(index);
          selected.push(Object.freeze({ skillVersionId: step.skillVersionId,
            referenceKey: requirement.reference.referenceKey, toolVersionId: tool.toolVersionId }));
          if (selected.length > 64) throw new RangeError("Skill selection Tool graph exceeds runtime bound");
        }
      }
      if (consumed.size !== supplied.length) denied("skill.selection_undeclared_tool");
      return Object.freeze({ revisionPin, tools: Object.freeze(selected), requiresConfirmation });
    },
  });
}

