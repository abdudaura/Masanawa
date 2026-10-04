export type CryptoOperation = "deposit" | "convert" | "withdraw";

export interface NowPaymentsCurrencyEvidence {
  readonly providerCode: string;
  readonly asset: string;
  readonly network: string | null;
  readonly operations: Readonly<Record<CryptoOperation, boolean | null>>;
}

export interface RouteQualification {
  readonly route: NowPaymentsCurrencyEvidence;
  readonly eligible: boolean;
  readonly reasons: readonly string[];
}

const NETWORK_SUFFIXES: readonly [string, string][] = [
  ["TRC20", "tron"],
  ["BSC", "bsc"],
  ["SOL", "solana"],
  ["MATIC", "polygon"],
  ["ERC20", "ethereum"],
  ["OMNI", "omni"],
];

function normalizeCode(value: string): string {
  const code = value.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{2,32}$/.test(code)) {
    throw new Error("nowpayments.currency.invalid");
  }
  return code;
}

export function splitProviderCurrency(providerCode: string): {
  readonly asset: string;
  readonly network: string | null;
} {
  const code = normalizeCode(providerCode);
  for (const [suffix, network] of NETWORK_SUFFIXES) {
    if (code.endsWith(suffix) && code.length > suffix.length) {
      return { asset: code.slice(0, -suffix.length), network };
    }
  }
  return { asset: code, network: null };
}

export function normalizeAvailableCurrencies(
  currencies: readonly string[],
): readonly NowPaymentsCurrencyEvidence[] {
  const unique = [...new Set(currencies.map(normalizeCode))].sort();
  return Object.freeze(
    unique.map((providerCode) => {
      const { asset, network } = splitProviderCurrency(providerCode);
      return Object.freeze({
        providerCode,
        asset,
        network,
        operations: Object.freeze({
          deposit: true,
          convert: null,
          withdraw: null,
        }),
      });
    }),
  );
}

export function qualifyRoute(
  route: NowPaymentsCurrencyEvidence,
  operation: CryptoOperation,
  options: {
    readonly excludedNetworks?: readonly string[];
    readonly requireKnownNetwork?: boolean;
  } = {},
): RouteQualification {
  const reasons: string[] = [];
  const excluded = new Set(
    (options.excludedNetworks ?? ["ethereum"]).map((network) => network.toLowerCase()),
  );

  if (route.network !== null && excluded.has(route.network.toLowerCase())) {
    reasons.push("network.excluded");
  }
  if ((options.requireKnownNetwork ?? false) && route.network === null) {
    reasons.push("network.unknown");
  }
  if (route.operations[operation] !== true) {
    reasons.push(
      route.operations[operation] === false
        ? "operation.unavailable"
        : "operation.unverified",
    );
  }

  return Object.freeze({
    route,
    eligible: reasons.length === 0,
    reasons: Object.freeze(reasons),
  });
}
