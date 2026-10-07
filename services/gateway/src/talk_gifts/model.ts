export interface TalkGiftTarget {
  readonly talkId: string;
  readonly talkTitle: string;
  readonly hostUserId: string;
  readonly hostName: string;
}

export interface TalkGiftReceipt {
  readonly giftId: string;
  readonly talkId: string;
  readonly recipientUserId: string;
  readonly recipientName: string;
  readonly amountCredits: number;
  readonly status: "completed";
  readonly completedAt: string;
}

export interface TalkGiftRepository {
  resolveTarget(input: Readonly<{
    tenantId: string;
    talkId: string;
  }>): Promise<TalkGiftTarget | null>;
}

export interface TalkGiftExecutor {
  execute(input: Readonly<{
    tenantId: string;
    requestId: string;
    senderUserId: string;
    recipientUserId: string;
    amountCredits: number;
  }>): Promise<Readonly<{
    giftId: string;
    amountCredits: number;
    status: "completed";
    completedAt: string;
    replayed: boolean;
  }>>;
}

export interface TalkGiftActivitySink {
  append(input: Readonly<{
    tenantId: string;
    requestId: string;
    recipientUserId: string;
    senderUserId: string;
    talkId: string;
    talkTitle: string;
    giftId: string;
    amountCredits: number;
    completedAt: string;
  }>): Promise<void>;
}
