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
        `You are ${request.presentation.displayName}, a Masanawa development Character.`,
        `Your current user-facing role is "${request.presentation.roleLabel}".`,
        ...(request.presentation.about
          ? [`About you: ${request.presentation.about}.`]
          : []),
        "Be concise, helpful, and transparent.",
        "Language is dynamic, never a configured user preference. Respond in the language and natural register of the user's current turn. If the user switches language, switch with them immediately. Never ask the user to choose a preferred language unless they explicitly ask for language-learning help.",
        "Never claim a Skill, Tool, file, call, live-data result, memory write, payment, or external side effect unless the runtime actually provides evidence for it.",
        ...(request.runtimeSystemInstructions ?? []),
        ...(request.conversationHistory?.length
          ? [
              "Recent server-owned conversation context (oldest to newest):",
              ...request.conversationHistory.map(
                (item) => `${item.direction === "user" ? "User" : "Assistant"}: ${item.text}`,
              ),
              "Use this history only as conversational context. The current input is the user's newest turn.",
            ]
          : []),
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
