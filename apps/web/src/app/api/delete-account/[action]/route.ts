import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "masanawa_deletion_access";
const COOKIE_PATH = "/api/delete-account";
const MAX_BODY_BYTES = 8192;

type Action =
  | "send-signin-code"
  | "verify-signin-code"
  | "status"
  | "request"
  | "verify-deletion"
  | "end-session";

function response(code: string, status: number) {
  return NextResponse.json({ code }, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function validBody(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}

function allowedKeys(body: Record<string, unknown>, expected: readonly string[]) {
  return Object.keys(body).every((key) => expected.includes(key));
}

async function readBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return null;
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return validBody(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

function targetBase(): string | null {
  const configured = process.env.MASANAWA_DELETION_GATEWAY_URL?.trim();
  if (!configured) return null;
  try {
    const parsed = new URL(configured);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password ||
        parsed.search || parsed.hash) return null;
    return parsed.origin + "/";
  } catch {
    return null;
  }
}

const upstreamPaths: Record<Exclude<Action, "end-session">, readonly [string, "GET" | "POST"]> = {
  "send-signin-code": ["/auth/otp", "POST"],
  "verify-signin-code": ["/auth/verify", "POST"],
  status: ["/account/deletion", "GET"],
  request: ["/account/deletion/request", "POST"],
  "verify-deletion": ["/account/deletion/verify", "POST"],
};

function emailOrPhone(body: Record<string, unknown>) {
  if (!allowedKeys(body, ["email", "phone"])) return false;
  const email = body.email;
  const phone = body.phone;
  return (
    typeof email === "string" && email.length <= 320 && !phone && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
  ) || (
    typeof phone === "string" && /^\+[1-9]\d{6,14}$/u.test(phone) && !email
  );
}

function validActionBody(action: Action, body: Record<string, unknown>): boolean {
  if (action === "send-signin-code") return emailOrPhone(body);
  if (action === "verify-signin-code") {
    if (!allowedKeys(body, ["email", "phone", "code"])) return false;
    const { code, ...identifier } = body;
    return typeof code === "string" && /^\d{6}$/u.test(code) && emailOrPhone(identifier);
  }
  if (action === "verify-deletion") {
    return allowedKeys(body, ["code"]) &&
      typeof body.code === "string" && /^\d{6}$/u.test(body.code);
  }
  return Object.keys(body).length === 0;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  // Strict same-origin request policy and a path-scoped HttpOnly session protect
  // state-changing proxy operations from cross-site forms and scripts.
  if (!sameOrigin(request)) return response("ORIGIN_DENIED", 403);
  const { action: rawAction } = await context.params;
  if (rawAction === "end-session") {
    const result = NextResponse.json({ ok: true }, {
      headers: { "cache-control": "no-store" },
    });
    result.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true, sameSite: "strict", secure: request.nextUrl.protocol === "https:",
      path: COOKIE_PATH, maxAge: 0,
    });
    return result;
  }
  if (!Object.prototype.hasOwnProperty.call(upstreamPaths, rawAction)) {
    return response("ACTION_NOT_FOUND", 404);
  }
  const action = rawAction as Exclude<Action, "end-session">;
  const body = await readBody(request);
  if (!body || !validActionBody(action, body)) {
    return response("INVALID_REQUEST", 400);
  }
  const base = targetBase();
  if (!base) return response("ACCOUNT_SERVICE_NOT_CONFIGURED", 503);
  const [path, method] = upstreamPaths[action];
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!["send-signin-code", "verify-signin-code"].includes(action) && !token) {
    return response("SIGN_IN_REQUIRED", 401);
  }
  try {
    const upstream = await fetch(new URL(path.slice(1), base), {
      method,
      headers: {
        accept: "application/json",
        ...(method === "POST" ? { "content-type": "application/json" } : {}),
        ...(token && !["send-signin-code", "verify-signin-code"].includes(action)
          ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return response("ACCOUNT_SERVICE_UNAVAILABLE", 503);
    }
    const data: unknown = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const rawCode = validBody(data) ? data.code : null;
      const safeCode = typeof rawCode === "string" && /^[A-Z0-9_]{3,80}$/u.test(rawCode)
        ? rawCode : "ACCOUNT_SERVICE_UNAVAILABLE";
      return response(safeCode, upstream.status >= 400 && upstream.status <= 503 ? upstream.status : 503);
    }
    if (!validBody(data)) return response("ACCOUNT_SERVICE_INVALID_RESPONSE", 503);
    if (action === "verify-signin-code") {
      const accessToken = data.accessToken;
      if (typeof accessToken !== "string" || !/^msw_access_[A-Za-z0-9_-]{40,80}$/u.test(accessToken)) {
        return response("ACCOUNT_SERVICE_INVALID_RESPONSE", 503);
      }
      // Never return access/refresh tokens to browser JavaScript or persist in
      // localStorage. This short session is scoped to the deletion proxy only.
      const success = NextResponse.json({ ok: true }, {
        headers: { "cache-control": "no-store" },
      });
      success.cookies.set(SESSION_COOKIE, accessToken, {
        httpOnly: true, sameSite: "strict", secure: request.nextUrl.protocol === "https:",
        path: COOKIE_PATH, maxAge: 900,
      });
      return success;
    }
    return NextResponse.json(data, {
      status: 200, headers: { "cache-control": "no-store" },
    });
  } catch {
    return response("ACCOUNT_SERVICE_UNAVAILABLE", 503);
  }
}
