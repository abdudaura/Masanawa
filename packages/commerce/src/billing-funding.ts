/** Canonical Commerce boundary for NGN billing; amounts are never AI Credits. */
export interface BillingFundingAuthority {
  /**
   * Atomically verify owner, immutable quote/revision, explicit confirmation,
   * unexpired terms and verified available NGN funds, then reserve exactly once
   * against fulfillmentReference. Changed retries must conflict. A quote or
   * browser payment callback alone is not proof of funds.
   */
  reserveConfirmedBill(input: Readonly<{
    tenantId: string;
    userId: string;
    quoteId: string;
    quoteRevision: number;
    fulfillmentReference: string;
    billerCode: string;
    itemCode: string;
    customerId: string;
    amount: string;
    currency: "NGN";
  }>): Promise<void>;
  /**
   * Idempotently settle the bound reserve. Release only after matching failed or
   * reversed provider evidence; retain reserves for uncertain/manual-review
   * outcomes. Settlement must preserve originating Character/creator attribution.
   */
  settleBill(input: Readonly<{
    tenantId: string;
    userId: string;
    fulfillmentReference: string;
    state: "succeeded" | "failed" | "reversed";
    providerReference: string | null;
  }>): Promise<void>;
}
