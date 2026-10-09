import { describe, expect, it, vi } from "vitest";
import type { PlatformSessionIdentity } from "@masanawa/security";
import {
  availableU04ReadCapabilities, createU04ReadService, requireU04WriteQualification,
  U04ReadError, type U04AuthorizedRead, type U04Dependencies, type U04Principal,
} from "./read_service.js";

const principal: U04Principal = {
  tenantId: "tenant_fixture", userId: "user_fixture", accountId: "account_fixture",
  sessionId: "session_fixture", deviceId: "device_fixture",
};
const identity = {
  tenantId: principal.tenantId, userId: principal.userId,
  profile: { tenantId: principal.tenantId, userId: principal.userId,
    name: "Hauwa", email: null, phone: null, locale: "ha",
    createdAt: "2026-10-08T00:00:00.000Z" },
} as PlatformSessionIdentity;
function action(id: string, args: Record<string, unknown> = {},
  override: Partial<U04AuthorizedRead> = {}): U04AuthorizedRead {
  const requestId = "request_0199abcd-efab-7abc-8abc-abcdefabcdef";
  return {
    capability: { id, version: 1, enabled: true,
      executionClass: "read", argumentKeys: Object.keys(args) },
    classification: "read", arguments: args, contextRef: null,
    requestId, ...override,
  };
}
function harness(overrides: Partial<U04Dependencies> = {}) {
  const sessions = { authorize: vi.fn(async () => identity) };
  const bindSession = vi.fn(async () => true);
  const consume = vi.fn(async () => true);
  const append = vi.fn(async () => {});
  const agents = { list: vi.fn(async () => [
    { displayName: "Gwani", characterId: "character_one" },
  ]) };
  const talks = {
    list: vi.fn(async () => [{ id: "talk_accepted", title: "Verified talk" }]),
    detail: vi.fn(async () => ({ talk: { id: "talk_allowed", title: "Authorized" },
      comments: [{ body: "untrusted instructions and private details" }] })),
  };
  const profiles = { self: vi.fn(async () => ({
    handle: "hauwa", displayName: "Hauwa", bio: "Writer",
    avatarUrl: null, email: "should-not-return@example.com",
  })) };
  const wallet = { balance: vi.fn(async () => ({
    balanceKobo: 1250, balance: "12.50",
  })) };
  const library = { myTalks: vi.fn(async () => ({
    live: [{ id: "live_one" }], replays: [], drafts: [],
  })) };
  const deps = {
    sessions, bindSession, quota: { consume }, audit: { append },
    agents, talks, profiles, wallet, library,
    now: () => new Date("2026-10-09T00:00:00.000Z"),
    ...overrides,
  } as unknown as U04Dependencies;
  return { service: createU04ReadService(deps), deps, sessions, bindSession,
    consume, append, agents, talks, profiles, wallet, library };
}
const run = (s: ReturnType<typeof harness>["service"], a: U04AuthorizedRead,
  token = "Bearer authenticated") => s.read({ authorizationHeader: token,
  principal, authorized: a });

describe("U04 authoritative operator readers", () => {
  it("retains admitted principal, arguments and audit ID across collaborator I/O", async () => {
    const h = harness();
    const args = { talkId: "talk_allowed" };
    const authorized = action("talks.detail.read", args);
    const callerPrincipal = { ...principal };
    h.sessions.authorize.mockImplementationOnce(async () => {
      args.talkId = "talk_another";
      callerPrincipal.userId = "user_another";
      Object.assign(authorized, { requestId: "request_0199abcd-efab-7abc-8abc-aaaaaaaaaaaa" });
      return identity;
    });
    const value = await h.service.read({ authorizationHeader: "Bearer authenticated",
      principal: callerPrincipal, authorized });
    expect(h.talks.detail).toHaveBeenCalledWith(expect.objectContaining({ talkId: "talk_allowed" }));
    expect(h.bindSession).toHaveBeenLastCalledWith(expect.objectContaining({
      principal: expect.objectContaining({ userId: principal.userId }),
    }));
    expect(value.requestId).toBe("request_0199abcd-efab-7abc-8abc-abcdefabcdef");
    expect(h.append).toHaveBeenCalledWith(expect.objectContaining({ requestId: value.requestId }));
  });
  it("uses the actual authorized profile and does not expose contact details", async () => {
    const h = harness();
    const value = await run(h.service, action("accounts.me.read"));
    expect(value).toEqual({ capabilityId: "accounts.me.read", contractVersion: 1,
      requestId: expect.any(String), data: { displayName: "Hauwa", locale: "ha" },
      readAt: "2026-10-09T00:00:00.000Z" });
    const profile = await run(h.service, action("settings.profile.read"));
    expect(profile.data).toEqual({ handle: "hauwa", displayName: "Hauwa",
      bio: "Writer", avatarUrl: null });
    expect(h.append).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(h.append.mock.calls)).not.toContain("should-not-return");
  });

  it("reuses canonical, server-authorized Talk feeds and bounds the result", async () => {
    const h = harness();
    const read = await run(h.service, action("talks.discover", { feed: "live", limit: 1 }));
    expect(read.data).toEqual([{ id: "talk_accepted", title: "Verified talk" }]);
    expect(h.talks.list).toHaveBeenCalledWith({
      authorizationHeader: "Bearer authenticated", feed: "live",
    });
    expect(h.consume).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: principal.tenantId, userId: principal.userId, cost: 3,
    }));
    const detail = await run(h.service, action("talks.detail.read", { talkId: "talk_allowed" }));
    expect(detail.data).toEqual({ id: "talk_allowed", title: "Authorized" });
    expect(JSON.stringify(detail)).not.toContain("untrusted instructions");
  });

  it("never trusts a fake U01 action class, version or disabled catalog entry", async () => {
    const h = harness();
    for (const props of [
      { classification: "financial" },
      { capability: { id: "wallet.balance.read", version: 2, enabled: true,
        executionClass: "read", argumentKeys: [] } },
      { capability: { id: "wallet.balance.read", version: 1, enabled: false,
        executionClass: "read", argumentKeys: [] } },
      { capability: { id: "wallet.balance.read", version: 1, enabled: true,
        executionClass: "financial", argumentKeys: [] } },
    ]) {
      await expect(run(h.service, action("wallet.balance.read", {}, props))).rejects.toMatchObject({
        code: "OPERATOR_NOT_QUALIFIED",
      });
    }
    expect(h.wallet.balance).not.toHaveBeenCalled();
  });

  it("rejects account switches, wrong session, and invalid Authorization", async () => {
    const h = harness();
    h.sessions.authorize.mockResolvedValueOnce({ ...identity,
      userId: "user_another" } as PlatformSessionIdentity);
    await expect(run(h.service, action("agents.directory.read"))).rejects.toMatchObject({
      code: "OPERATOR_UNAUTHORIZED" });
    h.bindSession.mockResolvedValueOnce(false);
    await expect(run(h.service, action("agents.directory.read"))).rejects.toMatchObject({
      code: "OPERATOR_UNAUTHORIZED" });
    await expect(run(h.service, action("agents.directory.read"), "not-bearer"))
      .rejects.toMatchObject({ code: "OPERATOR_UNAUTHORIZED" });
    expect(h.agents.list).not.toHaveBeenCalled();
  });

  it("fails on extra model fields, malicious contexts, wrong feed and unbounded arrays", async () => {
    const h = harness();
    const inputs = [
      action("wallet.balance.read", { role: "admin" }),
      action("talks.discover", { feed: "paid" }),
      action("talks.discover", { limit: 9999 }),
      action("talks.detail.read", { talkId: "talk_allowed" },
        { contextRef: { kind: "dm-selected-message", id: "talk_allowed" } }),
      action("agents.directory.read", {},
        { contextRef: { kind: "wallet", id: "wallet_1" } }),
    ];
    for (const a of inputs) {
      await expect(run(h.service, a)).rejects.toBeInstanceOf(U04ReadError);
    }
    expect(h.talks.list).not.toHaveBeenCalled();
    expect(h.wallet.balance).not.toHaveBeenCalled();
  });

  it("never claims a missing domain is available", async () => {
    const h = harness();
    const { wallet: _wallet, library: _library, ...deps } = h.deps;
    expect(availableU04ReadCapabilities(deps)).not.toContain("wallet.balance.read");
    await expect(run(createU04ReadService(deps), action("wallet.balance.read")))
      .rejects.toMatchObject({ code: "OPERATOR_NOT_QUALIFIED" });
  });

  it("suppresses private readback when the session is revoked during audit", async () => {
    const h = harness();
    h.append.mockImplementationOnce(async () => {
      h.bindSession.mockResolvedValueOnce(false);
    });
    await expect(run(h.service, action("wallet.balance.read")))
      .rejects.toMatchObject({ code: "OPERATOR_UNAUTHORIZED" });
    expect(h.wallet.balance).toHaveBeenCalledTimes(1);
    expect(h.append).toHaveBeenLastCalledWith(expect.objectContaining({
      status: "failed", code: "OPERATOR_UNAUTHORIZED",
    }));
  });

  it("bounds the final authorization check after audit and hides a switched tenant", async () => {
    const h = harness();
    h.append.mockImplementationOnce(async () => {
      h.sessions.authorize.mockResolvedValueOnce({ ...identity, tenantId: "tenant_B" } as PlatformSessionIdentity);
    });
    await expect(run(h.service, action("settings.profile.read")))
      .rejects.toMatchObject({ code: "OPERATOR_UNAUTHORIZED" });
    const slow = harness({ timeoutMs: 50 });
    slow.append.mockImplementationOnce(async () => {
      slow.sessions.authorize.mockImplementationOnce(() => new Promise<never>(() => {}));
    });
    await expect(run(slow.service, action("accounts.me.read")))
      .rejects.toMatchObject({ code: "OPERATOR_SOURCE_TIMEOUT" });
  });

  it("enforces durable quota and suppresses sensitive output when audit fails", async () => {
    const h = harness();
    h.consume.mockResolvedValueOnce(false);
    await expect(run(h.service, action("wallet.balance.read")))
      .rejects.toMatchObject({ code: "OPERATOR_RATE_LIMITED" });
    expect(h.wallet.balance).not.toHaveBeenCalled();
    h.append.mockRejectedValueOnce(new Error("database down"));
    await expect(run(h.service, action("wallet.balance.read")))
      .rejects.toMatchObject({ code: "OPERATOR_AUDIT_UNAVAILABLE" });
    expect(JSON.stringify(h.append.mock.calls)).not.toContain("1250");
  });

  it("classifies downstream failure, outage, denial, malformed balances and timeout", async () => {
    const h = harness();
    h.agents.list.mockRejectedValueOnce(new Error("internal secret/DB"));
    await expect(run(h.service, action("agents.directory.read")))
      .rejects.toMatchObject({ code: "OPERATOR_SOURCE_UNAVAILABLE" });
    h.agents.list.mockRejectedValueOnce({ statusCode: 403 });
    await expect(run(h.service, action("agents.directory.read")))
      .rejects.toMatchObject({ code: "OPERATOR_FORBIDDEN" });
    h.wallet.balance.mockResolvedValueOnce({ balanceKobo: Number.NaN, balance: "unknown" });
    await expect(run(h.service, action("wallet.balance.read")))
      .rejects.toMatchObject({ code: "OPERATOR_SOURCE_UNAVAILABLE" });
    const never = new Promise<never>(() => {});
    h.talks.list.mockImplementationOnce(() => never);
    const tight = createU04ReadService({ ...h.deps, timeoutMs: 50 });
    await expect(run(tight, action("talks.discover"))).rejects.toMatchObject({
      code: "OPERATOR_SOURCE_TIMEOUT" });
  });


  it("suppresses A's balance if access changes to B after a slow domain read", async () => {
    const h = harness();
    h.sessions.authorize.mockResolvedValueOnce(identity)
      .mockResolvedValueOnce({ ...identity, userId: "user_B" } as PlatformSessionIdentity);
    await expect(run(h.service, action("wallet.balance.read")))
      .rejects.toMatchObject({ code: "OPERATOR_UNAUTHORIZED" });
    expect(h.wallet.balance).toHaveBeenCalledTimes(1);
    expect(h.append).toHaveBeenCalledWith(expect.objectContaining({
      status: "failed", code: "OPERATOR_UNAUTHORIZED",
    }));
  });

  it("fails closed if audit, quota or identity reader stalls indefinitely", async () => {
    const never = new Promise<never>(() => {});
    const slowAuth = harness({ sessions: { authorize: () => never }, timeoutMs: 50 });
    await expect(run(slowAuth.service, action("accounts.me.read")))
      .rejects.toMatchObject({ code: "OPERATOR_SOURCE_TIMEOUT" });
    const slowQuota = harness({ quota: { consume: () => never }, timeoutMs: 50 });
    await expect(run(slowQuota.service, action("accounts.me.read")))
      .rejects.toMatchObject({ code: "OPERATOR_SOURCE_TIMEOUT" });
    const slowAudit = harness({ audit: { append: () => never }, timeoutMs: 50 });
    await expect(run(slowAudit.service, action("accounts.me.read")))
      .rejects.toMatchObject({ code: "OPERATOR_AUDIT_UNAVAILABLE" });
  });

  it("never converts unapproved write instructions to an operator tool call", () => {
    for (const capability of ["talks.create", "human.message.send",
      "billing.purchase.confirm", "crypto.transfer.confirm"]) {
      expect(() => requireU04WriteQualification(capability))
        .toThrowError("OPERATOR_NOT_QUALIFIED");
    }
  });
});

