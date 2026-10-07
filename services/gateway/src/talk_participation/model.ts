export type TalkHandStatus = "idle" | "raised" | "accepted" | "declined";
export type TalkReaction = "❤️" | "👏" | "😂" | "💯" | "🤔" | "🔥";
export type TalkHostRequestKind =
  | "human_speaker"
  | "sponsored_expert"
  | "sponsored_twin";
export type TalkParticipantKind = "human" | "expert" | "twin";
export type TalkHostRequestAction = "accept" | "decline";
export type TalkHostParticipantAction = "mute" | "unmute" | "remove";

export interface TalkParticipationView {
  readonly handStatus: TalkHandStatus;
  readonly reaction: TalkReaction | null;
}

export interface TalkHostRequestView {
  readonly requestId: string;
  readonly kind: TalkHostRequestKind;
  readonly displayName: string;
  readonly detail: string;
  readonly avatarUrl: string | null;
  readonly amountLabel: string | null;
}

export interface TalkHostParticipantView {
  readonly participantId: string;
  readonly displayName: string;
  readonly kind: TalkParticipantKind;
  readonly isHost: boolean;
  readonly isMuted: boolean;
  readonly avatarUrl: string | null;
}

export interface TalkHostControlsView {
  readonly requests: readonly TalkHostRequestView[];
  readonly participants: readonly TalkHostParticipantView[];
}

export interface TalkHostRequestRecord extends TalkHostRequestView {
  readonly requesterUserId: string | null;
  readonly participantId: string;
  readonly participantKind: TalkParticipantKind;
  readonly personaId: string | null;
  readonly commerceAuthorizationId: string | null;
  readonly status: "pending" | "accepted" | "declined" | "cancelled";
}

export interface TalkRequestDecision {
  readonly request: TalkHostRequestRecord;
  readonly controls: TalkHostControlsView;
}

export interface TalkParticipationRepository {
  readViewer(input: Readonly<{
    tenantId: string;
    talkId: string;
    userId: string;
  }>): Promise<TalkParticipationView | null>;

  setReaction(input: Readonly<{
    tenantId: string;
    talkId: string;
    userId: string;
    reaction: TalkReaction;
    changedAt: string;
    minimumIntervalMs: number;
  }>): Promise<TalkParticipationView | null>;

  setHandRaised(input: Readonly<{
    tenantId: string;
    talkId: string;
    userId: string;
    userName: string;
    raised: boolean;
    requestId: string;
    participantId: string;
    changedAt: string;
  }>): Promise<TalkParticipationView | null>;

  readHostControls(input: Readonly<{
    tenantId: string;
    talkId: string;
    hostUserId: string;
  }>): Promise<TalkHostControlsView | null>;

  actOnRequest(input: Readonly<{
    tenantId: string;
    talkId: string;
    hostUserId: string;
    requestId: string;
    action: TalkHostRequestAction;
    changedAt: string;
    maxSeats: number;
    maxAiSeats: number;
  }>): Promise<TalkRequestDecision | null>;

  actOnParticipant(input: Readonly<{
    tenantId: string;
    talkId: string;
    hostUserId: string;
    participantId: string;
    action: TalkHostParticipantAction;
    changedAt: string;
  }>): Promise<TalkHostControlsView | null>;

  endTalk(input: Readonly<{
    tenantId: string;
    talkId: string;
    hostUserId: string;
    endedAt: string;
  }>): Promise<boolean>;
}
