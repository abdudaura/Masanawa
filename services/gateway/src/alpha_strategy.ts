import type {
  AgentInferenceProvider,
  AgentStrategy,
} from "@masanawa/agents";
import { privatePersonaRoleInstructions } from "./production_persona_role.js";
import {
  evaluateSkillDiscovery,
  evaluateSkillEligibility,
  restoreSkillRegistry,
  type SkillGuideRepository,
  type SkillRepository,
} from "@masanawa/skills";

export function createAlphaInferenceStrategy(input: {
  readonly inference: AgentInferenceProvider;
  readonly skills: SkillRepository;
  readonly guides: SkillGuideRepository;
}): AgentStrategy {
  return Object.freeze({
    async execute(
      request: Parameters<AgentStrategy["execute"]>[0],
    ) {
      const instructions = [
        ...privatePersonaRoleInstructions(request.presentation),
        "This is a development runtime: do not claim that any live paid service or external provider has been qualified.",
        "Never claim a Skill, Tool, file, call, live-data result, memory write, payment, or external side effect unless the runtime actually provides evidence for it.",
      ];

      const userText =
        request.input.kind === "text"
          ? request.input.text
          : request.input.caption;

      if (userText.trim() && request.skillVersionIds.length > 0) {
        const snapshot = await input.skills.readSnapshot();
        const registry = restoreSkillRegistry(snapshot);
        const guides = await input.guides.readGuides(request.skillVersionIds);

        const selected = guides
          .map((guide) => {
            const eligibility = evaluateSkillEligibility(
              registry,
              guide.skillVersionId,
            );
            const skill = registry.getVersion(guide.skillVersionId);
            const discovery = evaluateSkillDiscovery(guide, userText);
            return { guide, skill, eligibility, discovery };
          })
          .filter(
            ({ skill, eligibility, discovery }) =>
              skill?.billingMode === "none" &&
              eligibility.eligible &&
              eligibility.advertisable &&
              discovery.eligible,
          )
          .sort((left, right) => {
            if (right.discovery.score !== left.discovery.score) {
              return right.discovery.score - left.discovery.score;
            }
            return (
              right.guide.discovery.priority -
              left.guide.discovery.priority
            );
          })
          .slice(0, 6);

        for (const { guide } of selected) {
          instructions.push(
            `Selected Skill ${guide.skillVersionId}:`,
            guide.instructions,
          );
        }
      }

      const result = await input.inference.generate(
        {
          systemInstructions: Object.freeze(instructions),
          input: request.input,
        },
        {
          ...(request.signal ? { signal: request.signal } : {}),
          maxOutputTokens: 2048,
          ...(request.onTextDelta
            ? { onTextDelta: request.onTextDelta }
            : {}),
        },
      );
      const reply = result.text.trim();
      if (!reply) throw new Error("Alpha inference returned no text");
      return Object.freeze({
        reply,
        parts: Object.freeze([]),
      });
    },
  });
}

