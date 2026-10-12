import Fastify from "fastify";
import { describe, it, expect, vi } from "vitest";
import {
  createIncomingCallService,
  type IncomingRepository,
  IncomingCallError,
} from "./service.js";
import { registerIncomingCallRoutes } from "./routes.js";
const call = {
  callId: "01999999-0000-7000-8000-000000000001",
  characterId: "character_01999999-0000-7000-8000-000000000001",
  displayName: "Amina",
  state: "ringing" as const,
  createdAt: "2026-10-12T00:00:00.000Z",
  expiresAt: "2026-10-12T00:01:00.000Z",
};
function harness() {
  const repository: IncomingRepository = {
    initiate: vi.fn(async () => call),
    get: vi.fn(async () => call),
    list: vi.fn(async () => [call]),
    transition: vi.fn(async () => call),
    expire: vi.fn(async () => {}),
    claimPush: vi.fn(async () => null),
    finishPush: vi.fn(async () => {}),
    claimToken: vi.fn(async () => true),
    finishToken: vi.fn(async () => {}),
  };
  const mint = vi.fn(async () => ({
    token: "test",
    websocketUrl: "wss://test",
    model: "test",
    voiceName: "test",
    expiresAt: call.expiresAt,
  }));
  const authorize = vi.fn(async () => ({
    tenantId: "tenant" as never,
    userId: "user" as never,
    characterIds: [call.characterId as never],
  }));
  const service = createIncomingCallService({
    repository,
    authorizer: { authorize },
    serverAuthorizer: {
      authorize: async (r) => {
        if (r.authorizationHeader !== "Bearer runtime")
          throw new IncomingCallError("incoming.server_denied", 403);
      },
    },
    liveVoiceTokens: { mint },
  });
  return { service, repository, mint, authorize };
}
describe("incoming authorization and explicit media", () => {
  it("denies consumer initiation before persistence", async () => {
    const h = harness();
    await expect(
      h.service.initiate({
        tenantId: "tenant",
        userId: "user",
        characterId: call.characterId,
        requestId: "r",
        authorizationHeader: "Bearer consumer",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(h.repository.initiate).not.toHaveBeenCalled();
  });
  it("does not mint before acceptance and propagates scoped actions", async () => {
    const h = harness();
    await expect(
      h.service.token({
        authorizationHeader: "Bearer consumer",
        callId: call.callId,
        admissionId: "paid",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(h.mint).not.toHaveBeenCalled();
    await expect(
      h.service.respond({ callId: call.callId, state: "accepted" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(h.repository.transition).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: "tenant",
        userId: "user",
        characterIds: [call.characterId],
      }),
    );
  });
  it("attaches accepted history and blocks simultaneous/repeated token claim", async () => {
    const h = harness();
    vi.mocked(h.repository.get).mockResolvedValue({
      ...call,
      state: "accepted",
    });
    await h.service.token({ callId: call.callId, admissionId: "paid" });
    expect(h.mint).toHaveBeenCalledWith(
      expect.objectContaining({
        historyCallId: call.callId,
        admissionId: "paid",
      }),
    );
    vi.mocked(h.repository.claimToken).mockResolvedValue(false);
    await expect(
      h.service.token({ callId: call.callId, admissionId: "paid" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(h.mint).toHaveBeenCalledTimes(1);
  });
  it("never releases a claim after minted token persistence fails", async () => {
    const h = harness();
    vi.mocked(h.repository.get).mockResolvedValue({
      ...call,
      state: "accepted",
    });
    vi.mocked(h.repository.finishToken).mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    await expect(
      h.service.token({ callId: call.callId, admissionId: "paid" }),
    ).rejects.toThrow("database unavailable");
    expect(h.repository.finishToken).toHaveBeenLastCalledWith(
      expect.objectContaining({ success: false, unknown: true }),
    );
    vi.mocked(h.repository.claimToken).mockResolvedValue(false);
    await expect(
      h.service.token({ callId: call.callId, admissionId: "paid" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(h.mint).toHaveBeenCalledTimes(1);
  });
  it("sweeps without push sender and retries delivery failure", async () => {
    const h = harness();
    await h.service.recover();
    expect(h.repository.expire).toHaveBeenCalled();
    expect(h.repository.claimPush).not.toHaveBeenCalled();
  });
  it("keeps push retryable when no installation is registered", async () => {
    const h = harness();
    vi.mocked(h.repository.claimPush).mockResolvedValue({
      tenantId: "tenant",
      userId: "user",
      call,
      leaseId: "lease",
    });
    const pushSender = {
      send: vi.fn(async () => ({ attempted: 0, delivered: 0 })),
    };
    const service = createIncomingCallService({
      repository: h.repository,
      authorizer: { authorize: h.authorize },
      serverAuthorizer: { authorize: async () => {} },
      liveVoiceTokens: { mint: h.mint },
      pushSender,
    });
    await service.recover();
    expect(h.repository.finishPush).toHaveBeenCalledWith({
      callId: call.callId,
      leaseId: "lease",
      delivered: false,
    });
    expect(pushSender.send).toHaveBeenCalledTimes(1);
  });
  it("HTTP wraps calls and rejects history injection", async () => {
    const h = harness();
    const app = Fastify();
    app.setErrorHandler((e, _r, reply) =>
      reply
        .code((e as IncomingCallError).statusCode ?? 500)
        .send({ code: (e as IncomingCallError).code }),
    );
    registerIncomingCallRoutes(app, h.service);
    const result = await app.inject({
      method: "GET",
      url: "/v1/calls/incoming/" + call.callId,
    });
    expect(result.json()).toEqual({ call });
    const injected = await app.inject({
      method: "POST",
      url: "/v1/calls/incoming/" + call.callId + "/token",
      payload: { admissionId: "paid", historyCallId: call.callId },
    });
    expect(injected.statusCode).toBe(400);
    expect(h.mint).not.toHaveBeenCalled();
    const denied = await app.inject({
      method: "POST",
      url: "/internal/calls/incoming",
      headers: { authorization: "Bearer consumer" },
      payload: {
        tenantId: "tenant",
        userId: "user",
        characterId: call.characterId,
        requestId: "r",
      },
    });
    expect(denied.statusCode).toBe(403);
    await app.close();
  });
});
