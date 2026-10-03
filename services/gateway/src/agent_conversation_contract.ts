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
  readonly presentation: {
    readonly displayName: string;
    readonly roleLabel: string;
    readonly about: string;
  };
}

export interface AgentConversationAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: CharacterId;
  }): Promise<AgentConversationAdmission>;
}

export interface AlphaConversationExecutor {
  reply(input: {
    readonly characterId: CharacterId;
    readonly characterVersionId: CharacterVersionId;
    readonly displayName: string;
    readonly roleLabel: string;
    readonly about: string;
    readonly text: string;
  }): Promise<string>;

  replyMedia(input: {
    readonly characterId: CharacterId;
    readonly characterVersionId: CharacterVersionId;
    readonly displayName: string;
    readonly roleLabel: string;
    readonly about: string;
    readonly caption: string;
    readonly mimeType: string;
    readonly dataBase64: string;
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
    readonly characterId: string;
    readonly text: string;
    readonly requestId: RequestId;
    readonly correlationId: CorrelationId;
  }): Promise<{
    readonly reply: string;
    readonly agentRunId: string;
    readonly parts: readonly unknown[];
  }>;

  mediaTurn(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterSessionId: string;
    readonly characterId: string;
    readonly caption: string;
    readonly mimeType: string;
    readonly dataBase64: string;
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
    readonly characterId: string;
  }): Promise<void>;
}
