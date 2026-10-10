import { assertPayoutEvidence, parseVerifiedPayoutIpn } from "./financial_payout_evidence.js";
import { admitFiatOnRampEvidence } from "./financial_onramp_evidence.js";
import { assertFiatOnRampFinishedFunded } from "./financial_audio_first/onramp_paid_guard.js";
import { admitPaymentEvidence } from "./financial_payment_evidence.js";
import { assertFinancialReplay, type FinancialReplayTerms } from "./financial_replay.js";
import {
  nowInstant,
  parseCanonicalId,
  type Instant,
  type RequestId,
  type TenantId,
  type UserId,
} from "@masanawa/contracts";
import {
  normalizeCryptoAmount,
  normalizeCryptoAsset,
  type CryptoIntent,
  type CryptoProviderPaymentEvent,
  type CryptoRepository,
  type CryptoWithdrawalFeePayer,
} from "@masanawa/commerce";
import {
  NowPaymentsClient,
  NowPaymentsCustodyClient,
  NowPaymentsPayoutClient,
  assertAboveMinimum,
  parseVerifiedPaymentIpn,
  splitProviderCurrency,
  type NowPaymentsCurrencyEvidence,
  type NowPaymentsAccountEvidence,
  assertFreshAccountEvidence, qualifyAccountCapability, qualifyRoute,
} from "@masanawa/nowpayments";

export interface FinancialAuthority {
  readonly tenantId: TenantId;
  readonly userId: UserId;
}

export interface FinancialAuthorizer {
  authorize(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<FinancialAuthority>;
}

export interface FinancialDepositView {
  readonly requestId: RequestId;
  readonly asset: string;
  readonly network: string | null;
  readonly amount: string;
  readonly status: CryptoIntent["status"];
  readonly providerPaymentId: string | null;
  readonly payAddress: string | null;
  readonly providerPayAmount: string | null;
  readonly outcomeUnknown: boolean;
}

export interface FinancialWithdrawalView {
  readonly requestId: RequestId;
  readonly asset: string;
  readonly network: string | null;
  readonly amount: string;
  readonly destinationAddress: string | null;
  readonly status: CryptoIntent["status"];
  readonly providerPayoutId: string | null;
  readonly verificationRequired: boolean;
  readonly outcomeUnknown: boolean;
}

export type FinancialWithdrawalNetworkFeeMode = "sender" | "receiver";

export interface FinancialWithdrawalQuote {
  readonly providerCode: string;
  readonly amount: string;
  readonly destinationAddress: string;
  readonly minimumAmount: string;
  readonly networkFee: string;
  readonly networkFeeMode: FinancialWithdrawalNetworkFeeMode;
  readonly feePayer: CryptoWithdrawalFeePayer;
  readonly estimatedReceiveAmount: string;
  readonly addressValidated: true;
  readonly quotedAt: Instant;
}

export interface FinancialConversionView {
  readonly requestId: RequestId;
  readonly asset: string;
  readonly network: string | null;
  readonly amount: string;
  readonly targetAsset: string;
  readonly targetNetwork: string | null;
  readonly targetAmount: string | null;
  readonly status: CryptoIntent["status"];
  readonly providerConversionId: string | null;
  readonly outcomeUnknown: boolean;
}

export interface FinancialConversionQuote {
  readonly providerCode: string;
  readonly targetProviderCode: string;
  readonly amount: string;
  readonly minimumAmount: string;
  readonly estimatedTargetAmount: string;
  readonly quotedAt: Instant;
}

export interface FinancialCapabilities {
  readonly deposits: boolean;
  readonly withdrawals: boolean;
  readonly conversions: boolean;
  readonly fiatOnRamp: boolean;
  readonly fiatCurrencies: readonly string[];
  readonly fiatSettlementProviderCode: string | null;
  readonly payoutReason: string | null;
  readonly conversionReason: string | null;
  readonly fiatOnRampReason: string | null;
}

export interface FinancialFiatPurchaseView {
  readonly requestId: RequestId;
  readonly fiatAmount: string;
  readonly fiatCurrency: string;
  readonly settlementAsset: string;
  readonly settlementNetwork: string | null;
  readonly cryptoAmount: string | null;
  readonly status: CryptoIntent["status"];
  readonly providerInvoiceId: string | null;
  readonly providerPaymentId: string | null;
  readonly checkoutUrl: string | null;
  readonly outcomeUnknown: boolean;
}

export interface FinancialService {
  capabilities(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<FinancialCapabilities>;
  listDepositRoutes(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<readonly NowPaymentsCurrencyEvidence[]>;
  listConversionRoutes(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<readonly NowPaymentsCurrencyEvidence[]>;
  listWithdrawalRoutes(input: {
    readonly authorizationHeader: string | undefined;
  }): Promise<readonly NowPaymentsCurrencyEvidence[]>;
  createDeposit(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
    readonly providerCode: string;
    readonly amount: string;
  }): Promise<FinancialDepositView>;
  createFiatPurchase(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
    readonly fiatAmount: string;
    readonly fiatCurrency: string;
  }): Promise<FinancialFiatPurchaseView>;
  refreshFiatPurchase(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
  }): Promise<FinancialFiatPurchaseView>;
  quoteWithdrawal(input: {
    readonly authorizationHeader: string | undefined;
    readonly providerCode: string;
    readonly amount: string;
    readonly destinationAddress: string;
  }): Promise<FinancialWithdrawalQuote>;
  createWithdrawal(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
    readonly providerCode: string;
    readonly amount: string;
    readonly destinationAddress: string;
  }): Promise<FinancialWithdrawalView>;
  quoteConversion(input: {
    readonly authorizationHeader: string | undefined;
    readonly providerCode: string;
    readonly targetProviderCode: string;
    readonly amount: string;
  }): Promise<FinancialConversionQuote>;
  createConversion(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
    readonly providerCode: string;
    readonly targetProviderCode: string;
    readonly amount: string;
  }): Promise<FinancialConversionView>;
  refreshConversion(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
  }): Promise<FinancialConversionView>;
  /**
   * Legacy compatibility only. Merchant payout verification is server-side and
   * this method always fails closed; the shared HTTP route should be removed.
   */
  verifyWithdrawal(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
    readonly verificationCode: string;
  }): Promise<FinancialWithdrawalView>;
  refreshWithdrawal(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
  }): Promise<FinancialWithdrawalView>;
  readBalance(input: {
    readonly authorizationHeader: string | undefined;
    readonly providerCode: string;
  }): Promise<{ readonly providerCode: string; readonly amount: string }>;
  listHistory(input: {
    readonly authorizationHeader: string | undefined;
    readonly limit?: number;
  }): Promise<readonly CryptoIntent[]>;
  readIntent(input: {
    readonly authorizationHeader: string | undefined;
    readonly requestId: string;
  }): Promise<CryptoIntent | null>;
  handleNowPaymentsIpn(input: {
    readonly signature: string;
    readonly payload: unknown;
  }): Promise<{ readonly accepted: true; readonly requestId: RequestId }>;
  handleNowPaymentsPayoutIpn(input: {
    readonly signature: string;
    readonly payload: unknown;
  }): Promise<{ readonly accepted: true; readonly requestId: RequestId }>;
}

function bearer(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/iu.exec(header.trim());
  return match?.[1]?.trim() || null;
}

export function createFixedFinancialAuthorizer(input: {
  readonly token: string;
  readonly tenantId: TenantId;
  readonly userId: UserId;
}): FinancialAuthorizer {
  const token = input.token.trim();
  if (!token) throw new TypeError("financial.auth.token.required");
  return Object.freeze({
    async authorize(request: Parameters<FinancialAuthorizer["authorize"]>[0]) {
      const supplied = bearer(request.authorizationHeader);
      if (supplied !== token) throw new Error("financial.auth.unauthorized");
      return Object.freeze({ tenantId: input.tenantId, userId: input.userId });
    },
  });
}

function providerOrderId(tenantId: TenantId, requestId: RequestId): string {
  return `${tenantId}.${requestId}`;
}

function parseProviderOrderId(value: string | null): {
  readonly tenantId: TenantId;
  readonly requestId: RequestId;
} {
  if (value === null) throw new Error("financial.ipn.order_id.required");
  const separator = value.indexOf(".");
  if (separator < 1 || separator !== value.lastIndexOf(".")) {
    throw new Error("financial.ipn.order_id.invalid");
  }
  return Object.freeze({
    tenantId: parseCanonicalId("tenant", value.slice(0, separator)),
    requestId: parseCanonicalId("request", value.slice(separator + 1)),
  });
}

function depositView(intent: CryptoIntent): FinancialDepositView {
  return Object.freeze({
    requestId: intent.requestId,
    asset: intent.asset,
    network: intent.network,
    amount: intent.amount,
    status: intent.status,
    providerPaymentId: intent.providerPaymentId,
    payAddress: intent.payAddress,
    providerPayAmount: intent.providerPayAmount,
    outcomeUnknown:
      intent.providerDispatchStartedAt !== null && intent.providerPaymentId === null,
  });
}

function withdrawalView(intent: CryptoIntent): FinancialWithdrawalView {
  return Object.freeze({
    requestId: intent.requestId,
    asset: intent.asset,
    network: intent.network,
    amount: intent.amount,
    destinationAddress: intent.destinationAddress,
    status: intent.status,
    providerPayoutId: intent.providerPayoutId,
    verificationRequired:
      intent.providerPayoutId !== null &&
      intent.status === "processing",
    outcomeUnknown:
      intent.providerDispatchStartedAt !== null && intent.providerPayoutId === null,
  });
}

function conversionView(intent: CryptoIntent): FinancialConversionView {
  if (intent.operation !== "convert" || intent.targetAsset === null) {
    throw new Error("financial.crypto.conversion_unavailable");
  }
  return Object.freeze({
    requestId: intent.requestId,
    asset: intent.asset,
    network: intent.network,
    amount: intent.amount,
    targetAsset: intent.targetAsset,
    targetNetwork: intent.targetNetwork ?? null,
    targetAmount: intent.providerTargetAmount ?? null,
    status: intent.status,
    providerConversionId: intent.providerConversionId ?? null,
    outcomeUnknown:
      intent.providerDispatchStartedAt !== null &&
      (intent.providerConversionId ?? null) === null,
  });
}

function fiatPurchaseView(intent: CryptoIntent): FinancialFiatPurchaseView {
  if (intent.operation !== "buy" || intent.targetAsset === null) {
    throw new Error("financial.crypto.fiat_onramp_unavailable");
  }
  return Object.freeze({
    requestId: intent.requestId,
    fiatAmount: intent.amount,
    fiatCurrency: intent.asset,
    settlementAsset: intent.targetAsset,
    settlementNetwork: intent.targetNetwork ?? null,
    cryptoAmount: intent.providerTargetAmount ?? null,
    status: intent.status,
    providerInvoiceId: intent.providerInvoiceId ?? null,
    providerPaymentId: intent.providerPaymentId,
    checkoutUrl: intent.checkoutUrl ?? null,
    outcomeUnknown:
      intent.providerDispatchStartedAt !== null &&
      (intent.providerInvoiceId ?? null) === null,
  });
}

function payoutSucceeded(status: string | null): boolean {
  return status !== null && ["finished", "success", "successful", "sent"].includes(status);
}

function payoutFailed(status: string | null): boolean {
  return status !== null && ["failed", "rejected", "rejected_not_checked", "cancelled", "canceled", "expired"].includes(status);
}

function conversionSucceeded(status: string): boolean {
  return ["finished", "completed", "success", "successful"].includes(status);
}

function conversionFailed(status: string): boolean {
  return ["failed", "rejected", "cancelled", "canceled", "expired"].includes(status);
}

function numberToPlainDecimal(value: number): string {
  const text = String(value);
  if (!/[eE]/u.test(text)) return text;
  const match = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/u.exec(text);
  if (!match) throw new Error("financial.crypto.amount_unavailable");
  const sign = match[1] ?? "";
  const integer = match[2] ?? "";
  const fraction = match[3] ?? "";
  const exponent = Number(match[4]);
  if (!Number.isSafeInteger(exponent)) throw new Error("financial.crypto.amount_unavailable");
  const digits = integer + fraction;
  const decimalAt = integer.length + exponent;
  if (decimalAt <= 0) return sign + "0." + "0".repeat(-decimalAt) + digits;
  if (decimalAt >= digits.length) return sign + digits + "0".repeat(decimalAt - digits.length);
  return sign + digits.slice(0, decimalAt) + "." + digits.slice(decimalAt);
}

function decimalUnits(value: string, allowZero = false): bigint {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/u.test(normalized)) {
    throw new Error("financial.crypto.amount_unavailable");
  }
  const [whole = "0", fraction = ""] = normalized.split(".");
  const units = BigInt(whole + fraction.padEnd(18, "0"));
  if (!allowZero && units <= 0n) throw new Error("financial.crypto.amount_unavailable");
  return units;
}

function amountAtLeast(left: string, right: string): boolean {
  return decimalUnits(left) >= decimalUnits(right);
}

function decimalFromUnits(units: bigint): string {
  if (units < 0n) throw new Error("financial.crypto.amount_unavailable");
  const raw = units.toString().padStart(19, "0");
  const whole = raw.slice(0, -18).replace(/^0+(?=\d)/u, "") || "0";
  const fraction = raw.slice(-18).replace(/0+$/u, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

function normalizeFiatAmount(value: string): string {
  const normalized = normalizeCryptoAmount(value);
  const decimals = normalized.includes(".")
    ? normalized.length - normalized.indexOf(".") - 1
    : 0;
  if (decimals > 2) throw new Error("financial.crypto.fiat_amount_invalid");
  const numeric = Number(normalized);
  if (
    !Number.isFinite(numeric) ||
    numeric <= 0 ||
    numberToPlainDecimal(numeric) !== normalized
  ) {
    throw new Error("financial.crypto.fiat_amount_invalid");
  }
  return normalized;
}

export function createFinancialService(input: {
  readonly authorizer: FinancialAuthorizer;
  readonly crypto: CryptoRepository;
  readonly nowPayments: NowPaymentsClient;
  readonly nowPaymentsCustody?: NowPaymentsCustodyClient;
  readonly nowPaymentsPayout?: NowPaymentsPayoutClient;
  readonly withdrawalEvidence?: () => Promise<{
    readonly account: NowPaymentsAccountEvidence;
    readonly routes: readonly NowPaymentsCurrencyEvidence[];
  }>;
  readonly conversionEvidence?: () => Promise<{
    readonly account: NowPaymentsAccountEvidence;
    readonly routes: readonly NowPaymentsCurrencyEvidence[];
  }>;
  /**
   * Must match the NOWPayments dashboard payout network-fee setting.
   * "receiver": network fee reduces what the destination receives.
   * "sender": Masanawa/custody pays network fee on top of the requested amount.
   * Omission fails withdrawal capability closed.
   */
  readonly withdrawalNetworkFeeMode?: FinancialWithdrawalNetworkFeeMode;
  readonly fiatOnRamp?: {
    readonly enabled: true;
    readonly fiatCurrencies: readonly string[];
    /**
     * Must match the merchant's NOWPayments fiat on-ramp crypto settlement
     * currency / first payout-wallet currency and a live custody balance key.
     */
    readonly settlementProviderCode: string;
  };
  /**
   * Standard NOWPayments wallet payouts are whitelist-controlled. This callback
   * must prove that the exact destination, not merely its syntax, is approved
   * for the current user/asset before any user balance is reserved.
   */
  readonly withdrawalDestinationApproved?: (input: {
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly providerCode: string;
    readonly destinationAddress: string;
  }) => Promise<boolean>;
  /**
   * Server-side merchant 2FA source. Never accept this code from an end-user route.
   * Return null when the provider account does not require verification.
   */
  readonly payoutVerificationCodeProvider?: (input: {
    readonly batchId: string;
    readonly tenantId: TenantId;
    readonly userId: UserId;
    readonly requestId: RequestId;
  }) => Promise<string | null>;
  readonly nowPaymentsIpnSecret: string;
  readonly publicBaseUrl: string;
  readonly now?: () => Instant;
}): FinancialService {
  const now = input.now ?? nowInstant;
  const ipnSecret = input.nowPaymentsIpnSecret.trim();
  if (!ipnSecret) throw new TypeError("financial.ipn.secret.required");
  const base = new URL(input.publicBaseUrl);
  if (base.protocol !== "https:") throw new TypeError("financial.public_base_url.insecure");
  const ipnCallbackUrl = new URL("/v1/financial/nowpayments/ipn", base).toString();
  const payoutIpnCallbackUrl =
    new URL("/v1/financial/nowpayments/payout-ipn", base).toString();
  const withdrawalNetworkFeeMode = input.withdrawalNetworkFeeMode ?? null;
  const fiatOnRamp = input.fiatOnRamp?.enabled !== true
    ? null
    : Object.freeze({
        settlementProviderCode: normalizeCryptoAsset(
          input.fiatOnRamp.settlementProviderCode,
        ),
        fiatCurrencies: Object.freeze([
          ...new Set(input.fiatOnRamp.fiatCurrencies.map(normalizeCryptoAsset)),
        ]),
      });
  if (fiatOnRamp !== null && fiatOnRamp.fiatCurrencies.length === 0) {
    throw new TypeError("financial.crypto.fiat_onramp.currencies_required");
  }

  async function authority(header: string | undefined) {
    return input.authorizer.authorize({ authorizationHeader: header });
  }

  async function qualifiedDepositRoutes(): Promise<readonly NowPaymentsCurrencyEvidence[]> {
    if (!input.nowPaymentsCustody) return Object.freeze([]);
    const signal = AbortSignal.timeout(15_000);
    const [routes, balances] = await Promise.all([
      input.nowPayments.listEligiblePaymentRoutes({
        operation: "deposit",
        signal,
      }),
      input.nowPaymentsCustody.readBalances(signal),
    ]);
    const custodyCurrencies = new Set(balances.map((entry) => entry.currency));
    return Object.freeze(
      routes
        .map((entry) => entry.route)
        .filter((route) => custodyCurrencies.has(route.providerCode)),
    );
  }

  async function currentDepositRoute(providerCode: string) {
    const routes = await qualifiedDepositRoutes();
    return routes.find((route) => route.providerCode === providerCode) ?? null;
  }

  async function qualifiedFiatOnRamp() {
    if (fiatOnRamp === null || !input.nowPaymentsCustody) return null;
    const routes = await qualifiedDepositRoutes();
    const settlement = routes.find(
      (route) => route.providerCode === fiatOnRamp.settlementProviderCode,
    );
    if (!settlement) return null;
    return Object.freeze({
      settlement,
      fiatCurrencies: fiatOnRamp.fiatCurrencies,
    });
  }

  async function routesCoveredByCustody(
    routes: readonly NowPaymentsCurrencyEvidence[],
  ): Promise<readonly NowPaymentsCurrencyEvidence[]> {
    if (!input.nowPaymentsCustody) return Object.freeze([]);
    const balances = await input.nowPaymentsCustody.readBalances(AbortSignal.timeout(15_000));
    const balanceByCurrency = new Map(
      balances.map((entry) => [entry.currency, entry.available] as const),
    );
    const covered: NowPaymentsCurrencyEvidence[] = [];
    for (const route of routes) {
      const liability = await input.crypto.readPlatformAggregateLiability({
        asset: route.providerCode,
        network: route.network,
      });
      const custodyBalance = balanceByCurrency.get(route.providerCode) ?? "0";
      if (
        decimalUnits(custodyBalance, true) >=
        decimalUnits(liability, true)
      ) {
        covered.push(route);
      }
    }
    return Object.freeze(covered);
  }

  async function qualifiedWithdrawalRoutes() {
    if (
      !input.nowPaymentsPayout ||
      !input.nowPaymentsCustody ||
      !input.withdrawalEvidence ||
      !input.withdrawalDestinationApproved ||
      withdrawalNetworkFeeMode === null
    ) return null;
    const evidence = await input.withdrawalEvidence();
    assertFreshAccountEvidence(evidence.account, { now: new Date(now()) });
    for (const capability of ["custody", "payout"] as const) {
      if (!qualifyAccountCapability(evidence.account, capability).eligible) return null;
    }
    const eligible = evidence.routes.filter(route => qualifyRoute(route, "withdraw").eligible);
    // Masanawa currently settles user ownership in the canonical internal ledger.
    // Customer Management capability alone does not prove a specific provider
    // sub-account is bound to this user, so live pooled coverage is always required.
    return routesCoveredByCustody(eligible);
  }

  async function qualifiedConversionRoutes() {
    if (!input.nowPaymentsCustody || !input.conversionEvidence) return null;
    const evidence = await input.conversionEvidence();
    assertFreshAccountEvidence(evidence.account, { now: new Date(now()) });
    for (const capability of ["custody", "conversion"] as const) {
      if (!qualifyAccountCapability(evidence.account, capability).eligible) return null;
    }
    const eligible = evidence.routes.filter((route) => qualifyRoute(route, "convert").eligible);
    return routesCoveredByCustody(eligible);
  }

  async function preflightWithdrawal(
    auth: FinancialAuthority,
    providerCode: string,
    amount: string,
    address: string,
  ): Promise<FinancialWithdrawalQuote> {
    if (!input.nowPaymentsPayout || !input.nowPaymentsCustody) {
      throw new Error("financial.crypto.withdrawal_unavailable");
    }

    const numericAmount = Number(amount);
    const fractionalDigits = amount.includes(".") ? amount.length - amount.indexOf(".") - 1 : 0;
    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      fractionalDigits > 6 ||
      normalizeCryptoAmount(numberToPlainDecimal(numericAmount)) !== amount
    ) {
      throw new Error("financial.crypto.amount_unavailable");
    }

    if (
      !input.withdrawalDestinationApproved ||
      !(await input.withdrawalDestinationApproved({
        tenantId: auth.tenantId,
        userId: auth.userId,
        providerCode,
        destinationAddress: address,
      }))
    ) {
      throw new Error("financial.crypto.withdrawal_destination_unapproved");
    }
    const routes = await qualifiedWithdrawalRoutes();
    const route = routes?.find((candidate) => candidate.providerCode === providerCode);
    if (!route) throw new Error("financial.crypto.withdrawal_unavailable");

    const signal = AbortSignal.timeout(15_000);
    const [, validated, fee, minimum, balances] = await Promise.all([
      input.nowPaymentsPayout.authenticate(signal),
      input.nowPaymentsPayout.validateAddress({ currency: providerCode, address, signal }),
      input.nowPaymentsPayout.getPayoutFeeEstimate({ currency: providerCode, amount, signal }),
      input.nowPaymentsPayout.getMinimumPayoutAmount({ currency: providerCode, signal }),
      input.nowPaymentsCustody.readBalances(signal),
    ]);
    const minimumAmount = normalizeCryptoAmount(minimum.minimumAmount);
    if (!amountAtLeast(amount, minimumAmount)) {
      throw new Error("financial.crypto.withdrawal_below_minimum");
    }
    if (withdrawalNetworkFeeMode === null) {
      throw new Error("financial.crypto.withdrawal_fee_mode_unavailable");
    }
    const providerBalance = balances.find((entry) => entry.currency === providerCode);
    const amountUnits = decimalUnits(amount);
    const feeUnits = decimalUnits(fee.fee, true);
    const requiredProviderUnits =
      withdrawalNetworkFeeMode === "sender"
        ? amountUnits + feeUnits
        : amountUnits;
    if (
      providerBalance === undefined ||
      decimalUnits(providerBalance.available, true) < requiredProviderUnits
    ) {
      throw new Error("financial.crypto.provider_balance_unavailable");
    }
    const receiveUnits =
      withdrawalNetworkFeeMode === "receiver"
        ? amountUnits - feeUnits
        : amountUnits;
    if (receiveUnits <= 0n) {
      throw new Error("financial.crypto.withdrawal_fee_exceeds_amount");
    }
    return Object.freeze({
      providerCode,
      amount,
      destinationAddress: validated.address,
      minimumAmount,
      networkFee: fee.fee,
      networkFeeMode: withdrawalNetworkFeeMode,
      feePayer: withdrawalNetworkFeeMode === "receiver" ? "user" : "platform",
      estimatedReceiveAmount: decimalFromUnits(receiveUnits),
      addressValidated: true as const,
      quotedAt: now(),
    });
  }

  async function preflightConversion(
    providerCode: string,
    targetProviderCode: string,
    amount: string,
  ): Promise<FinancialConversionQuote> {
    if (!input.nowPaymentsCustody) throw new Error("financial.crypto.conversion_unavailable");
    if (providerCode === targetProviderCode) throw new Error("financial.crypto.conversion_same_asset");

    const numericAmount = Number(amount);
    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      normalizeCryptoAmount(numberToPlainDecimal(numericAmount)) !== amount
    ) {
      throw new Error("financial.crypto.amount_unavailable");
    }

    const routes = await qualifiedConversionRoutes();
    if (
      !routes?.some((route) => route.providerCode === providerCode) ||
      !routes.some((route) => route.providerCode === targetProviderCode)
    ) {
      throw new Error("financial.crypto.conversion_unavailable");
    }

    const signal = AbortSignal.timeout(15_000);
    const [, quote, balances] = await Promise.all([
      input.nowPaymentsCustody.authenticate(signal),
      input.nowPayments.quotePayment({
        amount: numericAmount,
        currencyFrom: providerCode,
        currencyTo: targetProviderCode,
        signal,
      }),
      input.nowPaymentsCustody.readBalances(signal),
    ]);
    const providerBalance = balances.find((entry) => entry.currency === providerCode);
    if (
      providerBalance === undefined ||
      decimalUnits(providerBalance.available, true) < decimalUnits(amount)
    ) {
      throw new Error("financial.crypto.provider_balance_unavailable");
    }
    return Object.freeze({
      providerCode,
      targetProviderCode,
      amount,
      minimumAmount: normalizeCryptoAmount(numberToPlainDecimal(quote.minimum.minimumAmount)),
      estimatedTargetAmount: normalizeCryptoAmount(numberToPlainDecimal(quote.estimate.estimatedAmount)),
      quotedAt: now(),
    });
  }

  async function settleReconciledConversion(
    auth: FinancialAuthority,
    intent: CryptoIntent,
  ): Promise<CryptoIntent> {
    if (
      !input.nowPaymentsCustody ||
      intent.operation !== "convert" ||
      intent.targetAsset === null ||
      (intent.providerConversionId ?? null) === null
    ) {
      throw new Error("financial.crypto.conversion_unavailable");
    }
    const evidence = await input.nowPaymentsCustody.getConversionEvidence({
      conversionId: intent.providerConversionId!,
      fromCurrency: intent.asset,
      toCurrency: intent.targetAsset,
      fromAmount: intent.amount,
      signal: AbortSignal.timeout(15_000),
    });
    if (!conversionSucceeded(evidence.status) && !conversionFailed(evidence.status)) return intent;
    return input.crypto.settleConversion({
      tenantId: auth.tenantId,
      userId: auth.userId,
      requestId: intent.requestId,
      succeeded: conversionSucceeded(evidence.status),
      targetAmount: conversionSucceeded(evidence.status) ? evidence.toAmount : null,
      providerReference: evidence.conversionId,
      updatedAt: now(),
    });
  }

  function assertStoredPayoutBinding(
    intent: CryptoIntent,
    evidence: {
      readonly batchId: string;
      readonly currency: string;
      readonly amount: string;
      readonly address: string;
      readonly uniqueExternalId: string | null;
    },
  ): void {
    if (
      intent.operation !== "withdraw" ||
      intent.providerPayoutId === null ||
      intent.destinationAddress === null
    ) {
      throw new Error("financial.crypto.payout_evidence_mismatch");
    }
    assertPayoutEvidence({
      batchId: evidence.batchId,
      currency: evidence.currency,
      amount: evidence.amount,
      address: evidence.address,
      uniqueExternalId: evidence.uniqueExternalId,
    }, {
      batchId: intent.providerPayoutId,
      currency: intent.asset,
      amount: intent.amount,
      address: intent.destinationAddress,
      uniqueExternalId: providerOrderId(intent.tenantId, intent.requestId),
    });
  }

  async function settleReconciledPayout(
    auth: FinancialAuthority,
    intent: CryptoIntent,
  ): Promise<CryptoIntent> {
    if (!input.nowPaymentsPayout || intent.providerPayoutId === null) {
      throw new Error("financial.crypto.withdrawal_unavailable");
    }
    const evidence = await input.nowPaymentsPayout.getPayoutEvidence({
      payoutId: intent.providerPayoutId,
      signal: AbortSignal.timeout(15_000),
    });
    assertStoredPayoutBinding(intent, evidence);
    if (!payoutSucceeded(evidence.status) && !payoutFailed(evidence.status)) return intent;
    return input.crypto.settleWithdrawal({
      tenantId: auth.tenantId,
      userId: auth.userId,
      requestId: intent.requestId,
      succeeded: payoutSucceeded(evidence.status),
      providerReference: evidence.withdrawalId,
      updatedAt: now(),
    });
  }

  return Object.freeze<FinancialService>({
    async capabilities(request) {
      await authority(request.authorizationHeader);
      let deposits = false;
      let withdrawals = false;
      let conversions = false;
      let qualifiedOnRamp: Awaited<ReturnType<typeof qualifiedFiatOnRamp>> = null;
      try {
        deposits = (await qualifiedDepositRoutes()).length > 0;
      } catch { /* Unknown custody evidence denies admission. */ }
      try {
        qualifiedOnRamp = await qualifiedFiatOnRamp();
      } catch { /* Unknown on-ramp/custody evidence denies admission. */ }
      try {
        const routes = await qualifiedWithdrawalRoutes();
        withdrawals = routes !== null && routes.length > 0;
      } catch { /* Unknown/stale evidence denies admission. */ }
      try {
        const routes = await qualifiedConversionRoutes();
        conversions = routes !== null && routes.length > 1;
      } catch { /* Unknown/stale evidence denies admission. */ }
      return Object.freeze({
        deposits,
        withdrawals,
        conversions,
        fiatOnRamp: qualifiedOnRamp !== null,
        fiatCurrencies:
          qualifiedOnRamp === null ? Object.freeze([]) : qualifiedOnRamp.fiatCurrencies,
        fiatSettlementProviderCode:
          qualifiedOnRamp?.settlement.providerCode ?? null,
        payoutReason:
          !withdrawals
            ? "nowpayments_payout_credentials_or_account_capability_unavailable"
            : null,
        conversionReason:
          !conversions
            ? "nowpayments_conversion_account_or_route_capability_unavailable"
            : null,
        fiatOnRampReason:
          qualifiedOnRamp === null
            ? "nowpayments_fiat_onramp_not_activated_or_settlement_unavailable"
            : null,
      });
    },

    async listDepositRoutes(request) {
      await authority(request.authorizationHeader);
      return qualifiedDepositRoutes();
    },

    async listConversionRoutes(request) {
      await authority(request.authorizationHeader);
      return Object.freeze((await qualifiedConversionRoutes()) ?? []);
    },

    async listWithdrawalRoutes(request) {
      await authority(request.authorizationHeader);
      return Object.freeze((await qualifiedWithdrawalRoutes()) ?? []);
    },

    async createDeposit(request) {
      const auth = await authority(request.authorizationHeader);
      const requestId = parseCanonicalId("request", request.requestId);
      const providerCode = normalizeCryptoAsset(request.providerCode);
      const amount = normalizeCryptoAmount(request.amount);

      const existing = await input.crypto.readIntent({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
      });
      const terms: FinancialReplayTerms = {
        operation: "deposit", asset: providerCode,
        network: splitProviderCurrency(providerCode).network,
        amount, destinationAddress: null,
      };
      if (existing) {
        assertFinancialReplay(existing, terms);
        return depositView(existing);
      }

      const route = await currentDepositRoute(providerCode);
      if (!route) throw new Error("financial.crypto.route_unavailable");

      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0 || normalizeCryptoAmount(numberToPlainDecimal(numericAmount)) !== amount) {
        throw new Error("financial.crypto.amount_unavailable");
      }

      const minimum = await input.nowPayments.getMinimumAmount({
        currencyFrom: providerCode,
        currencyTo: providerCode,
      });
      assertAboveMinimum(numericAmount, minimum);

      const createdAt = now();
      const admitted = await input.crypto.createIntent({
        schemaVersion: 1,
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        operation: "deposit",
        asset: providerCode,
        network: splitProviderCurrency(providerCode).network,
        amount,
        targetAsset: null,
        destinationAddress: null,
        provider: "nowpayments",
        providerPaymentId: null,
        providerPayoutId: null,
        payAddress: null,
        providerPayAmount: null,
        providerDispatchStartedAt: null,
        status: "quoted",
        createdAt,
        updatedAt: createdAt,
      });

      assertFinancialReplay(admitted, terms);
      const dispatch = await input.crypto.beginProviderDispatch({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        updatedAt: now(),
      });
      assertFinancialReplay(dispatch.intent, terms);
      if (!dispatch.shouldDispatch) return depositView(dispatch.intent);

      const payment = await input.nowPayments.submitPayment({
        priceAmount: numericAmount,
        priceCurrency: providerCode,
        payCurrency: providerCode,
        ipnCallbackUrl,
        orderId: providerOrderId(auth.tenantId, requestId),
        orderDescription: "Masanawa crypto deposit",
        signal: AbortSignal.timeout(15_000),
      });

      const bound = await input.crypto.bindProviderPayment({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        providerPaymentId: payment.paymentId,
        payAddress: payment.payAddress,
        providerPayAmount: payment.payAmountExact,
        updatedAt: now(),
      });
      return depositView(bound);
    },

    async createFiatPurchase(request) {
      const auth = await authority(request.authorizationHeader);
      const requestId = parseCanonicalId("request", request.requestId);
      const fiatAmount = normalizeFiatAmount(request.fiatAmount);
      const fiatCurrency = normalizeCryptoAsset(request.fiatCurrency);
      const qualification = await qualifiedFiatOnRamp();
      if (
        qualification === null ||
        !qualification.fiatCurrencies.includes(fiatCurrency)
      ) {
        throw new Error("financial.crypto.fiat_onramp_unavailable");
      }
      const settlementProviderCode = qualification.settlement.providerCode;
      const settlement = splitProviderCurrency(settlementProviderCode);

      const existing = await input.crypto.readIntent({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
      });
      const terms: FinancialReplayTerms = {
        operation: "buy",
        asset: fiatCurrency,
        network: null,
        amount: fiatAmount,
        destinationAddress: null,
        targetAsset: settlementProviderCode,
        targetNetwork: settlement.network,
      };
      if (existing) {
        assertFinancialReplay(existing, terms);
        return fiatPurchaseView(existing);
      }

      const createdAt = now();
      const admitted = await input.crypto.createIntent({
        schemaVersion: 1,
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        operation: "buy",
        asset: fiatCurrency,
        network: null,
        amount: fiatAmount,
        targetAsset: settlementProviderCode,
        targetNetwork: settlement.network,
        destinationAddress: null,
        provider: "nowpayments",
        providerPaymentId: null,
        providerPayoutId: null,
        providerInvoiceId: null,
        checkoutUrl: null,
        providerConversionId: null,
        providerTargetAmount: null,
        payAddress: null,
        providerPayAmount: null,
        providerDispatchStartedAt: null,
        status: "quoted",
        createdAt,
        updatedAt: createdAt,
      });
      assertFinancialReplay(admitted, terms);

      const dispatch = await input.crypto.beginProviderDispatch({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        updatedAt: now(),
      });
      assertFinancialReplay(dispatch.intent, terms);
      if (!dispatch.shouldDispatch) return fiatPurchaseView(dispatch.intent);

      let invoice;
      try {
        invoice = await input.nowPayments.createInvoice({
          priceAmount: fiatAmount,
          priceCurrency: fiatCurrency,
          payCurrency: fiatCurrency,
          payoutCurrency: settlementProviderCode,
          ipnCallbackUrl,
          orderId: providerOrderId(auth.tenantId, requestId),
          orderDescription: "Masanawa crypto purchase",
          signal: AbortSignal.timeout(15_000),
        });
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        if (
          code === "nowpayments.invoice.dispatch_rejected" ||
          code === "nowpayments.credential.unavailable"
        ) {
          return fiatPurchaseView(await input.crypto.failProviderDispatch({
            tenantId: auth.tenantId,
            userId: auth.userId,
            requestId,
            operation: "buy",
            updatedAt: now(),
          }));
        }
        throw error;
      }

      return fiatPurchaseView(await input.crypto.bindProviderInvoice({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        providerInvoiceId: invoice.invoiceId,
        checkoutUrl: invoice.checkoutUrl,
        updatedAt: now(),
      }));
    },

    async refreshFiatPurchase(request) {
      const auth = await authority(request.authorizationHeader);
      const requestId = parseCanonicalId("request", request.requestId);
      const intent = await input.crypto.readIntent({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
      });
      if (!intent || intent.operation !== "buy" || intent.targetAsset === null) {
        throw new Error("financial.crypto.fiat_onramp_unavailable");
      }
      if (
        ["succeeded", "failed", "refunded", "expired", "manual_review"].includes(
          intent.status,
        )
      ) {
        return fiatPurchaseView(intent);
      }
      if ((intent.providerInvoiceId ?? null) === null) {
        throw new Error("financial.crypto.fiat_onramp_unavailable");
      }

      const signal = AbortSignal.timeout(15_000);
      const payload =
        intent.providerPaymentId === null
          ? await input.nowPaymentsCustody?.findPaymentEvidence({
              orderId: providerOrderId(intent.tenantId, intent.requestId),
              invoiceId: intent.providerInvoiceId!,
              signal,
            }) ?? null
          : await input.nowPayments.getPaymentEvidence({
              paymentId: intent.providerPaymentId,
              signal,
            });
      if (payload === null) return fiatPurchaseView(intent);

      const evidence = admitFiatOnRampEvidence(payload, {
        invoiceId: intent.providerInvoiceId!,
        orderId: providerOrderId(intent.tenantId, intent.requestId),
        fiatAmount: intent.amount,
        fiatCurrency: intent.asset,
        settlementAsset: intent.targetAsset,
      });
      assertFiatOnRampFinishedFunded(evidence);
      if (
        intent.providerPaymentId !== null &&
        evidence.paymentId !== intent.providerPaymentId
      ) {
        throw new Error("financial.crypto.onramp_evidence_mismatch");
      }
      return fiatPurchaseView(await input.crypto.applyProviderPaymentEvent({
        tenantId: intent.tenantId,
        userId: intent.userId,
        event: {
          paymentId: evidence.paymentId,
          invoiceId: evidence.invoiceId,
          parentPaymentId: evidence.parentPaymentId,
          orderId: intent.requestId,
          status: evidence.status,
          priceAmount: evidence.priceAmount,
          priceCurrency: evidence.priceCurrency,
          payAmount: evidence.payAmount,
          payCurrency: evidence.payCurrency,
          actuallyPaid: evidence.actuallyPaid,
          outcomeAmount: evidence.outcomeAmount,
          outcomeCurrency: evidence.outcomeCurrency,
          payloadHash: evidence.payloadHash,
          observedAt: now(),
        },
      }));
    },

    async quoteWithdrawal(request) {
      const auth = await authority(request.authorizationHeader);
      const providerCode = normalizeCryptoAsset(request.providerCode);
      const amount = normalizeCryptoAmount(request.amount);
      const address = request.destinationAddress.trim();
      if (!address || address.length > 512) throw new Error("financial.crypto.destination_invalid");
      return preflightWithdrawal(auth, providerCode, amount, address);
    },

    async createWithdrawal(request) {
      const auth = await authority(request.authorizationHeader);
      if (!input.nowPaymentsPayout) throw new Error("financial.crypto.withdrawal_unavailable");

      const requestId = parseCanonicalId("request", request.requestId);
      const providerCode = normalizeCryptoAsset(request.providerCode);
      const amount = normalizeCryptoAmount(request.amount);
      const address = request.destinationAddress.trim();
      if (!address || address.length > 512) throw new Error("financial.crypto.destination_invalid");

      const existing = await input.crypto.readIntent({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
      });
      const terms: FinancialReplayTerms = {
        operation: "withdraw", asset: providerCode,
        network: splitProviderCurrency(providerCode).network,
        amount, destinationAddress: address,
      };
      if (existing) {
        assertFinancialReplay(existing, terms);
        return withdrawalView(existing);
      }

      const quote = await preflightWithdrawal(auth, providerCode, amount, address);
      const createdAt = now();
      const withdrawalIntent: CryptoIntent = {
        schemaVersion: 1,
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        operation: "withdraw",
        asset: providerCode,
        network: splitProviderCurrency(providerCode).network,
        amount,
        targetAsset: null,
        destinationAddress: address,
        provider: "nowpayments",
        providerPaymentId: null,
        providerPayoutId: null,
        payAddress: null,
        providerPayAmount: null,
        providerDispatchStartedAt: null,
        status: "processing",
        createdAt,
        updatedAt: createdAt,
      };
      const admitted =
        quote.networkFee !== "0" && quote.networkFeeMode === "sender"
          ? await input.crypto.reserveWithdrawalWithFee({
              intent: withdrawalIntent,
              networkFee: quote.networkFee,
              feePayer: "platform",
            })
          : await input.crypto.reserveWithdrawal(withdrawalIntent);

      assertFinancialReplay(admitted, terms);
      const dispatch = await input.crypto.beginProviderDispatch({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        updatedAt: now(),
      });
      assertFinancialReplay(dispatch.intent, terms);
      if (!dispatch.shouldDispatch) return withdrawalView(dispatch.intent);

      let payout;
      try {
        payout = await input.nowPaymentsPayout.createPayout({
          amount,
          currency: providerCode,
          address,
          ipnCallbackUrl: payoutIpnCallbackUrl,
          uniqueExternalId: providerOrderId(auth.tenantId, requestId),
          signal: AbortSignal.timeout(15_000),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (
          message === "nowpayments.payout.authentication_unavailable" ||
          message === "nowpayments.payout.dispatch_rejected"
        ) {
          return withdrawalView(await input.crypto.settleWithdrawal({
            tenantId: auth.tenantId,
            userId: auth.userId,
            requestId,
            succeeded: false,
            providerReference: null,
            updatedAt: now(),
          }));
        }
        throw error;
      }
      const bound = await input.crypto.bindProviderPayout({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        providerPayoutId: payout.payoutId,
        updatedAt: now(),
      });

      let status = payout.status;
      if (
        !payoutSucceeded(status) &&
        !payoutFailed(status) &&
        input.payoutVerificationCodeProvider
      ) {
        const verificationCode = await input.payoutVerificationCodeProvider({
          batchId: payout.payoutId,
          tenantId: auth.tenantId,
          userId: auth.userId,
          requestId,
        });
        if (verificationCode !== null) {
          const verified = await input.nowPaymentsPayout.verifyPayout({
            payoutId: payout.payoutId,
            verificationCode,
            signal: AbortSignal.timeout(15_000),
          });
          status = verified.status;
        }
      }
      if (payoutSucceeded(status) || payoutFailed(status)) {
        return withdrawalView(await settleReconciledPayout(auth, bound));
      }
      return withdrawalView(bound);
    },

    async quoteConversion(request) {
      const auth = await authority(request.authorizationHeader);
      const providerCode = normalizeCryptoAsset(request.providerCode);
      const targetProviderCode = normalizeCryptoAsset(request.targetProviderCode);
      const amount = normalizeCryptoAmount(request.amount);
      return preflightConversion(providerCode, targetProviderCode, amount);
    },

    async createConversion(request) {
      const auth = await authority(request.authorizationHeader);
      if (!input.nowPaymentsCustody) throw new Error("financial.crypto.conversion_unavailable");

      const requestId = parseCanonicalId("request", request.requestId);
      const providerCode = normalizeCryptoAsset(request.providerCode);
      const targetProviderCode = normalizeCryptoAsset(request.targetProviderCode);
      const amount = normalizeCryptoAmount(request.amount);
      const target = splitProviderCurrency(targetProviderCode);

      const existing = await input.crypto.readIntent({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
      });
      const terms: FinancialReplayTerms = {
        operation: "convert",
        asset: providerCode,
        network: splitProviderCurrency(providerCode).network,
        amount,
        destinationAddress: null,
        targetAsset: targetProviderCode,
        targetNetwork: target.network,
      };
      if (existing) {
        assertFinancialReplay(existing, terms);
        return conversionView(existing);
      }

      await preflightConversion(providerCode, targetProviderCode, amount);
      const createdAt = now();
      const admitted = await input.crypto.reserveConversion({
        schemaVersion: 1,
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        operation: "convert",
        asset: providerCode,
        network: splitProviderCurrency(providerCode).network,
        amount,
        targetAsset: targetProviderCode,
        targetNetwork: target.network,
        destinationAddress: null,
        provider: "nowpayments",
        providerPaymentId: null,
        providerPayoutId: null,
        providerConversionId: null,
        providerTargetAmount: null,
        payAddress: null,
        providerPayAmount: null,
        providerDispatchStartedAt: null,
        status: "processing",
        createdAt,
        updatedAt: createdAt,
      });
      assertFinancialReplay(admitted, terms);

      const dispatch = await input.crypto.beginProviderDispatch({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        updatedAt: now(),
      });
      assertFinancialReplay(dispatch.intent, terms);
      if (!dispatch.shouldDispatch) return conversionView(dispatch.intent);

      let conversion;
      try {
        conversion = await input.nowPaymentsCustody.createConversion({
          fromCurrency: providerCode,
          toCurrency: targetProviderCode,
          amount,
          signal: AbortSignal.timeout(15_000),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (
          message === "nowpayments.conversion.authentication_unavailable" ||
          message === "nowpayments.conversion.dispatch_rejected"
        ) {
          return conversionView(await input.crypto.settleConversion({
            tenantId: auth.tenantId,
            userId: auth.userId,
            requestId,
            succeeded: false,
            targetAmount: null,
            providerReference: null,
            updatedAt: now(),
          }));
        }
        throw error;
      }
      const bound = await input.crypto.bindProviderConversion({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
        providerConversionId: conversion.conversionId,
        updatedAt: now(),
      });
      if (conversionSucceeded(conversion.status) || conversionFailed(conversion.status)) {
        return conversionView(await settleReconciledConversion(auth, bound));
      }
      return conversionView(bound);
    },

    async refreshConversion(request) {
      const auth = await authority(request.authorizationHeader);
      const requestId = parseCanonicalId("request", request.requestId);
      const intent = await input.crypto.readIntent({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
      });
      if (
        !intent ||
        intent.operation !== "convert" ||
        (intent.providerConversionId ?? null) === null
      ) {
        throw new Error("financial.crypto.conversion_unavailable");
      }
      if (intent.status === "succeeded" || intent.status === "failed") {
        return conversionView(intent);
      }
      return conversionView(await settleReconciledConversion(auth, intent));
    },

    async verifyWithdrawal(request) {
      await authority(request.authorizationHeader);
      parseCanonicalId("request", request.requestId);
      void request.verificationCode;
      throw new Error("financial.crypto.withdrawal_verification_server_only");
    },

    async refreshWithdrawal(request) {
      const auth = await authority(request.authorizationHeader);
      if (!input.nowPaymentsPayout) throw new Error("financial.crypto.withdrawal_unavailable");
      const requestId = parseCanonicalId("request", request.requestId);
      const intent = await input.crypto.readIntent({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId,
      });
      if (!intent || intent.operation !== "withdraw" || intent.providerPayoutId === null) {
        throw new Error("financial.crypto.withdrawal_unavailable");
      }
      if (intent.status === "succeeded" || intent.status === "failed") return withdrawalView(intent);
      return withdrawalView(await settleReconciledPayout(auth, intent));
    },

    async readBalance(request) {
      const auth = await authority(request.authorizationHeader);
      const providerCode = normalizeCryptoAsset(request.providerCode);
      return Object.freeze({
        providerCode,
        amount: await input.crypto.readBalance({
          tenantId: auth.tenantId,
          userId: auth.userId,
          asset: providerCode,
          network: splitProviderCurrency(providerCode).network,
        }),
      });
    },

    async listHistory(request) {
      const auth = await authority(request.authorizationHeader);
      return input.crypto.listIntents({
        tenantId: auth.tenantId,
        userId: auth.userId,
        ...(request.limit === undefined ? {} : { limit: request.limit }),
      });
    },

    async readIntent(request) {
      const auth = await authority(request.authorizationHeader);
      const intent = await input.crypto.readIntent({
        tenantId: auth.tenantId,
        userId: auth.userId,
        requestId: parseCanonicalId("request", request.requestId),
      });
      if (
        !intent ||
        intent.providerPaymentId === null ||
        ["succeeded", "failed", "refunded", "expired", "manual_review"].includes(
          intent.status,
        )
      ) {
        return intent;
      }
      const payload = await input.nowPayments.getPaymentEvidence({
        paymentId: intent.providerPaymentId,
        signal: AbortSignal.timeout(15_000),
      });

      if (intent.operation === "buy") {
        if (
          (intent.providerInvoiceId ?? null) === null ||
          intent.targetAsset === null
        ) {
          throw new Error("financial.crypto.fiat_onramp_unavailable");
        }
        const evidence = admitFiatOnRampEvidence(payload, {
          invoiceId: intent.providerInvoiceId!,
          orderId: providerOrderId(auth.tenantId, intent.requestId),
          fiatAmount: intent.amount,
          fiatCurrency: intent.asset,
          settlementAsset: intent.targetAsset,
        });
        assertFiatOnRampFinishedFunded(evidence);
        return input.crypto.applyProviderPaymentEvent({
          tenantId: auth.tenantId,
          userId: auth.userId,
          event: {
            paymentId: evidence.paymentId,
            invoiceId: evidence.invoiceId,
            parentPaymentId: evidence.parentPaymentId,
            orderId: intent.requestId,
            status: evidence.status,
            priceAmount: evidence.priceAmount,
            priceCurrency: evidence.priceCurrency,
            payAmount: evidence.payAmount,
            payCurrency: evidence.payCurrency,
            actuallyPaid: evidence.actuallyPaid,
            outcomeAmount: evidence.outcomeAmount,
            outcomeCurrency: evidence.outcomeCurrency,
            payloadHash: evidence.payloadHash,
            observedAt: now(),
          },
        });
      }

      if (intent.operation !== "deposit") return intent;
      const evidence = admitPaymentEvidence(payload, {
        paymentId: intent.providerPaymentId,
        orderId: providerOrderId(auth.tenantId, intent.requestId),
        asset: intent.asset,
        amount: intent.amount,
        payAmount: intent.providerPayAmount,
      });
      return input.crypto.applyProviderPaymentEvent({
        tenantId: auth.tenantId,
        userId: auth.userId,
        event: { ...evidence, orderId: intent.requestId, observedAt: now() },
      });
    },

    async handleNowPaymentsPayoutIpn(request) {
      const evidence = parseVerifiedPayoutIpn({
        payload: request.payload,
        signature: request.signature,
        secret: ipnSecret,
      });
      const intent = await input.crypto.readIntentByProviderPayoutId({
        providerPayoutId: evidence.batchId,
      });
      if (
        !intent ||
        intent.operation !== "withdraw" ||
        intent.providerPayoutId === null ||
        intent.destinationAddress === null
      ) {
        throw new Error("financial.crypto.withdrawal_unavailable");
      }
      assertPayoutEvidence(evidence, {
        batchId: intent.providerPayoutId,
        currency: intent.asset,
        amount: intent.amount,
        address: intent.destinationAddress,
        uniqueExternalId: providerOrderId(intent.tenantId, intent.requestId),
      });

      const success = payoutSucceeded(evidence.status);
      const failure = payoutFailed(evidence.status);
      if (intent.status === "succeeded" || intent.status === "failed") {
        if (
          (intent.status === "succeeded" && !success) ||
          (intent.status === "failed" && !failure)
        ) {
          throw new Error("financial.crypto.payout_terminal_conflict");
        }
        return Object.freeze({ accepted: true as const, requestId: intent.requestId });
      }
      if (success || failure) {
        await input.crypto.settleWithdrawal({
          tenantId: intent.tenantId,
          userId: intent.userId,
          requestId: intent.requestId,
          succeeded: success,
          providerReference: evidence.withdrawalId,
          updatedAt: now(),
        });
      }
      return Object.freeze({ accepted: true as const, requestId: intent.requestId });
    },

    async handleNowPaymentsIpn(request) {
      const evidence = parseVerifiedPaymentIpn({
        payload: request.payload,
        signature: request.signature,
        secret: ipnSecret,
      });
      const identity = parseProviderOrderId(evidence.orderId);
      const intent = await input.crypto.readIntentByRequestId(identity);
      if (!intent) throw new Error("financial.ipn.intent_unavailable");

      if (intent.operation === "buy") {
        if (
          (intent.providerInvoiceId ?? null) === null ||
          intent.targetAsset === null
        ) {
          throw new Error("financial.ipn.intent_unavailable");
        }
        const admitted = admitFiatOnRampEvidence(request.payload, {
          invoiceId: intent.providerInvoiceId!,
          orderId: providerOrderId(intent.tenantId, intent.requestId),
          fiatAmount: intent.amount,
          fiatCurrency: intent.asset,
          settlementAsset: intent.targetAsset,
        });
        assertFiatOnRampFinishedFunded(admitted);
        const event: CryptoProviderPaymentEvent = {
          paymentId: admitted.paymentId,
          invoiceId: admitted.invoiceId,
          parentPaymentId: admitted.parentPaymentId,
          orderId: identity.requestId,
          status: admitted.status,
          priceAmount: admitted.priceAmount,
          priceCurrency: admitted.priceCurrency,
          payAmount: admitted.payAmount,
          payCurrency: admitted.payCurrency,
          actuallyPaid: admitted.actuallyPaid,
          outcomeAmount: admitted.outcomeAmount,
          outcomeCurrency: admitted.outcomeCurrency,
          payloadHash: admitted.payloadHash,
          observedAt: now(),
        };
        await input.crypto.applyProviderPaymentEvent({
          tenantId: intent.tenantId,
          userId: intent.userId,
          event,
        });
      } else {
        if (intent.operation !== "deposit" || intent.providerPaymentId === null) {
          throw new Error("financial.ipn.intent_unavailable");
        }
        const admitted = admitPaymentEvidence(request.payload, {
          paymentId: intent.providerPaymentId,
          orderId: providerOrderId(intent.tenantId, intent.requestId),
          asset: intent.asset,
          amount: intent.amount,
          payAmount: intent.providerPayAmount,
        });
        const event: CryptoProviderPaymentEvent = {
          paymentId: evidence.paymentId,
          parentPaymentId: evidence.parentPaymentId,
          orderId: identity.requestId,
          status: evidence.status,
          priceAmount: admitted.priceAmount,
          priceCurrency: evidence.priceCurrency,
          payAmount: admitted.payAmount,
          payCurrency: evidence.payCurrency,
          actuallyPaid: admitted.actuallyPaid,
          payloadHash: evidence.payloadHash,
          observedAt: now(),
        };
        await input.crypto.applyProviderPaymentEvent({
          tenantId: intent.tenantId,
          userId: intent.userId,
          event,
        });
      }
      return Object.freeze({ accepted: true as const, requestId: intent.requestId });
    },
  });
}

