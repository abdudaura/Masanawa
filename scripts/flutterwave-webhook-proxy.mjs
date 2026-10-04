import { createHash, timingSafeEqual } from "node:crypto";
import { createServer, request as httpRequest } from "node:http";
import { connect } from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const FLUTTERWAVE_WEBHOOK_PATH = "/webhooks/flutterwave";
export const MAX_WEBHOOK_BYTES = 1024 * 1024;

export const FLUTTERWAVE_OPERATOR_TEST_PATH = "/ops/flutterwave/test-airtime";

async function flutterwaveJson(secretKey, path, options = {}, fetchImpl = fetch) {
  const response = await fetchImpl(`https://api.flutterwave.com${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${secretKey}`,
      accept: "application/json",
      "content-type": "application/json",
      ...(options.headers ?? {}),
    },
    redirect: "error",
    signal: options.signal ?? AbortSignal.timeout(15000),
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { status: response.status, body };
}

function providerMessage(body) {
  return typeof body?.message === "string" ? body.message.slice(0, 300) : null;
}

function normalizeBillRows(body) {
  return body?.status === "success" && Array.isArray(body?.data) ? body.data : null;
}

export async function executeOperatorAirtimeTest({
  secretKey,
  phone,
  amount,
  reference,
  callbackUrl,
  fetchImpl = fetch,
}) {
  const existing = await flutterwaveJson(
    secretKey,
    `/v3/bills/${encodeURIComponent(reference)}?verbose=1`,
    { method: "GET" },
    fetchImpl,
  );
  if (existing.status === 200 && existing.body?.status === "success") {
    return {
      outcome: "existing_reference",
      providerStatus: existing.body?.data?.status ?? null,
      reference,
      providerReference: existing.body?.data?.flw_ref ?? existing.body?.data?.tx_ref ?? null,
      httpStatus: existing.status,
    };
  }
  if (existing.status !== 404) {
    return {
      outcome: "precheck_failed",
      reference,
      httpStatus: existing.status,
      providerStatus: existing.body?.status ?? null,
      message: providerMessage(existing.body),
    };
  }

  const categories = await flutterwaveJson(
    secretKey,
    "/v3/top-bill-categories?country=NG",
    { method: "GET" },
    fetchImpl,
  );
  const categoryRows = normalizeBillRows(categories.body);
  if (categories.status !== 200 || !categoryRows) {
    return {
      outcome: "catalog_unavailable",
      stage: "categories",
      reference,
      httpStatus: categories.status,
      providerStatus: categories.body?.status ?? null,
      message: providerMessage(categories.body),
    };
  }
  const airtimeCategory = categoryRows.find((row) =>
    /airtime/i.test(`${row?.name ?? ""} ${row?.code ?? ""} ${row?.description ?? ""}`),
  );
  if (!airtimeCategory?.code) {
    return { outcome: "catalog_unavailable", stage: "airtime_category", reference, httpStatus: 422 };
  }

  const billers = await flutterwaveJson(
    secretKey,
    `/v3/bills/${encodeURIComponent(String(airtimeCategory.code))}/billers?country=NG`,
    { method: "GET" },
    fetchImpl,
  );
  const billerRows = normalizeBillRows(billers.body);
  if (billers.status !== 200 || !billerRows) {
    return {
      outcome: "catalog_unavailable",
      stage: "billers",
      reference,
      httpStatus: billers.status,
      providerStatus: billers.body?.status ?? null,
      message: providerMessage(billers.body),
    };
  }
  const airtel = billerRows.find((row) =>
    /airtel/i.test(`${row?.name ?? ""} ${row?.biller_code ?? row?.code ?? ""}`),
  );
  const billerCode = airtel?.biller_code ?? airtel?.code;
  if (!billerCode) {
    return { outcome: "catalog_unavailable", stage: "airtel_biller", reference, httpStatus: 422 };
  }

  const items = await flutterwaveJson(
    secretKey,
    `/v3/billers/${encodeURIComponent(String(billerCode))}/items`,
    { method: "GET" },
    fetchImpl,
  );
  const itemRows = normalizeBillRows(items.body);
  if (items.status !== 200 || !itemRows?.length) {
    return {
      outcome: "catalog_unavailable",
      stage: "items",
      reference,
      httpStatus: items.status,
      providerStatus: items.body?.status ?? null,
      message: providerMessage(items.body),
    };
  }
  const item =
    itemRows.find((row) =>
      /airtime|top.?up|recharge/i.test(`${row?.name ?? ""} ${row?.label_name ?? ""}`),
    ) ?? itemRows[0];
  if (!item?.item_code) {
    return { outcome: "catalog_unavailable", stage: "airtel_item", reference, httpStatus: 422 };
  }

  let payment;
  try {
    payment = await flutterwaveJson(
      secretKey,
      `/v3/billers/${encodeURIComponent(String(billerCode))}/items/${encodeURIComponent(String(item.item_code))}/payment`,
      {
        method: "POST",
        body: JSON.stringify({
          country: "NG",
          customer_id: phone,
          amount,
          reference,
          ...(callbackUrl ? { callback_url: callbackUrl } : {}),
        }),
      },
      fetchImpl,
    );
  } catch {
    payment = { status: 0, body: null };
  }

  if (payment.status === 200 && payment.body?.status === "success") {
    return {
      outcome: "submitted",
      reference: payment.body?.data?.customer_reference ?? reference,
      providerReference: payment.body?.data?.flw_ref ?? payment.body?.data?.tx_ref ?? null,
      providerStatus: payment.body?.data?.status ?? null,
      amount: payment.body?.data?.amount ?? amount,
      httpStatus: payment.status,
    };
  }

  let reconcile;
  try {
    reconcile = await flutterwaveJson(
      secretKey,
      `/v3/bills/${encodeURIComponent(reference)}?verbose=1`,
      { method: "GET" },
      fetchImpl,
    );
  } catch {
    reconcile = { status: 0, body: null };
  }
  if (reconcile.status === 200 && reconcile.body?.status === "success") {
    return {
      outcome: "reconciled_after_ambiguous_dispatch",
      reference,
      providerReference: reconcile.body?.data?.flw_ref ?? reconcile.body?.data?.tx_ref ?? null,
      providerStatus: reconcile.body?.data?.status ?? null,
      httpStatus: reconcile.status,
    };
  }
  return {
    outcome: payment.status === 0 || payment.status >= 500 ? "outcome_unknown" : "dispatch_rejected",
    reference,
    httpStatus: payment.status,
    providerStatus: payment.body?.status ?? null,
    message: providerMessage(payment.body),
    reconcileHttpStatus: reconcile.status,
  };
}

export function createOperatorAirtimeTestHandler({
  operatorToken,
  secretKey,
  phone,
  amount,
  reference,
  callbackUrl,
  expectedEgressIp,
  fetchImpl = fetch,
  logger = console,
}) {
  let consumed = false;
  return async function handleOperatorAirtimeTest(request, response) {
    if (request.method !== "POST") {
      response.setHeader("allow", "POST");
      sendJson(response, 405, { ok: false, code: "method_not_allowed" });
      return;
    }
    const url = new URL(request.url ?? "/", "http://masanawa.local");
    const token = url.searchParams.get("token");
    if (!constantTimeSecretMatch(token, operatorToken)) {
      sendJson(response, 401, { ok: false, code: "invalid_operator_token" });
      return;
    }
    if (consumed) {
      sendJson(response, 409, { ok: false, code: "operator_test_already_consumed", reference });
      return;
    }
    consumed = true;

    if (expectedEgressIp) {
      try {
        const ipResponse = await fetchImpl("https://api.ipify.org?format=json", {
          signal: AbortSignal.timeout(8000),
        });
        const ipBody = await ipResponse.json();
        if (ipBody?.ip !== expectedEgressIp) {
          logger.warn?.("Flutterwave operator test skipped because runtime egress changed", {
            expectedEgressIp,
            actualEgressIp: typeof ipBody?.ip === "string" ? ipBody.ip : null,
          });
          sendJson(response, 409, {
            ok: false,
            code: "egress_ip_changed",
            expectedEgressIp,
            actualEgressIp: typeof ipBody?.ip === "string" ? ipBody.ip : null,
          });
          return;
        }
      } catch {
        sendJson(response, 503, { ok: false, code: "egress_ip_unverifiable" });
        return;
      }
    }

    const result = await executeOperatorAirtimeTest({
      secretKey,
      phone,
      amount,
      reference,
      callbackUrl,
      fetchImpl,
    });
    logger.info?.("Flutterwave operator airtime test completed", {
      outcome: result.outcome,
      reference: result.reference,
      providerStatus: result.providerStatus ?? null,
      httpStatus: result.httpStatus ?? null,
    });
    sendJson(response, result.outcome === "submitted" || result.outcome === "existing_reference" || result.outcome === "reconciled_after_ambiguous_dispatch" ? 200 : 502, {
      ok: result.outcome === "submitted" || result.outcome === "existing_reference" || result.outcome === "reconciled_after_ambiguous_dispatch",
      ...result,
    });
  };
}

export function constantTimeSecretMatch(actual, expected) {
  if (typeof actual !== "string" || typeof expected !== "string" || !actual || !expected) return false;
  const left = createHash("sha256").update(actual, "utf8").digest();
  const right = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(left, right);
}

export async function readBoundedBody(request, maxBytes = MAX_WEBHOOK_BYTES) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += value.length;
    if (total > maxBytes) {
      const error = new Error("webhook_body_too_large");
      error.code = "BODY_TOO_LARGE";
      throw error;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

export function parseWebhookBody(rawBody) {
  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    throw new Error("invalid_webhook_json");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("invalid_webhook_payload");
  if (typeof payload.event !== "string" || payload.event.length < 1 || payload.event.length > 128) {
    throw new Error("invalid_webhook_event");
  }
  return payload;
}

export function safeWebhookMetadata(payload, rawBody) {
  const data = payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data) ? payload.data : {};
  return Object.freeze({
    event: payload.event,
    status: typeof data.status === "string" ? data.status.slice(0, 64) : null,
    customerReference:
      typeof data.customer_reference === "string" && data.customer_reference.length <= 200
        ? data.customer_reference
        : null,
    fingerprint: `sha256:${createHash("sha256").update(rawBody).digest("hex")}`,
  });
}

export async function verifyBillCallbackAgainstProvider(payload, secretKey, fetchImpl = fetch) {
  if (payload.event !== "singlebillpayment.status") return { supported: false, verified: true, status: null };
  const data = payload?.data && typeof payload.data === "object" && !Array.isArray(payload.data) ? payload.data : {};
  const reference = typeof data.customer_reference === "string" ? data.customer_reference.trim() : "";
  if (!reference || reference.length > 200) return { supported: true, verified: false, status: null };

  const response = await fetchImpl(
    `https://api.flutterwave.com/v3/bills/${encodeURIComponent(reference)}?verbose=1`,
    {
      headers: {
        authorization: `Bearer ${secretKey}`,
        accept: "application/json",
      },
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!response.ok) return { supported: true, verified: false, status: response.status };
  let body;
  try {
    body = await response.json();
  } catch {
    return { supported: true, verified: false, status: response.status };
  }

  const providerReference = body?.data?.customer_reference;
  const providerCurrency = body?.data?.currency;
  const providerCustomer = body?.data?.customer_id;
  const webhookAmount = data.amount;
  const providerAmount = body?.data?.amount;
  const amountsAgree =
    webhookAmount == null ||
    providerAmount == null ||
    Number(webhookAmount) === Number(providerAmount);

  return {
    supported: true,
    verified:
      body?.status === "success" &&
      providerReference === reference &&
      (providerCurrency == null || providerCurrency === "NGN") &&
      amountsAgree &&
      (typeof data.customer !== "string" || providerCustomer == null || providerCustomer === data.customer),
    status: response.status,
  };
}

function sendJson(response, statusCode, body) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(body));
}

export function createFlutterwaveWebhookHandler({
  webhookSecret,
  flutterwaveSecretKey,
  fetchImpl = fetch,
  logger = console,
}) {
  return async function handleFlutterwaveWebhook(request, response) {
    if (request.method !== "POST") {
      response.setHeader("allow", "POST");
      sendJson(response, 405, { ok: false, code: "method_not_allowed" });
      return;
    }

    const signature = Array.isArray(request.headers["verif-hash"])
      ? request.headers["verif-hash"][0]
      : request.headers["verif-hash"];
    if (!constantTimeSecretMatch(signature, webhookSecret)) {
      sendJson(response, 401, { ok: false, code: "invalid_signature" });
      return;
    }

    let rawBody;
    let payload;
    try {
      rawBody = await readBoundedBody(request);
      payload = parseWebhookBody(rawBody);
    } catch (error) {
      const status = error?.code === "BODY_TOO_LARGE" ? 413 : 400;
      sendJson(response, status, { ok: false, code: status === 413 ? "payload_too_large" : "invalid_payload" });
      return;
    }

    const metadata = safeWebhookMetadata(payload, rawBody);
    if (payload.event === "singlebillpayment.status") {
      try {
        const checked = await verifyBillCallbackAgainstProvider(payload, flutterwaveSecretKey, fetchImpl);
        if (!checked.verified) {
          logger.warn?.("Flutterwave bill webhook provider verification pending", {
            event: metadata.event,
            fingerprint: metadata.fingerprint,
            providerStatus: checked.status,
          });
          sendJson(response, 503, { ok: false, code: "provider_verification_pending" });
          return;
        }
      } catch {
        logger.warn?.("Flutterwave bill webhook provider verification unavailable", {
          event: metadata.event,
          fingerprint: metadata.fingerprint,
        });
        sendJson(response, 503, { ok: false, code: "provider_verification_unavailable" });
        return;
      }
    }

    logger.info?.("Flutterwave webhook authenticated", metadata);
    sendJson(response, 200, { ok: true });
  };
}

function proxyHttpRequest(request, response, upstreamPort) {
  const upstream = httpRequest(
    {
      hostname: "127.0.0.1",
      port: upstreamPort,
      method: request.method,
      path: request.url,
      headers: request.headers,
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstream.on("error", () => {
    if (!response.headersSent) sendJson(response, 502, { ok: false, code: "gateway_unavailable" });
    else response.destroy();
  });
  request.pipe(upstream);
}

export function createProxyServer({
  publicPort,
  upstreamPort,
  webhookSecret,
  flutterwaveSecretKey,
  fetchImpl = fetch,
  logger = console,
}) {
  const webhookHandler = createFlutterwaveWebhookHandler({
    webhookSecret,
    flutterwaveSecretKey,
    fetchImpl,
    logger,
  });
  const operatorToken = process.env.FLUTTERWAVE_OPERATOR_TEST_TOKEN?.trim();
  const operatorPhone = process.env.FLUTTERWAVE_OPERATOR_TEST_PHONE?.trim();
  const operatorAmount = process.env.FLUTTERWAVE_OPERATOR_TEST_AMOUNT?.trim();
  const operatorReference = process.env.FLUTTERWAVE_OPERATOR_TEST_REFERENCE?.trim();
  const operatorHandler =
    operatorToken && operatorPhone && operatorAmount && operatorReference
      ? createOperatorAirtimeTestHandler({
          operatorToken,
          secretKey: flutterwaveSecretKey,
          phone: operatorPhone,
          amount: operatorAmount,
          reference: operatorReference,
          callbackUrl: process.env.FLUTTERWAVE_WEBHOOK_URL?.trim(),
          expectedEgressIp: process.env.FLUTTERWAVE_OPERATOR_EXPECTED_EGRESS_IP?.trim(),
          fetchImpl,
          logger,
        })
      : null;
  const server = createServer((request, response) => {
    const path = new URL(request.url ?? "/", "http://masanawa.local").pathname;
    if (path === FLUTTERWAVE_WEBHOOK_PATH) {
      void webhookHandler(request, response);
      return;
    }
    if (path === FLUTTERWAVE_OPERATOR_TEST_PATH && operatorHandler) {
      void operatorHandler(request, response);
      return;
    }
    proxyHttpRequest(request, response, upstreamPort);
  });

  server.on("upgrade", (request, socket, head) => {
    const upstream = connect(upstreamPort, "127.0.0.1", () => {
      const lines = [`${request.method} ${request.url} HTTP/${request.httpVersion}`];
      for (let index = 0; index < request.rawHeaders.length; index += 2) {
        lines.push(`${request.rawHeaders[index]}: ${request.rawHeaders[index + 1]}`);
      }
      upstream.write(lines.join("\r\n") + "\r\n\r\n");
      if (head.length) upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on("error", () => socket.destroy());
  });

  return server.listen(publicPort, "0.0.0.0");
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function startHostedAlphaWithFlutterwaveWebhook() {
  const publicPort = Number(process.env.PORT ?? 3000);
  const upstreamPort = Number(process.env.MASANAWA_GATEWAY_INTERNAL_PORT ?? publicPort + 1);
  if (!Number.isInteger(publicPort) || publicPort < 1 || publicPort > 65535) throw new Error("Invalid PORT");
  if (!Number.isInteger(upstreamPort) || upstreamPort < 1 || upstreamPort > 65535 || upstreamPort === publicPort) {
    throw new Error("Invalid MASANAWA_GATEWAY_INTERNAL_PORT");
  }

  const webhookSecret = requireEnv("FLUTTERWAVE_WEBHOOK_SECRET_HASH");
  const flutterwaveSecretKey = requireEnv("FLUTTERWAVE_SECRET_KEY");
  const child = spawn(
    process.execPath,
    ["--conditions=production", "scripts/start-hosted-alpha.mjs"],
    {
      env: { ...process.env, PORT: String(upstreamPort) },
      stdio: "inherit",
    },
  );

  const server = createProxyServer({
    publicPort,
    upstreamPort,
    webhookSecret,
    flutterwaveSecretKey,
  });

  if (process.env.MASANAWA_EGRESS_IP_PROBE === "1") {
    fetch("https://api.ipify.org?format=json")
      .then((response) => response.json())
      .then((body) => {
        if (typeof body?.ip === "string") {
          console.info("Masanawa runtime egress IPv4", { ip: body.ip });
        }
      })
      .catch((error) => {
        console.warn("Masanawa runtime egress probe failed", { message: error?.message ?? "unknown" });
      });
  }

  const shutdown = (signal) => {
    server.close(() => {
      if (!child.killed) child.kill(signal);
    });
  };
  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
  child.once("exit", (code, signal) => {
    server.close();
    if (signal) process.kill(process.pid, signal);
    else process.exitCode = code ?? 1;
  });
  return { server, child, publicPort, upstreamPort };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  startHostedAlphaWithFlutterwaveWebhook();
}

// egress probe deployment trigger
