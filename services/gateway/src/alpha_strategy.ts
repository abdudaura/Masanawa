import type {
  AgentInferenceProvider,
  AgentStrategy,
} from "@masanawa/agents";
import { generateAgentInference } from "@masanawa/agents";

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

      const result = await generateAgentInference(input.inference, {
        systemInstructions: Object.freeze(instructions),
        input: request.input,
      });
      const reply = result.text.trim();
      return Object.freeze({
        reply,
        parts: Object.freeze([]),
      });
    },
  });
}
