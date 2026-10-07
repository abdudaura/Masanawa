import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

const DEFAULT_PORT = 8788;
const MAX_BODY = 512 * 1024;
const UPSTREAM = "https://api.nowpayments.io";
const RELAY_HEADER = "x-masanawa-relay-token";

const ALLOWED = Object.freeze([
  ["GET", /^\/v1\/status$/u],
  ["GET", /^\/v1\/currencies$/u],
  ["GET", /^\/v1\/min-amount$/u],
  ["GET", /^\/v1\/estimate$/u],
  ["POST", /^\/v1\/invoice$/u],
  ["POST", /^\/v1\/payment$/u],
  ["GET", /^\/v1\/payment\/?$/u],
  ["GET", /^\/v1\/payment\/[A-Za-z0-9_-]{1,128}$/u],
  ["POST", /^\/v1\/auth$/u],
  ["GET", /^\/v1\/balance$/u],
  ["POST", /^\/v1\/conversion$/u],
  ["GET", /^\/v1\/conversion\/[A-Za-z0-9_-]{1,128}$/u],
  ["POST", /^\/v1\/payout\/validate-address$/u],
  ["GET", /^\/v1\/payout\/fee$/u],
  ["GET", /^\/v1\/payout-withdrawal\/min-amount\/[A-Za-z0-9_-]{2,32}$/u],
  ["POST", /^\/v1\/payout$/u],
  ["GET", /^\/v1\/payout$/u],
  ["POST", /^\/v1\/payout\/[A-Za-z0-9_-]{1,128}\/verify$/u],
]);

function digest(value) {
  return createHash("sha256").update(value).digest();
}

export function relayTokenMatches(candidate, expected) {
  if (typeof candidate !== "string" || typeof expected !== "string") return false;
  if (!candidate || !expected) return false;
  return timingSafeEqual(digest(candidate), digest(expected));
}

export function isAllowedNowPaymentsRequest(method, pathname) {
  return ALLOWED.some(([allowedMethod, pattern]) =>
    method === allowedMethod && pattern.test(pathname));
}

export function buildNowPaymentsUpstreamHeaders(headers) {
  const apiKey = headers["x-api-key"];
  const authorization = headers.authorization;
  const contentType = headers["content-type"];
  const accept = headers.accept;
  return Object.freeze({
    ...(typeof apiKey === "string" && apiKey ? { "x-api-key": apiKey } : {}),
    ...(typeof authorization === "string" && authorization
      ? { authorization }
      : {}),
    ...(typeof contentType === "string" && contentType
      ? { "content-type": contentType }
      : {}),
    accept: typeof accept === "string" && accept ? accept : "application/json",
  });
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  response.end(payload);
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : null;
}

export function createNowPaymentsRelayServer(options = {}) {
  const relayToken =
    options.relayToken ?? process.env.MASANAWA_NOWPAYMENTS_RELAY_TOKEN?.trim();
  const fetchImpl = options.fetchImpl ?? fetch;
  if (!relayToken) throw new Error("Missing MASANAWA_NOWPAYMENTS_RELAY_TOKEN");

  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://relay.local");
      if (request.method === "GET" && url.pathname === "/healthz") {
        sendJson(response, 200, {
          ok: true,
          service: "masanawa-nowpayments-relay",
        });
        return;
      }

      const presented = request.headers[RELAY_HEADER];
      const token = Array.isArray(presented) ? presented[0] : presented;
      if (!relayTokenMatches(token, relayToken)) {
        sendJson(response, 401, { ok: false, code: "unauthorized" });
        return;
      }

      const method = request.method ?? "";
      if (!isAllowedNowPaymentsRequest(method, url.pathname)) {
        sendJson(response, 404, { ok: false, code: "not_allowed" });
        return;
      }

      const rawBody = method === "POST" ? await readBody(request) : null;
      const upstreamUrl = new URL(`${UPSTREAM}${url.pathname}`);
      upstreamUrl.search = url.search;

      let upstream;
      try {
        upstream = await fetchImpl(upstreamUrl, {
          method,
          headers: buildNowPaymentsUpstreamHeaders(request.headers),
          ...(rawBody === null ? {} : { body: rawBody }),
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
        });
      } catch {
        sendJson(response, 502, {
          ok: false,
          code: "nowpayments_unreachable",
        });
        return;
      }

      const body = Buffer.from(await upstream.arrayBuffer());
      response.writeHead(upstream.status, {
        "content-type":
          upstream.headers.get("content-type") || "application/json",
        "content-length": body.length,
        "cache-control": "no-store",
      });
      response.end(body);
    } catch (error) {
      const code = error instanceof Error ? error.message : "internal_error";
      sendJson(response, code === "body_too_large" ? 413 : 500, {
        ok: false,
        code,
      });
    }
  });
}

function isDirectExecution() {
  const entry = process.argv[1];
  return Boolean(entry && import.meta.url === pathToFileURL(entry).href);
}

if (isDirectExecution()) {
  const port = Number(process.env.PORT || DEFAULT_PORT);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid PORT");
  }
  const server = createNowPaymentsRelayServer();
  server.listen(port, "127.0.0.1", () => {
    console.info(JSON.stringify({
      event: "service.started",
      service: "masanawa-nowpayments-relay",
      port,
    }));
  });
}
