import { createHash, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 10000);
const RELAY_TOKEN = process.env.MASANAWA_FLUTTERWAVE_RELAY_TOKEN?.trim();
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY?.trim();
const MAX_BODY = 1024 * 1024;
const ALLOWED_PATHS = [
  /^\/v3\/top-bill-categories$/u,
  /^\/v3\/bills\/[^/]+\/billers$/u,
  /^\/v3\/billers\/[^/]+\/items$/u,
  /^\/v3\/bill-items\/[^/]+\/validate$/u,
  /^\/v3\/billers\/[^/]+\/items\/[^/]+\/payment$/u,
  /^\/v3\/bills\/[^/]+$/u,
];

function digest(value) {
  return createHash("sha256").update(value).digest();
}

function tokenMatches(candidate, expected) {
  if (typeof candidate !== "string" || typeof expected !== "string") return false;
  return timingSafeEqual(digest(candidate), digest(expected));
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

function safePath(pathname) {
  return ALLOWED_PATHS.some((pattern) => pattern.test(pathname));
}

if (!RELAY_TOKEN || !FLUTTERWAVE_SECRET_KEY) {
  throw new Error("Missing MASANAWA_FLUTTERWAVE_RELAY_TOKEN or FLUTTERWAVE_SECRET_KEY");
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", "http://relay.local");
    if (request.method === "GET" && url.pathname === "/healthz") {
      sendJson(response, 200, { ok: true, service: "masanawa-flutterwave-relay" });
      return;
    }

    const auth = request.headers.authorization;
    const token = typeof auth === "string" && auth.startsWith("Bearer ") ? auth.slice(7) : null;
    if (!tokenMatches(token, RELAY_TOKEN)) {
      sendJson(response, 401, { ok: false, code: "unauthorized" });
      return;
    }

    if ((request.method !== "GET" && request.method !== "POST") || !safePath(url.pathname)) {
      sendJson(response, 404, { ok: false, code: "not_allowed" });
      return;
    }

    const rawBody = request.method === "POST" ? await readBody(request) : null;
    const upstreamUrl = new URL(`https://api.flutterwave.com${url.pathname}`);
    upstreamUrl.search = url.search;

    let upstream;
    try {
      upstream = await fetch(upstreamUrl, {
        method: request.method,
        headers: {
          authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
          accept: "application/json",
          ...(request.method === "POST" ? { "content-type": "application/json" } : {}),
        },
        body: rawBody,
        redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      sendJson(response, 502, { ok: false, code: "flutterwave_unreachable" });
      return;
    }

    const body = Buffer.from(await upstream.arrayBuffer());
    response.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") || "application/json",
      "content-length": body.length,
      "cache-control": "no-store",
    });
    response.end(body);
  } catch (error) {
    const code = error instanceof Error ? error.message : "internal_error";
    sendJson(response, code === "body_too_large" ? 413 : 500, { ok: false, code });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.info(JSON.stringify({ event: "service.started", service: "masanawa-flutterwave-relay", port: PORT }));
});
