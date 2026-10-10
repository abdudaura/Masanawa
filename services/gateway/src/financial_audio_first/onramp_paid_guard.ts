/**
 * Fail closed before passing a provider-reported finished fiat purchase to the
 * crediting repository. This guards refresh, readback, and signed IPN alike.
 * The caller must still authenticate the provider and bind the stored invoice.
 *
 * Do not round or use Number: fractional underpayments must never mint funds.
 */
export interface FiatOnRampPaidEvidence {
  readonly status: string;
  readonly payAmount: string;
  readonly actuallyPaid: string;
}

const SCALE = 10n ** 18n;

function atomicAmount(value: string): bigint {
  if (
    typeof value !== "string" ||
    value.length > 80 ||
    !/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/u.test(value)
  ) {
    throw new Error("financial.crypto.onramp_evidence_invalid");
  }
  const [whole = "0", fraction = ""] = value.split(".");
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(18, "0") || "0");
}

/**
 * A finished payment with insufficient actually_paid is neither a confirmed
 * purchase nor permission to issue crypto/MSN. Pending/partial statuses remain
 * available to existing repository reconciliation.
 */
export function assertFiatOnRampFinishedFunded(
  evidence: FiatOnRampPaidEvidence,
): void {
  if (evidence.status !== "finished") return;
  const due = atomicAmount(evidence.payAmount);
  const paid = atomicAmount(evidence.actuallyPaid);
  if (due === 0n || paid < due) {
    throw new Error("financial.crypto.onramp_evidence_mismatch");
  }
}
