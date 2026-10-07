import type { NowPaymentsAccountEvidence } from "./account.js";
import {
  withRouteEvidence,
  type NowPaymentsCurrencyEvidence,
} from "./catalog.js";
import type { NowPaymentsClient } from "./client.js";
import type { NowPaymentsCustodyClient } from "./custody.js";
import type { NowPaymentsPayoutClient } from "./payout.js";

export interface NowPaymentsRuntimeEvidence {
  readonly account: NowPaymentsAccountEvidence;
  readonly routes: readonly NowPaymentsCurrencyEvidence[];
}

export interface NowPaymentsRuntimeEvidenceConfig {
  readonly conversionEnabled: boolean;
  readonly payoutEnabled: boolean;
  readonly ipWhitelistSatisfied: boolean;
  readonly payoutDestinationWhitelistSatisfied: boolean;
  readonly conversionProviderCodes: readonly string[];
  readonly withdrawalProviderCodes: readonly string[];
}

function code(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,32}$/u.test(normalized)) {
    throw new Error("nowpayments.runtime_evidence.provider_code.invalid");
  }
  return normalized;
}

function normalizedSet(values: readonly string[]): ReadonlySet<string> {
  return new Set(values.map(code));
}

function assertConfiguredRoutesExist(
  configured: ReadonlySet<string>,
  available: ReadonlySet<string>,
  operation: "conversion" | "withdrawal",
): void {
  for (const providerCode of configured) {
    if (!available.has(providerCode)) {
      throw new Error(`nowpayments.runtime_evidence.${operation}_route.unavailable`);
    }
  }
}

export async function collectNowPaymentsRuntimeEvidence(input: {
  readonly payments: NowPaymentsClient;
  readonly custody: NowPaymentsCustodyClient;
  readonly payout?: NowPaymentsPayoutClient;
  readonly config: NowPaymentsRuntimeEvidenceConfig;
  readonly now?: () => Date;
  readonly signal?: AbortSignal;
}): Promise<NowPaymentsRuntimeEvidence> {
  const conversionCodes = normalizedSet(input.config.conversionProviderCodes);
  const withdrawalCodes = normalizedSet(input.config.withdrawalProviderCodes);

  if (input.config.conversionEnabled && conversionCodes.size < 2) {
    throw new Error("nowpayments.runtime_evidence.conversion_routes.insufficient");
  }
  if (input.config.payoutEnabled && withdrawalCodes.size < 1) {
    throw new Error("nowpayments.runtime_evidence.withdrawal_routes.insufficient");
  }
  if (input.config.payoutEnabled && input.payout === undefined) {
    throw new Error("nowpayments.runtime_evidence.payout_client.required");
  }

  const [baseRoutes] = await Promise.all([
    input.payments.listPaymentCurrencies(input.signal),
    input.custody.readBalances(input.signal),
  ]);

  if (input.config.conversionEnabled) {
    await input.custody.authenticate(input.signal);
  }
  if (input.config.payoutEnabled) {
    await input.payout!.authenticate(input.signal);
  }

  const available = new Set(baseRoutes.map((route) => route.providerCode));
  assertConfiguredRoutesExist(conversionCodes, available, "conversion");
  assertConfiguredRoutesExist(withdrawalCodes, available, "withdrawal");

  const routes = baseRoutes.map((route) => {
    let enriched = withRouteEvidence(route, {
      operation: "convert",
      operationAvailable:
        input.config.conversionEnabled && conversionCodes.has(route.providerCode),
    });
    enriched = withRouteEvidence(enriched, {
      operation: "withdraw",
      operationAvailable:
        input.config.payoutEnabled && withdrawalCodes.has(route.providerCode),
    });
    return enriched;
  });

  return Object.freeze({
    account: Object.freeze({
      custodyEnabled: true,
      customerManagementEnabled: null,
      conversionEnabled: input.config.conversionEnabled,
      payoutEnabled: input.config.payoutEnabled,
      ipWhitelistSatisfied: input.config.ipWhitelistSatisfied,
      payoutDestinationWhitelistSatisfied:
        input.config.payoutDestinationWhitelistSatisfied,
      observedAt: (input.now ?? (() => new Date()))().toISOString(),
    }),
    routes: Object.freeze(routes),
  });
}
