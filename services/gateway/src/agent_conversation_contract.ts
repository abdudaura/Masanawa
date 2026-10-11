import type {
  CharacterId,
  CharacterSessionId,
  CharacterVersionId,
  CorrelationId,
  RequestId,
} from "@masanawa/contracts";
import type {
  AgentConversationRepresentation,
  AgentConversationSurface,
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

/** Durable server custody only; this is never a human delivery/read receipt. */
export interface AgentTurnReceipt {
  readonly requestId: RequestId;
  readonly state: "pending" | "completed" | "failed";
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
    readonly surface?: AgentConversationSurface;
    readonly representation?: AgentConversationRepresentation;
    readonly onTextDelta?: (delta: string) => void | Promise<void>;
    readonly onAccepted?: (receipt: AgentTurnReceipt) => void;
    readonly onAudioPcmChunk?: (dataBase64: string) => void | Promise<void>;
    readonly signal?: AbortSignal;
  }): Promise<{
    readonly reply: string;
    readonly agentRunId: string;
    readonly parts: readonly unknown[];
    readonly audioBase64?: string;
    readonly audioMimeType?: string;
    readonly audioDurationMs?: number;
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
    readonly surface?: AgentConversationSurface;
    readonly representation?: AgentConversationRepresentation;
    readonly signal?: AbortSignal;
  }): Promise<{
    readonly reply: string;
    readonly agentRunId: string;
    readonly parts: readonly unknown[];
    readonly audioBase64?: string;
    readonly audioMimeType?: string;
    readonly audioDurationMs?: number;
  }>;

  mediaSetTurn(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterSessionId: string;
    readonly characterId: string;
    readonly caption: string;
    readonly media: readonly {
      readonly mimeType: string;
      readonly dataBase64: string;
      readonly name?: string;
    }[];
    readonly requestId: RequestId;
    readonly correlationId: CorrelationId;
    readonly surface?: AgentConversationSurface;
    readonly representation?: AgentConversationRepresentation;
    readonly signal?: AbortSignal;
  }): Promise<{
    readonly reply: string;
    readonly agentRunId: string;
    readonly parts: readonly unknown[];
    readonly audioBase64?: string;
    readonly audioMimeType?: string;
    readonly audioDurationMs?: number;
  }>;

  close(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterSessionId: string;
    readonly characterId: string;
  }): Promise<void>;
}
