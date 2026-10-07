export interface TalkPollOptionView {
  readonly optionId: string;
  readonly label: string;
  readonly voteCount: number;
}

export interface TalkPollView {
  readonly pollId: string;
  readonly question: string;
  readonly status: "open" | "closed";
  readonly options: readonly TalkPollOptionView[];
  readonly totalVotes: number;
  readonly myOptionId?: string;
  readonly createdAt: string;
  readonly closedAt?: string;
}

export interface TalkPollOptionDraft {
  readonly optionId: string;
  readonly label: string;
}

export interface TalkPollRepository {
  current(input: Readonly<{
    tenantId: string;
    userId: string;
    talkId: string;
  }>): Promise<TalkPollView | null>;
  create(input: Readonly<{
    tenantId: string;
    hostUserId: string;
    talkId: string;
    pollId: string;
    question: string;
    options: readonly TalkPollOptionDraft[];
    now: string;
  }>): Promise<TalkPollView | null>;
  vote(input: Readonly<{
    tenantId: string;
    userId: string;
    talkId: string;
    pollId: string;
    optionId: string;
    now: string;
  }>): Promise<TalkPollView | null>;
  close(input: Readonly<{
    tenantId: string;
    hostUserId: string;
    talkId: string;
    pollId: string;
    now: string;
  }>): Promise<TalkPollView | null>;
}
