export type ParticipationHandStatus = "idle" | "raised" | "accepted" | "declined";
export type TalkReaction = "❤️" | "👏" | "😂" | "💯" | "🤔" | "🔥";

export interface TalkParticipationView {
  readonly handStatus: ParticipationHandStatus;
  readonly reaction?: TalkReaction;
}

export type HostRequestKind = "human_speaker" | "sponsored_expert" | "sponsored_twin";

export interface HostRequestView {
  readonly requestId: string;
  readonly kind: HostRequestKind;
  readonly displayName: string;
  readonly detail?: string;
  readonly avatarUrl?: string;
  readonly amountLabel?: string;
}

export interface HostParticipantView {
  readonly participantId: string;
  readonly displayName: string;
  readonly kind: "human" | "expert" | "twin";
  readonly isHost: boolean;
  readonly isMuted: boolean;
  readonly avatarUrl?: string;
}

export interface HostControlsView {
  readonly requests: readonly HostRequestView[];
  readonly participants: readonly HostParticipantView[];
}

export interface TalkModerationRepository {
  participation(input: Readonly<{
    tenantId: string;
    userId: string;
    talkId: string;
  }>): Promise<TalkParticipationView | null>;
  setReaction(input: Readonly<{
    tenantId: string;
    userId: string;
    displayName: string;
    talkId: string;
    reaction: TalkReaction;
    now: string;
  }>): Promise<TalkParticipationView | null>;
  setRaised(input: Readonly<{
    tenantId: string;
    userId: string;
    displayName: string;
    talkId: string;
    raised: boolean;
    now: string;
  }>): Promise<TalkParticipationView | null>;
  hostControls(input: Readonly<{
    tenantId: string;
    hostUserId: string;
    talkId: string;
  }>): Promise<HostControlsView | null>;
  actOnRequest(input: Readonly<{
    tenantId: string;
    hostUserId: string;
    talkId: string;
    requestId: string;
    action: "accept" | "decline";
    now: string;
  }>): Promise<HostControlsView | null>;
  moderateParticipant(input: Readonly<{
    tenantId: string;
    hostUserId: string;
    talkId: string;
    participantId: string;
    action: "mute" | "unmute" | "remove";
    now: string;
  }>): Promise<HostControlsView | null>;
  endTalk(input: Readonly<{
    tenantId: string;
    hostUserId: string;
    talkId: string;
    now: string;
  }>): Promise<void | null>;
}
