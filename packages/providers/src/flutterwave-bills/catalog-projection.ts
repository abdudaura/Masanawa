import type { FlutterwaveBillItem } from "./client.js";

export type BillingOfferEconomics = Readonly<{
  priceCredits: number;
  fulfillmentReserveCredits: number;
  creatorCommissionCredits: number;
  fallbackCommissionCredits: number;
  platformMarginCredits: number;
  pricingPolicyVersion: string;
}>;

export type BillingOfferDraft = Readonly<{
  provider: "flutterwave";
  country: "NG";
  currency: "NGN";
  key: string;
  title: string;
  billerCode: string;
  itemCode: string;
  providerAmount: string;
  recipientLabel: string | null;
  economics: BillingOfferEconomics;
}>;

export interface BillingPricingPolicy {
  quote(input: Readonly<{
    billerCode: string;
    itemCode: string;
    title: string;
    providerAmount: string;
    currency: "NGN";
  }>): BillingOfferEconomics;
}

function safeKey(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  if (!normalized) throw new TypeError("Billing offer key is empty");
  return normalized.slice(0, 96);
}

function credits(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function normalizeEconomics(input: BillingOfferEconomics): BillingOfferEconomics {
  const price = credits(input.priceCredits, "priceCredits");
  const reserve = credits(input.fulfillmentReserveCredits, "fulfillmentReserveCredits");
  const creator = credits(input.creatorCommissionCredits, "creatorCommissionCredits");
  const fallback = credits(input.fallbackCommissionCredits, "fallbackCommissionCredits");
  const margin = credits(input.platformMarginCredits, "platformMarginCredits");
  if (price < 1 || reserve + creator + margin !== price) {
    throw new RangeError("Billing Offer economics do not sum to price");
  }
  if (fallback > creator) {
    throw new RangeError("Fallback commission cannot exceed creator commission");
  }
  const version = input.pricingPolicyVersion.trim();
  if (!version || version.length > 128) {
    throw new TypeError("pricingPolicyVersion is invalid");
  }
  return Object.freeze({
    priceCredits: price,
    fulfillmentReserveCredits: reserve,
    creatorCommissionCredits: creator,
    fallbackCommissionCredits: fallback,
    platformMarginCredits: margin,
    pricingPolicyVersion: version,
  });
}

export function projectFlutterwaveBillItems(
  items: readonly FlutterwaveBillItem[],
  pricing: BillingPricingPolicy,
): readonly BillingOfferDraft[] {
  return Object.freeze(
    items.map((item) => {
      if (item.currency !== "NGN") {
        throw new TypeError("Only NGN Flutterwave bill items are launch-qualified");
      }
      const economics = normalizeEconomics(
        pricing.quote({
          billerCode: item.billerCode,
          itemCode: item.itemCode,
          title: item.name,
          providerAmount: item.amount,
          currency: item.currency,
        }),
      );
      return Object.freeze({
        provider: "flutterwave" as const,
        country: "NG" as const,
        currency: "NGN" as const,
        key: `flutterwave-bill-${safeKey(item.billerCode)}-${safeKey(item.itemCode)}`,
        title: item.name.trim(),
        billerCode: item.billerCode,
        itemCode: item.itemCode,
        providerAmount: item.amount,
        recipientLabel: item.labelName,
        economics,
      });
    }),
  );
}
