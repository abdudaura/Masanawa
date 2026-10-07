export type ParticipationHandStatus = "idle" | "raised" | "accepted" | "declined";
export type TalkReaction = "❤️" | "👏" | "😂" | "💯" | "🤔" | "🔥";
export type TalkQuestionStatus = "pending" | "answered" | "dismissed";

export interface TalkQuestionView {
  readonly questionId: string;
  readonly authorName: string;
  readonly body: string;
  readonly status: TalkQuestionStatus;
  readonly createdAt: string;
  readonly resolvedAt?: string;
}

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
  readonly userId?: string;
  readonly personaId?: string;
  readonly avatarUrl?: string;
}

export interface HostControlsView {
  readonly requests: readonly HostRequestView[];
  readonly participants: readonly HostParticipantView[];
}

export type TalkMediaAction =
  | Readonly<{ type: "publish"; identity: string; canPublish: boolean }>
  | Readonly<{ type: "remove"; identity: string }>;

export interface HostMutationResult {
  readonly controls: HostControlsView;
  readonly mediaActions: readonly TalkMediaAction[];
}

export interface EndTalkResult {
  readonly mediaActions: readonly TalkMediaAction[];
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
  submitQuestion(input: Readonly<{
    tenantId: string;
    userId: string;
    displayName: string;
    talkId: string;
    questionId: string;
    body: string;
    now: string;
  }>): Promise<TalkQuestionView | null>;
  listQuestions(input: Readonly<{
    tenantId: string;
    hostUserId: string;
    talkId: string;
  }>): Promise<readonly TalkQuestionView[] | null>;
  resolveQuestion(input: Readonly<{
    tenantId: string;
    hostUserId: string;
    talkId: string;
    questionId: string;
    action: "answered" | "dismissed";
    now: string;
  }>): Promise<readonly TalkQuestionView[] | null>;
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
  }>): Promise<HostMutationResult | null>;
  moderateParticipant(input: Readonly<{
    tenantId: string;
    hostUserId: string;
    talkId: string;
    participantId: string;
    action: "mute" | "unmute" | "remove";
    now: string;
  }>): Promise<HostMutationResult | null>;
  endTalk(input: Readonly<{
    tenantId: string;
    hostUserId: string;
    talkId: string;
    now: string;
  }>): Promise<EndTalkResult | null>;
}
