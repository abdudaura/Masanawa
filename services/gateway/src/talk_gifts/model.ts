export type TalkGiftVisual = "applause" | "heart" | "flower" | "spark" | "crown" | "celebration";

export interface TalkGiftCatalogItem {
  readonly id: string;
  readonly name: string;
  readonly visual: TalkGiftVisual;
  readonly amountCredits: number;
  readonly available: boolean;
}

/** Qualified, server-owned options for the exact tenant and giftable Talk.
 * A failed source must fail closed; do not substitute made-up client prices. */
export interface TalkGiftCatalogSource {
  load(input: Readonly<{
    tenantId: string;
    talkId: string;
  }>): Promise<readonly TalkGiftCatalogItem[]>;
}

export interface TalkGiftCatalog {
  readonly talkId: string;
  readonly currency: "Credits";
  readonly items: readonly TalkGiftCatalogItem[];
}

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
  readonly catalogItemId?: string;
  readonly completedAt: string;
}

export interface TalkGiftRepository {
  resolveTarget(input: Readonly<{
    tenantId: string;
    talkId: string;
    /** Derived solely from authenticated platform session, not the caller body. */
    senderUserId: string;
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

