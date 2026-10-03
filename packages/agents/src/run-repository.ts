import type {
  AgentRunId,
  CharacterSessionId,
  CharacterVersionId,
} from "@masanawa/contracts";
import type { AuthorityContext } from "@masanawa/security";
import type {
  AgentRun,
  AgentRunLineage,
  AgentRunScope,
  AgentRunTraceReferences,
} from "./run.js";

export interface AgentRunRequest {
  readonly authority: AuthorityContext;
  readonly scope: AgentRunScope;
  readonly agentRunId: AgentRunId;
}

export interface CreateAgentRunInput extends AgentRunRequest {
  readonly characterSessionId: CharacterSessionId;
  readonly characterVersionId: CharacterVersionId;
  readonly lineage: AgentRunLineage;
  readonly trace: AgentRunTraceReferences;
}

export interface FinishAgentRunInput extends AgentRunRequest {
  readonly outcome:
    | { readonly state: "completed" }
    | { readonly state: "failed"; readonly failureCode: string };
}

export interface AgentRunRepository {
  create(input: CreateAgentRunInput): Promise<AgentRun>;
  read(input: AgentRunRequest): Promise<AgentRun>;
  finish(input: FinishAgentRunInput): Promise<AgentRun>;
}
