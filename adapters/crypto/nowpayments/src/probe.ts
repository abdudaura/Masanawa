import type { NowPaymentsClient } from "./client.js";

export interface NowPaymentsReadOnlyProbeResult {
  readonly apiReachable: true;
  readonly authenticated: true;
  readonly currencyCount: number;
  readonly sampleProviderCodes: readonly string[];
  readonly minimumCheck:
    | {
        readonly currencyFrom: string;
        readonly currencyTo: string;
        readonly minimumAmount: number;
      }
    | null;
}

export async function runReadOnlyNowPaymentsProbe(
  client: NowPaymentsClient,
  options: {
    readonly sampleLimit?: number;
    readonly minimumPair?: {
      readonly currencyFrom: string;
      readonly currencyTo: string;
    };
    readonly signal?: AbortSignal;
  } = {},
): Promise<NowPaymentsReadOnlyProbeResult> {
  const sampleLimit = options.sampleLimit ?? 5;
  if (!Number.isInteger(sampleLimit) || sampleLimit < 0 || sampleLimit > 20) {
    throw new Error("nowpayments.probe.sample_limit.invalid");
  }

  await client.checkApiStatus(options.signal);
  const currencies = await client.listPaymentCurrencies(options.signal);

  const minimumCheck =
    options.minimumPair === undefined
      ? null
      : await client.getMinimumAmount({
          currencyFrom: options.minimumPair.currencyFrom,
          currencyTo: options.minimumPair.currencyTo,
          ...(options.signal === undefined ? {} : { signal: options.signal }),
        });

  return Object.freeze({
    apiReachable: true,
    authenticated: true,
    currencyCount: currencies.length,
    sampleProviderCodes: Object.freeze(
      currencies.slice(0, sampleLimit).map((currency) => currency.providerCode),
    ),
    minimumCheck,
  });
}
