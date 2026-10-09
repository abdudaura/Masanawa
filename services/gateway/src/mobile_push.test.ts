import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { MobilePushRepository } from "@masanawa/agents";
import { createFcmPushSender } from "./mobile_push.js";

const privateKey = generateKeyPairSync("rsa", { modulusLength: 2048 })
  .privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const serviceAccountJson = JSON.stringify({
  project_id: "masanawa-test",
  client_email: "push@masanawa-test.iam.gserviceaccount.com",
  private_key: privateKey,
  token_uri: "https://oauth2.googleapis.com/token",
});
const scope = { tenantId: "tenant_r14" as never, userId: "user_r14" as never };

function repository(tokens: readonly string[]): MobilePushRepository {
  return {
    async list() {
      return tokens.map((token, i) => ({
        ...scope,
        installationId: `install_${i}`,
        platform: "android" as const,
        token,
        createdAt: "2026-10-08T00:00:00Z" as never,
        updatedAt: "2026-10-08T00:00:00Z" as never,
      }));
    },
  } as MobilePushRepository;
}

function senderWith(
  tokens: readonly string[],
  fetchImpl: typeof fetch,
  wait = vi.fn(async (_ms: number) => {}),
) {
  return {
    sender: createFcmPushSender({
      repository: repository(tokens),
      serviceAccountJson,
      fetchImpl,
      wait,
      now: () => new Date("2026-10-08T06:00:00Z"),
    }),
    wait,
  };
}

const request = { scope, title: "Talk update", body: "Your Talk has started." };
const oauth = () => Response.json({ access_token: "oauth-token", expires_in: 3600 });
const failed = (status: number) => new Response(null, { status });

describe("R14 FCM delivery resilience", () => {
  it("does not request OAuth or send when no devices are registered", async () => {
    const fetchImpl = vi.fn(async () => oauth());
    const { sender } = senderWith([], fetchImpl as typeof fetch);
    await expect(sender.send(request)).resolves.toEqual({ attempted: 0, delivered: 0 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("delivers to every scoped registration, truncates visible copy and reuses OAuth", async () => {
    const sent: Array<{ token: string; title: string; body: string; data: Record<string, string> }> = [];
    let authCalls = 0;
    const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes("oauth2.googleapis.com")) {
        authCalls += 1;
        return oauth();
      }
      expect(init?.headers).toMatchObject({ authorization: "Bearer oauth-token" });
      const payload = JSON.parse(String(init?.body)) as {
        message: { token: string; notification: { title: string; body: string }; data: Record<string, string> };
      };
      sent.push({ token: payload.message.token, ...payload.message.notification, data: payload.message.data });
      return Response.json({ name: "projects/masanawa-test/messages/id" });
    });
    const { sender } = senderWith(["one", "two"], fetchImpl as typeof fetch);
    const longRequest = {
      ...request,
      title: "T".repeat(140),
      body: "B".repeat(1020),
      data: { kind: "replay_ready", eventId: "event_1" },
    };
    expect(await sender.send(longRequest)).toEqual({ attempted: 2, delivered: 2 });
    expect(await sender.send(request)).toEqual({ attempted: 2, delivered: 2 });
    expect(authCalls).toBe(1);
    expect(sent).toHaveLength(4);
    expect(sent[0]).toEqual({
      token: "one", title: "T".repeat(120), body: "B".repeat(1000),
      data: { kind: "replay_ready", eventId: "event_1", masanawa: "1" },
    });
  });

  it("retries only definitively rejected transient statuses with bounded backoff", async () => {
    const statuses = [failed(429), failed(503), Response.json({ name: "ok" })];
    const fetchImpl = vi.fn(async (url: unknown) =>
      String(url).includes("oauth2.googleapis.com") ? oauth() : statuses.shift()!);
    const { sender, wait } = senderWith(["one"], fetchImpl as typeof fetch);
    expect(await sender.send(request)).toEqual({ attempted: 1, delivered: 1 });
    expect(wait.mock.calls).toEqual([[250], [500]]);
    expect(fetchImpl).toHaveBeenCalledTimes(4); // one OAuth, three device sends
  });

  it("never treats exhausted transient failures as delivered; continues to another device", async () => {
    const statuses = [failed(500), failed(500), failed(500), Response.json({ name: "ok" })];
    const fetchImpl = vi.fn(async (url: unknown) =>
      String(url).includes("oauth2.googleapis.com") ? oauth() : statuses.shift()!);
    const { sender, wait } = senderWith(["bad", "good"], fetchImpl as typeof fetch);
    expect(await sender.send(request)).toEqual({ attempted: 2, delivered: 1 });
    expect(wait).toHaveBeenCalledTimes(2);
    expect(statuses).toHaveLength(0);
  });

  it("does not retry permanent 400/403 responses or delete tokens without verified error codes", async () => {
    const statuses = [failed(400), failed(403), Response.json({ name: "ok" })];
    const fetchImpl = vi.fn(async (url: unknown) =>
      String(url).includes("oauth2.googleapis.com") ? oauth() : statuses.shift()!);
    const { sender, wait } = senderWith(["bad1", "bad2", "good"], fetchImpl as typeof fetch);
    expect(await sender.send(request)).toEqual({ attempted: 3, delivered: 1 });
    expect(wait).not.toHaveBeenCalled();
    expect(statuses).toHaveLength(0);
  });

  it("refreshes rejected OAuth once and uses the renewed token for subsequent devices", async () => {
    let oauthCalls = 0;
    const headers: string[] = [];
    const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes("oauth2.googleapis.com")) {
        oauthCalls += 1;
        return Response.json({ access_token: `oauth-${oauthCalls}`, expires_in: 3600 });
      }
      const bearer = (init?.headers as Record<string, string>).authorization;
      headers.push(bearer);
      return bearer === "Bearer oauth-1" ? failed(401) : Response.json({ name: "ok" });
    });
    const { sender, wait } = senderWith(["one", "two"], fetchImpl as typeof fetch);
    expect(await sender.send(request)).toEqual({ attempted: 2, delivered: 2 });
    expect(oauthCalls).toBe(2);
    expect(headers).toEqual(["Bearer oauth-1", "Bearer oauth-2", "Bearer oauth-2"]);
    expect(wait).not.toHaveBeenCalled();
  });

  it("reuses a freshly renewed bearer when a second device request reports its stale 401 late", async () => {
    let oauthCalls = 0;
    let oldBearerCalls = 0;
    const sentHeaders: string[] = [];
    let releaseLate401: (() => void) | undefined;
    const late401 = new Promise<void>((resolve) => { releaseLate401 = resolve; });
    const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes("oauth2.googleapis.com")) {
        oauthCalls += 1;
        // A third OAuth call represents a stale 401 incorrectly wiping an
        // already-renewed token. It must not take down a healthy batch.
        if (oauthCalls > 2) throw new Error("OAuth temporarily unavailable");
        return Response.json({ access_token: `oauth-${oauthCalls}`, expires_in: 3600 });
      }
      const bearer = (init?.headers as Record<string, string>).authorization;
      sentHeaders.push(bearer);
      if (bearer === "Bearer oauth-1") {
        oldBearerCalls += 1;
        if (oldBearerCalls === 2) await late401;
        return failed(401);
      }
      if (bearer === "Bearer oauth-2") {
        releaseLate401?.();
        return Response.json({ name: "ok" });
      }
      throw new Error(`Unexpected auth state: ${bearer}`);
    });
    const { sender, wait } = senderWith(["one"], fetchImpl as typeof fetch);
    const outcomes = await Promise.all([sender.send(request), sender.send(request)]);
    expect(outcomes).toEqual([
      { attempted: 1, delivered: 1 },
      { attempted: 1, delivered: 1 },
    ]);
    expect(oldBearerCalls).toBe(2);
    expect(oauthCalls).toBe(2);
    expect(sentHeaders.filter((v) => v === "Bearer oauth-2")).toHaveLength(2);
    expect(wait).not.toHaveBeenCalled();
  });

  it("fails closed on repeated OAuth rejection without including credential details", async () => {
    const fetchImpl = vi.fn(async (url: unknown) =>
      String(url).includes("oauth2.googleapis.com") ? oauth() : failed(401));
    const { sender } = senderWith(["one"], fetchImpl as typeof fetch);
    await expect(sender.send(request)).rejects.toThrow("Firebase FCM rejected refreshed credentials");
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("bounds the OAuth exchange and sanitizes an aborted transport error", async () => {
    const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.signal?.aborted).toBe(false);
      throw new Error("secret in low-level OAuth transport exception");
    });
    const { sender } = senderWith(["one"], fetchImpl as typeof fetch);
    await expect(sender.send(request)).rejects.toThrow("Firebase OAuth failed");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("attaches independent abort deadlines to each FCM device attempt", async () => {
    const deviceTokens: string[] = [];
    const signals: AbortSignal[] = [];
    const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes("oauth2.googleapis.com")) return oauth();
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      signals.push(init!.signal!);
      const token = (JSON.parse(String(init?.body)) as { message: { token: string } }).message.token;
      deviceTokens.push(token);
      if (token === "uncertain") throw new Error("network timeout after upstream acceptance");
      return Response.json({ name: "ok" });
    });
    const { sender, wait } = senderWith(["uncertain", "healthy"], fetchImpl as typeof fetch);
    expect(await sender.send(request)).toEqual({ attempted: 2, delivered: 1 });
    expect(deviceTokens).toEqual(["uncertain", "healthy"]);
    expect(signals).toHaveLength(2);
    expect(signals[0]).not.toBe(signals[1]);
    expect(wait).not.toHaveBeenCalled();
  });

  it("never retries an ambiguous network failure that could duplicate a notification", async () => {
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes("oauth2.googleapis.com")) return oauth();
      const token = (JSON.parse(String(init?.body)) as { message: { token: string } }).message.token;
      seen.push(token);
      if (token === "ambiguous") throw new Error("private transport failure");
      return Response.json({ name: "ok" });
    });
    const { sender, wait } = senderWith(["ambiguous", "healthy"], fetchImpl as typeof fetch);
    expect(await sender.send(request)).toEqual({ attempted: 2, delivered: 1 });
    expect(seen).toEqual(["ambiguous", "healthy"]);
    expect(wait).not.toHaveBeenCalled();
  });

  it("coalesces concurrent OAuth calls without sharing FCM device tokens", async () => {
    let oauthCalls = 0;
    let deviceCalls = 0;
    const fetchImpl = vi.fn(async (url: unknown) => {
      if (String(url).includes("oauth2.googleapis.com")) {
        oauthCalls += 1;
        await Promise.resolve();
        return oauth();
      }
      deviceCalls += 1;
      return Response.json({ name: "ok" });
    });
    const { sender } = senderWith(["one"], fetchImpl as typeof fetch);
    const results = await Promise.all([sender.send(request), sender.send(request)]);
    expect(results).toEqual([{ attempted: 1, delivered: 1 }, { attempted: 1, delivered: 1 }]);
    expect(oauthCalls).toBe(1);
    expect(deviceCalls).toBe(2);
  });
});
