import test from "node:test";
import assert from "node:assert/strict";
import {
  collectNowPaymentsQualification,
  evaluateNowPaymentsCurrencyEvidence,
  resolveNowPaymentsQualificationConfig,
} from "./nowpayments-production-qualification.mjs";

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
  };
}

test("qualification config requires relay token when relay URL is configured", () => {
  assert.throws(
    () =>
      resolveNowPaymentsQualificationConfig({
        NOWPAYMENTS_API_KEY: "key",
        NOWPAYMENTS_RELAY_URL: "https://relay.example/v1",
      }),
    /RELAY_TOKEN/u,
  );
});

test("qualification config requires custody credentials only when custody or payouts are enabled", () => {
  assert.doesNotThrow(() =>
    resolveNowPaymentsQualificationConfig({ NOWPAYMENTS_API_KEY: "key" }),
  );
  assert.throws(
    () =>
      resolveNowPaymentsQualificationConfig({
        NOWPAYMENTS_API_KEY: "key",
        NOWPAYMENTS_CUSTODY_ENABLED: "true",
      }),
    /email and password/u,
  );
});

test("currency evidence reports provider ERC20 listings without treating them as launch routes", () => {
  assert.deepEqual(
    evaluateNowPaymentsCurrencyEvidence(["btc", "usdttrc20", "usdterc20"]),
    {
      currencyCount: 3,
      providerErc20Count: 1,
      nonErc20Count: 2,
      hasNonErc20RouteCandidates: true,
    },
  );
});

test("read-only qualification checks status and currencies without custody calls when disabled", async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/status")) return response({ message: "OK" });
    if (url.endsWith("/currencies")) {
      return response({ currencies: ["btc", "usdttrc20", "usdterc20"] });
    }
    throw new Error("unexpected request");
  };

  const report = await collectNowPaymentsQualification(
    { NOWPAYMENTS_API_KEY: "key" },
    fetch,
  );

  assert.equal(report.statusReadable, true);
  assert.equal(report.currencies.providerErc20Count, 1);
  assert.equal(report.currencies.hasNonErc20RouteCandidates, true);
  assert.equal(report.custody.required, false);
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    "/v1/status",
    "/v1/currencies",
  ]);
});

test("custody qualification authenticates and reads balance but never creates payout or conversion", async () => {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith("/status")) return response({ message: "OK" });
    if (url.endsWith("/currencies")) return response({ currencies: ["btc", "usdttrc20"] });
    if (url.endsWith("/auth")) return response({ token: "jwt-token" });
    if (url.endsWith("/balance")) return response({ btc: { amount: "0" } });
    throw new Error("unexpected request");
  };

  const report = await collectNowPaymentsQualification(
    {
      NOWPAYMENTS_API_KEY: "key",
      NOWPAYMENTS_CUSTODY_ENABLED: "true",
      NOWPAYMENTS_PAYOUT_EMAIL: "ops@example.com",
      NOWPAYMENTS_PAYOUT_PASSWORD: "secret",
      NOWPAYMENTS_RELAY_URL: "https://relay.example/v1",
      MASANAWA_NOWPAYMENTS_RELAY_TOKEN: "relay-secret",
    },
    fetch,
  );

  assert.equal(report.custody.authenticated, true);
  assert.equal(report.custody.balanceReadable, true);
  assert.equal(report.custody.balanceCurrencyCount, 1);
  assert.deepEqual(calls.map((call) => new URL(call.url).pathname), [
    "/v1/status",
    "/v1/currencies",
    "/v1/auth",
    "/v1/balance",
  ]);
  assert.equal(
    calls.some((call) => /payout|conversion|payment|invoice/iu.test(new URL(call.url).pathname)),
    false,
  );
  assert.equal(
    calls.every((call) => call.init.headers["x-masanawa-relay-token"] === "relay-secret"),
    true,
  );
});

test("qualification fails closed on rejected provider credentials", async () => {
  const fetch = async () => response({ error: "forbidden" }, 403);
  await assert.rejects(
    () => collectNowPaymentsQualification({ NOWPAYMENTS_API_KEY: "bad" }, fetch),
    /credential rejected/u,
  );
});
