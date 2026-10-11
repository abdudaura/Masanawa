import type {
  CharacterSessionId,
  RequestId,
} from "@masanawa/contracts";
import type {
  CharacterSession,
  MobileHistoryMessage,
  MobileShellActionRecord,
  MobileShellEvent,
} from "@masanawa/agents";
import type { AgentConversationAdmission } from "./agent_conversation_contract.js";

export interface AgentShellActionInput {
  readonly documentId: string;
  readonly revision: number;
  readonly nodeId: string;
  readonly actionId: string;
  readonly token: string;
  readonly values: Readonly<Record<string, string>>;
}

export interface AgentShellActionExecution {
  readonly accepted: boolean;
  readonly phase:
    | "submitted"
    | "processing"
    | "fulfilled"
    | "failed"
    | "cancelled";
  readonly document?: unknown;
  readonly parts?: readonly unknown[];
  readonly message?: string;
}

export interface AgentShellActionExecutor {
  execute(input: {
    readonly authorizationHeader: string | undefined;
    readonly admission: AgentConversationAdmission;
    readonly session: CharacterSession;
    readonly action: AgentShellActionInput;
  }): Promise<AgentShellActionExecution>;
}

export interface AgentShellService {
  config(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly clientVersion?: string;
    readonly capabilities?: Readonly<Record<string, unknown>>;
  }): Promise<{
    readonly shellVersion: number;
    readonly minimumAppVersion: string;
    readonly recommendedAppVersion: string;
    readonly features: Readonly<Record<string, boolean>>;
  }>;

  history(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly limit: number;
    readonly before?: string;
  }): Promise<readonly MobileHistoryMessage[]>;

  turnStatus(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly requestId: RequestId;
  }): Promise<{
    readonly state: "missing" | "pending" | "completed" | "failed";
    readonly reply?: string;
    readonly parts?: readonly unknown[];
    readonly agentRunId?: string;
    readonly failureCode?: string;
  }>;

  events(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly after?: string;
    readonly limit: number;
  }): Promise<readonly MobileShellEvent[]>;

  dispatchAction(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly characterSessionId: CharacterSessionId;
    readonly action: AgentShellActionInput;
  }): Promise<{
    readonly record: MobileShellActionRecord;
    readonly execution?: AgentShellActionExecution;
  }>;

  setPresence(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly state: "available" | "listening" | "working" | "on_call" | "offline";
    readonly durationMs: number;
  }): Promise<{ readonly updated: true }>;

  actionStatus(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly documentId: string;
    readonly revision: number;
  }): Promise<MobileShellActionRecord | null>;
}

export interface LiveVoiceTokenService {
  mint(input: {
    readonly authorizationHeader: string | undefined;
    readonly characterId: string;
    readonly admissionId?: string | null;
    readonly purpose?: "conversation" | "twin-setup";
  }): Promise<{
    readonly callId?: string;
    readonly token: string;
    readonly websocketUrl: string;
    readonly model: string;
    readonly voiceName: string;
    readonly expiresAt: string;
  }>;
}
