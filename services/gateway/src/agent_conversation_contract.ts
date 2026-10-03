import type {
  CharacterId,
  CharacterSessionId,
  CharacterVersionId,
  CorrelationId,
  RequestId,
} from "@masanawa/contracts";
import type {
  CharacterSessionBindings,
  CharacterSessionScope,
} from "@masanawa/agents";
import type { AuthorityContext } from "@masanawa/security";

export interface AgentConversationAdmission {
  readonly scope: CharacterSessionScope;
  readonly characterVersionId: CharacterVersionId;
  readonly bindings: CharacterSessionBindings;
  readonly authority: AuthorityContext;
}

export interface AgentConversationAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: CharacterId;
  }): Promise<AgentConversationAdmission>;

  authorizeSession(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterSessionId: CharacterSessionId;
  }): Promise<AgentConversationAdmission & {
    readonly characterSessionId: CharacterSessionId;
  }>;
}

export interface AlphaConversationExecutor {
  reply(input: {
    readonly characterId: CharacterId;
    readonly characterVersionId: CharacterVersionId;
    readonly text: string;
  }): Promise<string>;
}

export interface AgentConversationService {
  open(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
  }): Promise<{ readonly characterSessionId: CharacterSessionId }>;

  turn(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterSessionId: string;
    readonly text: string;
    readonly requestId: RequestId;
    readonly correlationId: CorrelationId;
  }): Promise<{
    readonly reply: string;
    readonly agentRunId: string;
    readonly parts: readonly unknown[];
  }>;

  close(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterSessionId: string;
  }): Promise<void>;
}
