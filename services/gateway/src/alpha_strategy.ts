import type {
  AgentInferenceProvider,
  AgentStrategy,
} from "@masanawa/agents";

export function createAlphaInferenceStrategy(input: {
  readonly inference: AgentInferenceProvider;
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
        "This Alpha strategy is temporary. Do not claim tools, files, calls, memory, live data, or side effects unless the runtime actually provides them.",
      ];

      const result = await input.inference.generate({
        systemInstructions: Object.freeze(instructions),
        input: request.input,
      });
      const reply = result.text.trim();
      if (!reply) throw new Error("Alpha inference returned no text");
      return Object.freeze({
        reply,
        parts: Object.freeze([]),
      });
    },
  });
}
