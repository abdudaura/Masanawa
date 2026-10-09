import { describe, expect, it, vi } from "vitest";
import type { PlatformCustomerSessionAuthorizer } from "../customer_auth.js";
import type { TalkProfileService } from "../talk_profiles/service.js";
import { createInvitationService } from "./service.js";
import { issueInviteToken, readInviteToken } from "./token.js";

const secret = "test-only-not-production-" + "Q".repeat(48);
const clock = new Date("2026-10-08T12:00:00.000Z");
const seconds = Math.floor(clock.getTime() / 1000);

function setup() {
  const authorize = vi.fn(async () => ({ tenantId: "tenant_test", userId: "user_A" }));
  const self = vi.fn(async () => ({ handle: "public_a" }));
  const mayShare = vi.fn(async () => true);
  const mayResolve = vi.fn(async () => true);
  const consume = vi.fn(async () => true);
  const service = createInvitationService({
    authorizer: { authorize } as unknown as PlatformCustomerSessionAuthorizer,
    profiles: { self } as unknown as TalkProfileService,
    privacy: { mayShare, mayResolve },
    quota: { consume },
    secret,
    now: () => clock,
  });
  return { service, authorize, self, mayShare, mayResolve, consume };
}

describe("U23 signed invitations", () => {
  it("issues an authenticated 24-hour web link with no token or phone leakage", async () => {
    const { service, authorize, self, consume } = setup();
    const result = await service.create({ authorizationHeader: "Bearer private-token" });
    expect(result.url).toMatch(/^https:\/\/masanawa\.com\/invite\/[A-Za-z0-9_.-]+$/);
    expect(result.url).not.toContain("private-token");
    expect(result.url).not.toContain("tenant_test");
    expect(result.url).not.toContain("user_A");
    expect(result.expiresAt).toBe("2026-10-09T12:00:00.000Z");
    expect(authorize).toHaveBeenCalledOnce();
    expect(self).toHaveBeenCalledWith({ authorizationHeader: "Bearer private-token" });
    expect(consume).toHaveBeenCalledWith({
      tenantId: "tenant_test", userId: "user_A", now: clock,
    });
    await expect(service.resolve(result.url.split("/").pop()!))
      .resolves.toEqual({ suggestedHandle: "public_a" });
  });

  it("fails closed before quota charge when authentication or privacy fails", async () => {
    const { service, authorize, mayShare, consume } = setup();
    authorize.mockRejectedValueOnce(new Error("not authenticated"));
    await expect(service.create({ authorizationHeader: undefined })).rejects.toThrow();
    expect(consume).not.toHaveBeenCalled();
    mayShare.mockResolvedValueOnce(false);
    await expect(service.create({ authorizationHeader: "Bearer a" }))
      .rejects.toMatchObject({ code: "INVITE_NOT_AVAILABLE", statusCode: 403 });
    expect(consume).not.toHaveBeenCalled();
    consume.mockResolvedValueOnce(false);
    await expect(service.create({ authorizationHeader: "Bearer a" }))
      .rejects.toMatchObject({ code: "INVITE_RATE_LIMITED", statusCode: 429 });
  });

  it("rejects signature changes, expiration, future claims and the wrong key", () => {
    const token = issueInviteToken({
      secret, tenantId: "tenant_test", userId: "user_A",
      handle: "public_a", nowSeconds: seconds, ttlSeconds: 60,
    });
    expect(readInviteToken({ secret, token, nowSeconds: seconds })).not.toBeNull();
    expect(readInviteToken({ secret, token: token + "X", nowSeconds: seconds })).toBeNull();
    expect(readInviteToken({ secret, token: token.slice(1), nowSeconds: seconds })).toBeNull();
    expect(readInviteToken({ secret, token, nowSeconds: seconds + 60 })).toBeNull();
    expect(readInviteToken({ secret, token, nowSeconds: seconds - 8 * 86400 })).toBeNull();
    expect(readInviteToken({ secret: "different-".repeat(7), token, nowSeconds: seconds })).toBeNull();
    expect(readInviteToken({ secret, token: "!" + token, nowSeconds: seconds })).toBeNull();
  });

  it("reevaluates privacy on every resolve; never auto-accepts the contact", async () => {
    const { service, mayResolve } = setup();
    const link = await service.create({ authorizationHeader: "Bearer a" });
    const token = link.url.split("/").pop()!;
    mayResolve.mockResolvedValueOnce(false);
    await expect(service.resolve(token))
      .rejects.toMatchObject({ code: "INVITE_UNAVAILABLE", statusCode: 404 });
    await expect(service.resolve("garbage"))
      .rejects.toMatchObject({ code: "INVITE_UNAVAILABLE", statusCode: 404 });
  });

  it("rejects fabricated handles, weak secrets, oversized lifetimes", () => {
    expect(() => issueInviteToken({
      secret, tenantId: "tenant_test", userId: "user_A",
      handle: "bad?phone=123", nowSeconds: seconds,
    })).toThrow();
    expect(() => issueInviteToken({
      secret, tenantId: "tenant_test", userId: "user_A",
      handle: "public_a", nowSeconds: seconds, ttlSeconds: 8 * 86400,
    })).toThrow();
    expect(() => readInviteToken({ secret: "weak", token: "x", nowSeconds: seconds })).toThrow();
  });
});
