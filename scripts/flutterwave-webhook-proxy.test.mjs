import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import {
  constantTimeSecretMatch,
  createFlutterwaveWebhookHandler,
  parseWebhookBody,
  safeWebhookMetadata,
  verifyBillCallbackAgainstProvider,
  executeOperatorAirtimeTest,
  createOperatorAirtimeTestHandler,
} from "./flutterwave-webhook-proxy.mjs";

test("constantTimeSecretMatch accepts only the exact configured value", () => {
  assert.equal(constantTimeSecretMatch("secret-a", "secret-a"), true);
  assert.equal(constantTimeSecretMatch("secret-a", "secret-b"), false);
  assert.equal(constantTimeSecretMatch("", "secret-a"), false);
});

test("parseWebhookBody requires a bounded event string", () => {
  assert.equal(parseWebhookBody(Buffer.from('{"event":"singlebillpayment.status","data":{}}')).event, "singlebillpayment.status");
  assert.throws(() => parseWebhookBody(Buffer.from("not json")), /invalid_webhook_json/);
  assert.throws(() => parseWebhookBody(Buffer.from('{"data":{}}')), /invalid_webhook_event/);
});

test("safeWebhookMetadata never projects the raw body", () => {
  const raw = Buffer.from('{"event":"singlebillpayment.status","data":{"status":"success","customer_reference":"order-1","customer":"private"}}');
  const metadata = safeWebhookMetadata(JSON.parse(raw), raw);
  assert.equal(metadata.event, "singlebillpayment.status");
  assert.equal(metadata.status, "success");
  assert.equal(metadata.customerReference, "order-1");
  assert.match(metadata.fingerprint, /^sha256:[0-9a-f]{64}$/);
  assert.equal("customer" in metadata, false);
});

test("bill callbacks are re-queried using customer_reference", async () => {
  let requestedUrl = "";
  const result = await verifyBillCallbackAgainstProvider(
    {
      event: "singlebillpayment.status",
      data: {
        customer: "+2347000000000",
        amount: 200,
        customer_reference: "fulfillment-1",
      },
    },
    "provider-secret",
    async (url, init) => {
      requestedUrl = String(url);
      assert.equal(init.headers.authorization, "Bearer provider-secret");
      return new Response(JSON.stringify({
        status: "success",
        data: {
          customer_reference: "fulfillment-1",
          currency: "NGN",
          customer_id: "+2347000000000",
          amount: "200.00",
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  );
  assert.equal(result.verified, true);
  assert.match(requestedUrl, /\/v3\/bills\/fulfillment-1\?verbose=1$/);
});

test("provider evidence mismatch fails closed", async () => {
  const result = await verifyBillCallbackAgainstProvider(
    {
      event: "singlebillpayment.status",
      data: { customer: "+2347000000000", amount: 200, customer_reference: "fulfillment-1" },
    },
    "provider-secret",
    async () => new Response(JSON.stringify({
      status: "success",
      data: {
        customer_reference: "another-reference",
        currency: "NGN",
        customer_id: "+2347000000000",
        amount: "200.00",
      },
    }), { status: 200, headers: { "content-type": "application/json" } }),
  );
  assert.equal(result.verified, false);
});

async function withWebhookServer(options, run) {
  const handler = createFlutterwaveWebhookHandler(options);
  const server = createServer((request, response) => void handler(request, response));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("webhook rejects a missing or wrong verif-hash before provider work", async () => {
  let providerCalls = 0;
  await withWebhookServer({
    webhookSecret: "expected-secret",
    flutterwaveSecretKey: "provider-secret",
    fetchImpl: async () => { providerCalls += 1; throw new Error("should not run"); },
    logger: { info() {}, warn() {} },
  }, async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "verif-hash": "wrong-secret" },
      body: JSON.stringify({ event: "singlebillpayment.status", data: { customer_reference: "fulfillment-1" } }),
    });
    assert.equal(response.status, 401);
  });
  assert.equal(providerCalls, 0);
});

test("verified bill webhook acknowledges only after provider requery agrees", async () => {
  await withWebhookServer({
    webhookSecret: "expected-secret",
    flutterwaveSecretKey: "provider-secret",
    fetchImpl: async () => new Response(JSON.stringify({
      status: "success",
      data: {
        customer_reference: "fulfillment-1",
        currency: "NGN",
        customer_id: "+2347000000000",
        amount: "200.00",
      },
    }), { status: 200, headers: { "content-type": "application/json" } }),
    logger: { info() {}, warn() {} },
  }, async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "verif-hash": "expected-secret" },
      body: JSON.stringify({
        event: "singlebillpayment.status",
        data: {
          customer: "+2347000000000",
          amount: 200,
          customer_reference: "fulfillment-1",
          status: "success",
        },
      }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });
});

test("provider requery failure returns non-200 so Flutterwave can retry", async () => {
  await withWebhookServer({
    webhookSecret: "expected-secret",
    flutterwaveSecretKey: "provider-secret",
    fetchImpl: async () => new Response(JSON.stringify({ status: "error" }), { status: 404 }),
    logger: { info() {}, warn() {} },
  }, async (url) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "verif-hash": "expected-secret" },
      body: JSON.stringify({
        event: "singlebillpayment.status",
        data: { customer_reference: "fulfillment-1", status: "success" },
      }),
    });
    assert.equal(response.status, 503);
  });
});


test("operator airtime test reconciles existing reference before any dispatch", async () => {
  const calls = [];
  const result = await executeOperatorAirtimeTest({
    secretKey: "secret",
    phone: "07010102053",
    amount: "100",
    reference: "ref-existing",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), method: init?.method ?? "GET" });
      return new Response(JSON.stringify({
        status: "success",
        data: { status: "successful", customer_reference: "ref-existing", flw_ref: "FLW-1" },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.equal(result.outcome, "existing_reference");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "GET");
});

test("operator airtime test discovers Airtel and dispatches once", async () => {
  const calls = [];
  const responses = [
    new Response(JSON.stringify({ status: "error", message: "not found" }), { status: 404, headers: { "content-type": "application/json" } }),
    new Response(JSON.stringify({ status: "success", data: [{ code: "AIRTIME", name: "Airtime" }] }), { status: 200, headers: { "content-type": "application/json" } }),
    new Response(JSON.stringify({ status: "success", data: [{ biller_code: "BIL-AIRTEL", name: "Airtel Nigeria" }] }), { status: 200, headers: { "content-type": "application/json" } }),
    new Response(JSON.stringify({ status: "success", data: [{ item_code: "ITM-AIRTEL", name: "Airtel Airtime", amount: "0" }] }), { status: 200, headers: { "content-type": "application/json" } }),
    new Response(JSON.stringify({ status: "success", data: { status: "successful", customer_reference: "ref-new", flw_ref: "FLW-2", amount: 100 } }), { status: 200, headers: { "content-type": "application/json" } }),
  ];
  const result = await executeOperatorAirtimeTest({
    secretKey: "secret",
    phone: "07010102053",
    amount: "100",
    reference: "ref-new",
    callbackUrl: "https://example.test/webhooks/flutterwave",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), method: init?.method ?? "GET", body: init?.body ?? null });
      return responses.shift();
    },
  });
  assert.equal(result.outcome, "submitted");
  assert.equal(calls.filter((call) => call.method === "POST").length, 1);
  const posted = JSON.parse(calls.at(-1).body);
  assert.deepEqual(posted, {
    country: "NG",
    customer_id: "07010102053",
    amount: "100",
    reference: "ref-new",
    callback_url: "https://example.test/webhooks/flutterwave",
  });
});

test("operator handler refuses purchase when runtime egress IP changed", async () => {
  let providerCalls = 0;
  await withWebhookServer({
    webhookSecret: "unused",
    flutterwaveSecretKey: "unused",
    fetchImpl: async () => { throw new Error("unused"); },
    logger: { info() {}, warn() {} },
  }, async () => {});
  const handler = createOperatorAirtimeTestHandler({
    operatorToken: "token-1",
    secretKey: "secret",
    phone: "07010102053",
    amount: "100",
    reference: "ref-egress",
    expectedEgressIp: "152.55.185.183",
    fetchImpl: async (url) => {
      if (String(url).startsWith("https://api.ipify.org")) {
        return new Response(JSON.stringify({ ip: "203.0.113.10" }), { status: 200, headers: { "content-type": "application/json" } });
      }
      providerCalls += 1;
      throw new Error("provider should not be called");
    },
    logger: { info() {}, warn() {} },
  });
  const server = createServer((request, response) => void handler(request, response));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/ops/flutterwave/test-airtime?token=token-1`, { method: "POST" });
    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, "egress_ip_changed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  assert.equal(providerCalls, 0);
});

// live qualification deployment trigger
