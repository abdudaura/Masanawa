import type {
  AgentInferenceProvider,
  AgentStrategy,
} from "@masanawa/agents";
import {
  evaluateSkillDiscovery,
  evaluateSkillEligibility,
  restoreSkillRegistry,
  type SkillGuideRepository,
  type SkillRepository,
} from "@masanawa/skills";

export function createProductionAgentStrategy(input: {
  readonly inference: AgentInferenceProvider;
  readonly skills: SkillRepository;
  readonly guides: SkillGuideRepository;
}): AgentStrategy {
  const strategy: AgentStrategy = {
    async execute(request) {
      const instructions = [
        `You are ${request.presentation.displayName}, a Masanawa Character.`,
        `Your current user-facing role is "${request.presentation.roleLabel}".`,
        ...(request.presentation.about
          ? [`About you: ${request.presentation.about}.`]
          : []),
        "Follow the user's language and communication style unless they ask otherwise.",
        "Be helpful, accurate, and transparent.",
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
            return right.guide.discovery.priority - left.guide.discovery.priority;
          })
          .slice(0, 8);

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
          maxOutputTokens: 4096,
          ...(request.onTextDelta ? { onTextDelta: request.onTextDelta } : {}),
        },
      );
      const reply = result.text.trim();
      if (!reply) throw new Error("Production inference returned no text");
      return Object.freeze({
        reply,
        parts: Object.freeze([]),
      });
    },
  };
  return Object.freeze(strategy);
}
