import type {
  AgentInferenceLimits,
  AgentInferenceProvider,
  AgentStrategy,
} from "@masanawa/agents";
import { PlatformError } from "@masanawa/contracts";
import { normalizeAgentInferenceLimits, generateAgentInference } from "@masanawa/agents";

export function createAlphaInferenceStrategy(input: {
  readonly inference: AgentInferenceProvider;
  readonly limits?: Partial<AgentInferenceLimits>;
}): AgentStrategy {
  const limits = normalizeAgentInferenceLimits(input.limits);
  return Object.freeze({
    async execute(
      request: Parameters<AgentStrategy["execute"]>[0],
    ) {
      const context = request.context;
      if (context && (context.agentRunId !== request.agentRunId ||
          context.characterSessionId !== request.characterSessionId ||
          context.characterVersionId !== request.characterVersionId)) {
        throw new PlatformError({ code: "agents.context_scope_mismatch", category: "authorization",
          message: "Compiled context does not match the admitted run.", retryable: false });
      }
      const identityInstructions = context ? context.systemInstructions : [
        `You are ${request.presentation.displayName}, a Masanawa development Character.`,
        `Your current user-facing role is "${request.presentation.roleLabel}".`,
        ...(request.presentation.about
          ? [`About you: ${request.presentation.about}.`]
          : []),
      ];
      const instructions = [
        ...identityInstructions,
        "Be concise, helpful, and transparent.",
        "This Alpha strategy is temporary. Do not claim tools, files, calls, memory, live data, or side effects unless the runtime actually provides them.",
      ];

      const result = await generateAgentInference(input.inference, {
        systemInstructions: Object.freeze(instructions),
        input: request.input,
      }, limits);
      const reply = result.text.trim();
      return Object.freeze({
        reply,
        parts: Object.freeze([]),
      });
    },
  });
}
