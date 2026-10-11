import type {
  AgentRunId,
  CharacterId,
  CharacterSessionId,
  Instant,
  RelationshipId,
  RequestId,
  TenantId,
  UserId,
} from "@masanawa/contracts";

export type MobileTurnKind = "text" | "media" | "media-set";
export type MobileTurnState = "pending" | "completed" | "failed";

export interface MobileShellScope {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly characterId: CharacterId;
  readonly relationshipId: RelationshipId;
}

export interface MobileTurnCommand {
  readonly scope: MobileShellScope;
  readonly characterSessionId: CharacterSessionId;
  readonly requestId: RequestId;
  readonly kind: MobileTurnKind;
  readonly userText: string;
  readonly payloadHash: string;
  readonly state: MobileTurnState;
  readonly agentRunId: AgentRunId | null;
  readonly reply: string | null;
  readonly parts: readonly unknown[];
  readonly failureCode: string | null;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export type MobileTurnClaim =
  | { readonly state: "created"; readonly command: MobileTurnCommand }
  | { readonly state: "existing"; readonly command: MobileTurnCommand };

export interface MobileHistoryMessage {
  readonly key: string;
  readonly replyToKey?: string;
  readonly direction: "user" | "assistant";
  readonly requestId: RequestId;
  readonly text: string;
  readonly parts: readonly unknown[];
  readonly agentRunId: AgentRunId | null;
  readonly createdAt: Instant;
}

export interface MobileShellEvent {
  readonly cursor: string;
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly createdAt: Instant;
}

export interface MobileShellActionRecord {
  readonly scope: MobileShellScope;
  readonly characterSessionId: CharacterSessionId;
  readonly documentId: string;
  readonly revision: number;
  readonly tokenHash: string;
  readonly actionId: string;
  readonly nodeId: string;
  readonly valuesHash: string;
  readonly state: "pending" | "accepted" | "failed";
  readonly result: Readonly<Record<string, unknown>> | null;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface MobileShellRepository {
  claimTurn(input: {
    readonly scope: MobileShellScope;
    readonly characterSessionId: CharacterSessionId;
    readonly requestId: RequestId;
    readonly kind: MobileTurnKind;
    readonly userText: string;
    readonly payloadHash: string;
  }): Promise<MobileTurnClaim>;

  completeTurn(input: {
    readonly scope: MobileShellScope;
    readonly requestId: RequestId;
    readonly agentRunId: AgentRunId;
    readonly reply: string;
    readonly parts: readonly unknown[];
  }): Promise<MobileTurnCommand>;

  failTurn(input: {
    readonly scope: MobileShellScope;
    readonly requestId: RequestId;
    readonly agentRunId: AgentRunId | null;
    readonly failureCode: string;
  }): Promise<MobileTurnCommand>;

  readTurn(input: {
    readonly scope: MobileShellScope;
    readonly requestId: RequestId;
  }): Promise<MobileTurnCommand | null>;

  listHistory(input: {
    readonly scope: MobileShellScope;
    readonly limit: number;
    readonly before?: string;
  }): Promise<readonly MobileHistoryMessage[]>;

  appendEvent(input: {
    readonly scope: MobileShellScope;
    readonly characterSessionId: CharacterSessionId | null;
    readonly type: string;
    readonly payload: Readonly<Record<string, unknown>>;
  }): Promise<MobileShellEvent>;

  listEvents(input: {
    readonly scope: MobileShellScope;
    readonly after?: string;
    readonly limit: number;
  }): Promise<readonly MobileShellEvent[]>;

  claimAction(input: {
    readonly scope: MobileShellScope;
    readonly characterSessionId: CharacterSessionId;
    readonly documentId: string;
    readonly revision: number;
    readonly tokenHash: string;
    readonly actionId: string;
    readonly nodeId: string;
    readonly valuesHash: string;
  }): Promise<{ readonly created: boolean; readonly record: MobileShellActionRecord }>;

  settleAction(input: {
    readonly scope: MobileShellScope;
    readonly documentId: string;
    readonly revision: number;
    readonly state: "accepted" | "failed";
    readonly result?: Readonly<Record<string, unknown>>;
  }): Promise<MobileShellActionRecord>;

  readAction(input: {
    readonly scope: MobileShellScope;
    readonly documentId: string;
    readonly revision: number;
  }): Promise<MobileShellActionRecord | null>;
}

export interface MobilePushRegistration {
  readonly tenantId: TenantId;
  readonly userId: UserId;
  readonly installationId: string;
  readonly platform: "android" | "ios";
  readonly token: string;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
}

export interface MobilePushRepository {
  register(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly installationId: string;
    readonly platform: "android" | "ios";
    readonly token: string;
  }): Promise<MobilePushRegistration>;
  unregister(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly installationId: string;
  }): Promise<void>;
  list(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
  }): Promise<readonly MobilePushRegistration[]>;
}

export type MobilePresenceState =
  | "available"
  | "listening"
  | "working"
  | "on_call"
  | "offline";

export interface MobileAgentActivity {
  readonly characterId: CharacterId;
  readonly presence: MobilePresenceState;
  readonly activeWorkCount: number;
}

export interface MobileAgentActivityRepository {
  setPresence(input: {
    readonly scope: MobileShellScope;
    readonly state: MobilePresenceState;
    readonly durationMs: number;
  }): Promise<void>;
  list(input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly characterIds: readonly CharacterId[];
  }): Promise<readonly MobileAgentActivity[]>;
}
