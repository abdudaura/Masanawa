import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../../apps/web/src/app/api/delete-account/[action]/route.js";

const origin = "https://privacy.masanawa.com";
const accessToken = "msw_access_" + "A".repeat(43);
const refreshToken = "msw_refresh_" + "B".repeat(43);
const gatewayBase = "https://gateway.test.invalid";

function request(action: string, payload: Record<string, unknown> = {}, extra?: {
  origin?: string; cookie?: string;
}) {
  return {
    request: new NextRequest(`${origin}/api/delete-account/${action}`, {
      method: "POST",
      headers: {
        origin: extra?.origin ?? origin,
        "content-type": "application/json",
        ...(extra?.cookie ? { cookie: extra.cookie } : {}),
      },
      body: JSON.stringify(payload),
    }),
    context: { params: Promise.resolve({ action }) },
  };
}

describe("external account deletion proxy", () => {
  beforeEach(() => {
    process.env.MASANAWA_DELETION_GATEWAY_URL = gatewayBase;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.MASANAWA_DELETION_GATEWAY_URL;
  });

  it("refuses cross-origin requests before invoking the Gateway", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const req = request("request", {}, { origin: "https://attacker.invalid" });
    const result = await POST(req.request, req.context);
    expect(result.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("requires a session for every account-scoped action", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const req = request("request");
    const result = await POST(req.request, req.context);
    expect(result.status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("never returns platform access or refresh tokens to JavaScript", async () => {
    const upstream = vi.fn(async () => new Response(JSON.stringify({
      accessToken, refreshToken,
    }), {
      status: 200, headers: { "content-type": "application/json" },
    }));
    vi.stubGlobal("fetch", upstream);
    const req = request("verify-signin-code", {
      email: "test@example.com", code: "123456",
    });
    const result = await POST(req.request, req.context);
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ ok: true });
    const cookie = result.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=strict");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Path=/api/delete-account");
    expect(cookie).not.toContain(refreshToken);
    expect(upstream.mock.calls).toHaveLength(1);
  });

  it("does not forward caller-selected identity or private provider fields", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const req = request("request", { userId: "other-person" }, {
      cookie: `masanawa_deletion_access=${accessToken}`,
    });
    const result = await POST(req.request, req.context);
    expect(result.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("uses only the session cookie for trusted Gateway account identity", async () => {
    const upstream = vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify({
      request: {
        requestId: "req", phase: "identity-verified", revision: 2,
        createdAt: "2026-10-08T01:00:00.000Z",
        updatedAt: "2026-10-08T01:02:00.000Z",
      },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", upstream);
    const req = request("status", {}, {
      cookie: `masanawa_deletion_access=${accessToken}`,
    });
    const result = await POST(req.request, req.context);
    expect(result.status).toBe(200);
    const [url, options] = upstream.mock.calls[0]!;
    expect(String(url)).toBe(`${gatewayBase}/account/deletion`);
    expect((options as RequestInit).headers).toMatchObject({
      authorization: `Bearer ${accessToken}`,
    });
    expect(await result.json()).toMatchObject({
      request: { phase: "identity-verified" },
    });
  });

  it("does not forward arbitrary browser routes or misconfigured URLs", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const unknown = request("download-wallet");
    expect((await POST(unknown.request, unknown.context)).status).toBe(404);
    process.env.MASANAWA_DELETION_GATEWAY_URL = "http://insecure.invalid";
    const req = request("send-signin-code", { email: "test@example.com" });
    expect((await POST(req.request, req.context)).status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });
});
