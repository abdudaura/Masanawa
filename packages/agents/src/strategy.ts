import type {
  AgentRunId,
  CharacterSessionId,
  CharacterVersionId,
} from "@masanawa/contracts";

/**
 * One admitted user input for an AgentStrategy.
 *
 * This is transient execution input. It is not transcript, Memory, World or
 * Workflow truth. Later context compilation may enrich strategy execution
 * without changing AgentRun custody.
 */
export type AgentStrategyInput =
  | {
      readonly kind: "text";
      readonly text: string;
    }
  | {
      readonly kind: "media";
      readonly caption: string;
      readonly mimeType: string;
      readonly dataBase64: string;
    };

export interface AgentStrategyPresentation {
  readonly displayName: string;
  readonly roleLabel: string;
  readonly about: string;
}

export interface AgentStrategyRequest {
  readonly agentRunId: AgentRunId;
  readonly characterSessionId: CharacterSessionId;
  readonly characterVersionId: CharacterVersionId;
  readonly presentation: AgentStrategyPresentation;
  readonly input: AgentStrategyInput;
}

export interface AgentStrategyResult {
  readonly reply: string;
  readonly parts: readonly unknown[];
}

/**
 * Runtime strategy seam. Strategies may later compile context, select Skills
 * and Tools, enforce budgets or delegate, but callers remain coupled only to
 * this provider-neutral contract.
 */
export interface AgentStrategy {
  execute(input: AgentStrategyRequest): Promise<AgentStrategyResult>;
}

/**
 * Provider-neutral inference boundary used by strategies.
 *
 * Provider/model-specific request shapes, credentials and transport remain
 * outside @masanawa/agents. Inference does not own CharacterSession, AgentRun,
 * Memory, Skills, Tools or Workflow truth.
 */
export interface AgentInferenceRequest {
  readonly systemInstructions: readonly string[];
  readonly input: AgentStrategyInput;
}

export interface AgentInferenceResult {
  readonly text: string;
}

export interface AgentInferenceProvider {
  generate(input: AgentInferenceRequest): Promise<AgentInferenceResult>;
}
