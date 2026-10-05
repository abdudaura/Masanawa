import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNowPaymentsUpstreamHeaders,
  createNowPaymentsRelayServer,
  isAllowedNowPaymentsRequest,
  relayTokenMatches,
} from "./nowpayments-fixed-egress-relay.mjs";

test("relay accepts only the dedicated exact token", () => {
  assert.equal(relayTokenMatches("relay-secret", "relay-secret"), true);
  assert.equal(relayTokenMatches("relay-secret", "other"), false);
  assert.equal(relayTokenMatches("", "relay-secret"), false);
});

test("relay path allowlist excludes arbitrary upstream access", () => {
  assert.equal(isAllowedNowPaymentsRequest("POST", "/v1/auth"), true);
  assert.equal(isAllowedNowPaymentsRequest("POST", "/v1/payout"), true);
  assert.equal(isAllowedNowPaymentsRequest("GET", "/v1/conversion/conversion-1"), true);
  assert.equal(isAllowedNowPaymentsRequest("GET", "/v1/payment/"), true);
  assert.equal(isAllowedNowPaymentsRequest("DELETE", "/v1/payout"), false);
  assert.equal(isAllowedNowPaymentsRequest("GET", "/v1/users"), false);
  assert.equal(isAllowedNowPaymentsRequest("GET", "/v1/payment/../../secret"), false);
});

test("relay forwards provider auth but never forwards its own relay token", () => {
  const headers = buildNowPaymentsUpstreamHeaders({
    "x-api-key": "provider-key",
    authorization: "Bearer provider-jwt",
    "content-type": "application/json",
    accept: "application/json",
    "x-masanawa-relay-token": "relay-secret",
    cookie: "must-not-forward",
  });
  assert.deepEqual(headers, {
    "x-api-key": "provider-key",
    authorization: "Bearer provider-jwt",
    "content-type": "application/json",
    accept: "application/json",
  });
});

async function withRelay(options, run) {
  const server = createNowPaymentsRelayServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("relay rejects unauthenticated callers without touching NOWPayments", async () => {
  let calls = 0;
  await withRelay({
    relayToken: "relay-secret",
    fetchImpl: async () => {
      calls += 1;
      throw new Error("must not run");
    },
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/balance`, {
      headers: { "x-api-key": "provider-key" },
    });
    assert.equal(response.status, 401);
  });
  assert.equal(calls, 0);
});

test("relay proxies an allowed request to the fixed NOWPayments upstream", async () => {
  let observed;
  await withRelay({
    relayToken: "relay-secret",
    fetchImpl: async (url, init) => {
      observed = {
        url: String(url),
        method: init.method,
        headers: init.headers,
      };
      return new Response(JSON.stringify({ trx: { amount: "1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/balance`, {
      headers: {
        "x-api-key": "provider-key",
        "x-masanawa-relay-token": "relay-secret",
        authorization: "Bearer provider-jwt",
      },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { trx: { amount: "1" } });
  });
  assert.equal(observed.url, "https://api.nowpayments.io/v1/balance");
  assert.equal(observed.method, "GET");
  assert.deepEqual(observed.headers, {
    "x-api-key": "provider-key",
    authorization: "Bearer provider-jwt",
    accept: "*/*",
  });
});

test("relay refuses paths outside the financial allowlist", async () => {
  let calls = 0;
  await withRelay({
    relayToken: "relay-secret",
    fetchImpl: async () => {
      calls += 1;
      return new Response("unexpected");
    },
  }, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/arbitrary-admin-path`, {
      headers: { "x-masanawa-relay-token": "relay-secret" },
    });
    assert.equal(response.status, 404);
  });
  assert.equal(calls, 0);
});
