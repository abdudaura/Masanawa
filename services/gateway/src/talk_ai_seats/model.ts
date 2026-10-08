import type { TalkAiSeatPersonaKind, TalkAiSeatQuote, TalkAiSeatMode } from "@masanawa/commerce";

export interface TalkAiSeatPricingPolicy {
  readonly expertPriceCredits: number;
  readonly twinPriceCredits: number;
  readonly hostShareBasisPoints: number;
  readonly twinOwnerShareBasisPoints: number;
  readonly quoteTtlSeconds: number;
}

export interface TalkAiSeatCandidateRecord {
  readonly personaId: string;
  readonly displayName: string;
  readonly kind: TalkAiSeatPersonaKind;
  readonly subtitle: string | null;
  readonly avatarUrl: string | null;
  readonly topics: readonly string[];
  readonly isAvailable: boolean;
  readonly twinOwnerUserId: string | null;
}

export interface TalkAiSeatCandidateView {
  readonly personaId: string;
  readonly displayName: string;
  readonly kind: TalkAiSeatPersonaKind;
  readonly seatFeeLabel: string;
  readonly subtitle?: string;
  readonly avatarUrl?: string;
  readonly topics: readonly string[];
  readonly isAvailable: boolean;
  /** Server-verified: caller owns this Twin. Never inferred on the client. */
  readonly isOwnedByViewer: boolean;
}

export interface TalkAiSeatQuoteView {
  readonly quoteId: string;
  readonly personaId: string;
  readonly displayName: string;
  readonly kind: TalkAiSeatPersonaKind;
  readonly mode: TalkAiSeatMode;
  readonly totalLabel: string;
  readonly expiresAt: string;
  readonly requiresHostApproval: boolean;
}

export type TalkAiSeatRequestStatus =
  | "pending_host"
  | "admitted"
  | "declined"
  | "expired";

export interface TalkAiSeatConfirmView {
  readonly requestId: string;
  readonly status: TalkAiSeatRequestStatus;
  readonly message: string;
}

export interface TalkAiRuntimeSeat {
  readonly tenantId: string;
  readonly talkId: string;
  readonly seatId: string;
  readonly personaId: string;
  readonly kind: TalkAiSeatPersonaKind;
}

export interface TalkAiSeatRepository {
  listCandidates(input: Readonly<{
    tenantId: string;
    talkId: string;
  }>): Promise<readonly TalkAiSeatCandidateRecord[]>;

  createQuote(input: Readonly<{
    tenantId: string;
    talkId: string;
    personaId: string;
    mode: TalkAiSeatMode;
    payerUserId: string;
    pricing: TalkAiSeatPricingPolicy;
    now: string;
  }>): Promise<Readonly<{
    quote: TalkAiSeatQuote;
    requestId: string;
    displayName: string;
  }>>;

  confirm(input: Readonly<{
    tenantId: string;
    payerUserId: string;
    talkId: string;
    quoteId: string;
    now: string;
  }>): Promise<Readonly<{
    requestId: string;
    status: TalkAiSeatRequestStatus;
    displayName: string;
  }>>;

  hostDecision(input: Readonly<{
    tenantId: string;
    hostUserId: string;
    talkId: string;
    requestId: string;
    action: "accept" | "decline";
    now: string;
  }>): Promise<Readonly<{
    handled: boolean;
    status?: TalkAiSeatRequestStatus;
  }>>;

  sweepExpired(input: Readonly<{
    tenantId: string;
    talkId: string;
    now: string;
    limit: number;
  }>): Promise<number>;

  readRuntimeSeat(input: Readonly<{
    tenantId: string;
    talkId: string;
    requestId: string;
  }>): Promise<TalkAiRuntimeSeat | null>;
}
