export interface NowPaymentsMinimumAmount {
  readonly currencyFrom: string;
  readonly currencyTo: string;
  readonly minimumAmount: number;
}

export interface NowPaymentsEstimate {
  readonly currencyFrom: string;
  readonly currencyTo: string;
  readonly requestedAmount: number;
  readonly estimatedAmount: number;
}

function normalizeCurrency(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,32}$/.test(normalized)) {
    throw new Error("nowpayments.currency.invalid");
  }
  return normalized;
}

function finitePositive(value: unknown, code: string): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(code);
  return parsed;
}

export function parseMinimumAmount(
  body: unknown,
  fallback: { readonly currencyFrom: string; readonly currencyTo: string },
): NowPaymentsMinimumAmount {
  if (typeof body !== "object" || body === null) {
    throw new Error("nowpayments.minimum.invalid_response");
  }
  const record = body as Record<string, unknown>;
  return Object.freeze({
    currencyFrom: normalizeCurrency(
      typeof record.currency_from === "string" ? record.currency_from : fallback.currencyFrom,
    ),
    currencyTo: normalizeCurrency(
      typeof record.currency_to === "string" ? record.currency_to : fallback.currencyTo,
    ),
    minimumAmount: finitePositive(record.min_amount, "nowpayments.minimum.invalid_response"),
  });
}

export function parseEstimate(
  body: unknown,
  fallback: {
    readonly amount: number;
    readonly currencyFrom: string;
    readonly currencyTo: string;
  },
): NowPaymentsEstimate {
  if (typeof body !== "object" || body === null) {
    throw new Error("nowpayments.estimate.invalid_response");
  }
  const record = body as Record<string, unknown>;
  return Object.freeze({
    currencyFrom: normalizeCurrency(
      typeof record.currency_from === "string" ? record.currency_from : fallback.currencyFrom,
    ),
    currencyTo: normalizeCurrency(
      typeof record.currency_to === "string" ? record.currency_to : fallback.currencyTo,
    ),
    requestedAmount: finitePositive(
      record.amount_from ?? fallback.amount,
      "nowpayments.estimate.invalid_response",
    ),
    estimatedAmount: finitePositive(
      record.estimated_amount,
      "nowpayments.estimate.invalid_response",
    ),
  });
}

export function assertAboveMinimum(
  amount: number,
  minimum: NowPaymentsMinimumAmount,
): void {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("nowpayments.amount.invalid");
  if (amount < minimum.minimumAmount) throw new Error("nowpayments.amount.below_minimum");
}
