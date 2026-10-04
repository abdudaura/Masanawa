/** Compare normalized admitted terms before reusing a durable financial request. */
export interface FinancialReplayTerms {
  readonly operation: "deposit" | "withdraw" | "convert";
  readonly asset: string;
  readonly network: string | null;
  readonly amount: string;
  readonly destinationAddress: string | null;
  readonly targetAsset?: string | null;
  readonly targetNetwork?: string | null;
}
export function assertFinancialReplay(
  intent: Omit<FinancialReplayTerms, "operation"> & {
    readonly operation: string;
    readonly targetAsset: string | null;
    readonly targetNetwork?: string | null;
    readonly provider: string;
  },
  expected: FinancialReplayTerms,
): void {
  if (
    intent.operation !== expected.operation ||
    intent.asset !== expected.asset ||
    intent.network !== expected.network ||
    intent.amount !== expected.amount ||
    intent.destinationAddress !== expected.destinationAddress ||
    intent.targetAsset !== (expected.targetAsset ?? null) ||
    (intent.targetNetwork ?? null) !== (expected.targetNetwork ?? null) ||
    intent.provider !== "nowpayments"
  ) {
    throw new Error("financial.crypto.request_conflict");
  }
}
