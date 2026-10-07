export type TalkLiveState = "live" | "reconnecting" | "ended";
export type TalkLiveRole = "host" | "listener";

export interface TalkLiveSessionView {
  readonly sessionId: string;
  readonly talkId: string;
  readonly role: TalkLiveRole;
  readonly state: TalkLiveState;
  readonly canPublishAudio: boolean;
  readonly canHearAudio: boolean;
  readonly aiGenerationAllowed: boolean;
  readonly reconnectGraceEndsAt: string | null;
}

export interface TalkLiveStateView {
  readonly talkId: string;
  readonly state: TalkLiveState;
  readonly hostConnected: boolean;
  readonly listenerCount: number;
  readonly aiGenerationAllowed: boolean;
  readonly reconnectGraceEndsAt: string | null;
}

export interface TalkLiveRepository {
  connect(input: Readonly<{
    tenantId: string;
    userId: string;
    talkId: string;
    sessionId: string;
    now: string;
    reconnectGraceMs: number;
  }>): Promise<TalkLiveSessionView | null>;
  heartbeat(input: Readonly<{
    tenantId: string;
    userId: string;
    talkId: string;
    sessionId: string;
    now: string;
    reconnectGraceMs: number;
  }>): Promise<TalkLiveSessionView | null>;
  disconnect(input: Readonly<{
    tenantId: string;
    userId: string;
    talkId: string;
    sessionId: string;
    now: string;
    reconnectGraceMs: number;
  }>): Promise<TalkLiveStateView | null>;
  state(input: Readonly<{
    tenantId: string;
    userId: string;
    talkId: string;
    now: string;
  }>): Promise<TalkLiveStateView | null>;
}
