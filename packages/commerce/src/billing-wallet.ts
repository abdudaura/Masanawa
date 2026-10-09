export type NgnFundingIntentState =
  | "creating"
  | "awaiting"
  | "credited"
  | "expired"
  | "failed";

export interface NgnFundingIntent {
  readonly tenantId: string;
  readonly userId: string;
  readonly fundingReference: string;
  readonly txRef: string;
  readonly amountKobo: number;
  readonly quoteId: string | null;
  readonly originatingCharacterId?: string | null;
  readonly state: NgnFundingIntentState;
  readonly accountNumber: string | null;
  readonly bankName: string | null;
  readonly providerOrderRef: string | null;
  readonly providerReference: string | null;
  readonly providerTransactionId: string | null;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface NgnWalletRepository {
  readBalance(input: {
    readonly tenantId: string;
    readonly userId: string;
  }): Promise<number>;

  createFundingIntent(input: {
    readonly tenantId: string;
    readonly userId: string;
    readonly fundingReference: string;
    readonly txRef: string;
    readonly amountKobo: number;
    readonly quoteId?: string | null;
    readonly originatingCharacterId?: string | null;
    readonly expiresAt: string;
    readonly createdAt: string;
  }): Promise<NgnFundingIntent>;

  bindFundingAccount(input: {
    readonly tenantId: string;
    readonly userId: string;
    readonly fundingReference: string;
    readonly accountNumber: string;
    readonly bankName: string;
    readonly providerOrderRef: string | null;
    readonly providerReference: string | null;
    readonly providerExpiry: string;
    readonly boundAt: string;
  }): Promise<NgnFundingIntent>;

  /** Owner-scoped read-only recovery of the newest persisted bill funding intent. */
  readLatestQuoteFunding(input: {
    readonly tenantId: string;
    readonly userId: string;
    readonly quoteId: string;
  }): Promise<NgnFundingIntent | null>;

  readFundingIntent(input: {
    readonly tenantId: string;
    readonly userId: string;
    readonly fundingReference: string;
  }): Promise<NgnFundingIntent | null>;

  readFundingIntentByTxRef(input: {
    readonly txRef: string;
  }): Promise<NgnFundingIntent | null>;

  creditFunding(input: {
    readonly fundingReference: string;
    readonly txRef: string;
    readonly providerTransactionId: string;
    readonly providerReference: string | null;
    readonly amountKobo: number;
    readonly creditedAt: string;
  }): Promise<NgnFundingIntent>;

  reserveBill(input: {
    readonly tenantId: string;
    readonly userId: string;
    readonly quoteId: string;
    readonly amountKobo: number;
    readonly reservedAt: string;
  }): Promise<{ readonly reserved: boolean; readonly balanceKobo: number }>;

  settleBill(input: {
    readonly tenantId: string;
    readonly userId: string;
    readonly quoteId: string;
    readonly state: "succeeded" | "failed" | "reversed";
    readonly settledAt: string;
  }): Promise<{ readonly refunded: boolean; readonly balanceKobo: number }>;
}
