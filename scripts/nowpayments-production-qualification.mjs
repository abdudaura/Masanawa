#!/usr/bin/env node

const DEFAULT_BASE_URL = "https://api.nowpayments.io/v1";

function fail(message, exitCode = 1) {
  const error = new Error(message);
  error.exitCode = exitCode;
  throw error;
}

function envText(env, name) {
  return typeof env[name] === "string" ? env[name].trim() : "";
}

function enabled(env, name) {
  return /^(?:1|true|yes|on)$/iu.test(envText(env, name));
}

function normalizeBaseUrl(value) {
  const candidate = value || DEFAULT_BASE_URL;
  const url = new URL(candidate);
  if (url.protocol !== "https:") fail("NOWPayments base URL must use HTTPS");
  return url.toString().replace(/\/+$/u, "");
}

export function resolveNowPaymentsQualificationConfig(env = process.env) {
  const apiKey = envText(env, "NOWPAYMENTS_API_KEY");
  if (!apiKey) fail("NOWPAYMENTS_API_KEY is required");

  const custodyEnabled =
    enabled(env, "NOWPAYMENTS_CUSTODY_ENABLED") ||
    enabled(env, "NOWPAYMENTS_PAYOUT_ENABLED") ||
    enabled(env, "NOWPAYMENTS_PAYOUTS_ENABLED");

  const email = envText(env, "NOWPAYMENTS_PAYOUT_EMAIL");
  const password = envText(env, "NOWPAYMENTS_PAYOUT_PASSWORD");
  if (custodyEnabled && (!email || !password)) {
    fail("NOWPayments custody/payout qualification requires payout email and password", 2);
  }

  const relayUrl = envText(env, "NOWPAYMENTS_RELAY_URL");
  const baseUrl = normalizeBaseUrl(relayUrl || envText(env, "NOWPAYMENTS_BASE_URL"));
  const relayToken = envText(env, "MASANAWA_NOWPAYMENTS_RELAY_TOKEN");

  if (relayUrl && !relayToken) {
    fail("MASANAWA_NOWPAYMENTS_RELAY_TOKEN is required when NOWPAYMENTS_RELAY_URL is configured", 2);
  }

  return Object.freeze({
    apiKey,
    email,
    password,
    custodyEnabled,
    baseUrl,
    relayToken,
  });
}

function headers(config, token) {
  return {
    "x-api-key": config.apiKey,
    accept: "application/json",
    ...(config.relayToken ? { "x-masanawa-relay-token": config.relayToken } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function requestJson(config, path, init = {}, fetchImpl = globalThis.fetch) {
  const response = await fetchImpl(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      ...headers(config, init.token),
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      fail(`NOWPayments credential rejected at ${path}`, 2);
    }
    fail(`NOWPayments provider returned HTTP ${response.status} at ${path}`, 2);
  }
  return response.json();
}

function normalizeCurrencies(body) {
  const raw = Array.isArray(body?.currencies) ? body.currencies : null;
  if (!raw || !raw.every((value) => typeof value === "string" && value.trim())) {
    fail("NOWPayments currencies response has invalid shape", 2);
  }
  return [...new Set(raw.map((value) => value.trim().toUpperCase()))].sort();
}

export function evaluateNowPaymentsCurrencyEvidence(currencies) {
  const all = [...new Set(currencies.map((value) => String(value).trim().toUpperCase()).filter(Boolean))];
  const erc20 = all.filter((code) => code.endsWith("ERC20"));
  const nonErc20 = all.filter((code) => !code.endsWith("ERC20"));
  return Object.freeze({
    currencyCount: all.length,
    providerErc20Count: erc20.length,
    nonErc20Count: nonErc20.length,
    hasNonErc20RouteCandidates: nonErc20.length > 0,
  });
}

export async function collectNowPaymentsQualification(
  env = process.env,
  fetchImpl = globalThis.fetch,
) {
  const config = resolveNowPaymentsQualificationConfig(env);

  const status = await requestJson(config, "/status", {}, fetchImpl);
  const currenciesBody = await requestJson(config, "/currencies", {}, fetchImpl);
  const currencies = normalizeCurrencies(currenciesBody);
  const currencyEvidence = evaluateNowPaymentsCurrencyEvidence(currencies);

  if (!currencyEvidence.hasNonErc20RouteCandidates) {
    fail("NOWPayments exposes no non-ERC20 route candidates", 2);
  }

  let custody = Object.freeze({
    required: config.custodyEnabled,
    authenticated: false,
    balanceReadable: false,
    balanceCurrencyCount: 0,
  });

  if (config.custodyEnabled) {
    const auth = await requestJson(
      config,
      "/auth",
      {
        method: "POST",
        body: JSON.stringify({ email: config.email, password: config.password }),
      },
      fetchImpl,
    );
    const token =
      typeof auth?.token === "string" ? auth.token.trim() :
      typeof auth?.jwt === "string" ? auth.jwt.trim() : "";
    if (!token) fail("NOWPayments auth response did not include a token", 2);

    const balance = await requestJson(
      config,
      "/balance",
      { token },
      fetchImpl,
    );
    if (!balance || typeof balance !== "object" || Array.isArray(balance)) {
      fail("NOWPayments balance response has invalid shape", 2);
    }
    custody = Object.freeze({
      required: true,
      authenticated: true,
      balanceReadable: true,
      balanceCurrencyCount: Object.keys(balance).length,
    });
  }

  return Object.freeze({
    schemaVersion: 1,
    provider: "nowpayments",
    checkedAt: new Date().toISOString(),
    relayConfigured: Boolean(envText(env, "NOWPAYMENTS_RELAY_URL")),
    statusReadable: Boolean(status && typeof status === "object"),
    currencies: currencyEvidence,
    custody,
    routePolicy: Object.freeze({
      authority: "adapters/crypto/nowpayments/src/catalog.ts",
      defaultExcludedNetworks: Object.freeze(["ethereum"]),
      providerMayListErc20: currencyEvidence.providerErc20Count > 0,
    }),
  });
}

async function main() {
  const report = await collectNowPaymentsQualification();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.statusReadable || !report.currencies.hasNonErc20RouteCandidates) {
    process.exitCode = 2;
    return;
  }
  if (report.custody.required && (!report.custody.authenticated || !report.custody.balanceReadable)) {
    process.exitCode = 2;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    const code =
      error && typeof error === "object" && Number.isInteger(error.exitCode)
        ? error.exitCode
        : 1;
    process.stderr.write(
      `NOWPayments production qualification failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = code;
  });
}
