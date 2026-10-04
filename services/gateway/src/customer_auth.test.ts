import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import type {
  OtpConsumeResult,
  PlatformAuthChannel,
  PlatformAuthProfile,
  PlatformSessionIdentity,
  PlatformSessionRepository,
} from "@masanawa/security";
import {
  createCustomerAuthService,
  createPlatformCustomerSessionAuthorizer,
  createPlatformSessionFinancialAuthorizer,
  type OtpDelivery,
} from "./customer_auth.js";

class MemorySessions implements PlatformSessionRepository {
  challenge: {
    tenantId: string;
    channel: PlatformAuthChannel;
    identifier: string;
    codeHash: string;
    expiresAt: string;
    maxAttempts: number;
    attempts: number;
    consumed: boolean;
  } | null = null;
  profile: PlatformAuthProfile | null = null;
  sessions = new Map<string, {
    identity: PlatformSessionIdentity;
    refreshHash: string;
    accessExpiresAt: string;
    refreshExpiresAt: string;
    revoked: boolean;
  }>();

  async putOtpChallenge(input: Parameters<PlatformSessionRepository["putOtpChallenge"]>[0]) {
    this.challenge = { ...input, attempts: 0, consumed: false };
  }
  async cancelOtpChallenge(input: Parameters<PlatformSessionRepository["cancelOtpChallenge"]>[0]) {
    if (this.challenge?.codeHash === input.codeHash) this.challenge = null;
  }
  async consumeOtpChallenge(input: Parameters<PlatformSessionRepository["consumeOtpChallenge"]>[0]): Promise<OtpConsumeResult> {
    const current = this.challenge;
    if (!current) return "missing";
    if (current.consumed || current.attempts >= current.maxAttempts) return "locked";
    if (Date.parse(current.expiresAt) <= Date.parse(input.consumedAt)) return "expired";
    if (current.codeHash !== input.codeHash) {
      current.attempts += 1;
      return current.attempts >= current.maxAttempts ? "locked" : "invalid";
    }
    if (input.consume !== false) current.consumed = true;
    return "accepted";
  }
  async resolveProfile() { return this.profile; }
  async createProfile(input: Parameters<PlatformSessionRepository["createProfile"]>[0]) {
    this.profile = Object.freeze({
      tenantId: input.tenantId,
      userId: createCanonicalId("user"),
      name: input.name,
      email: input.channel === "email" ? input.identifier : null,
      phone: input.channel === "sms" ? input.identifier : null,
      locale: input.locale,
      createdAt: input.createdAt,
    });
    return this.profile;
  }
  async issueSession(input: Parameters<PlatformSessionRepository["issueSession"]>[0]) {
    this.sessions.set(input.accessHash, {
      identity: input.identity,
      refreshHash: input.refreshHash,
      accessExpiresAt: input.accessExpiresAt,
      refreshExpiresAt: input.refreshExpiresAt,
      revoked: false,
    });
  }
  async resolveAccess(input: Parameters<PlatformSessionRepository["resolveAccess"]>[0]) {
    const row = this.sessions.get(input.accessHash);
    if (!row || row.revoked || Date.parse(row.accessExpiresAt) <= Date.parse(input.at)) return null;
    return row.identity;
  }
  async rotateRefresh(input: Parameters<PlatformSessionRepository["rotateRefresh"]>[0]) {
    const old = [...this.sessions.entries()].find(([, row]) =>
      row.refreshHash === input.refreshHash && !row.revoked &&
      Date.parse(row.refreshExpiresAt) > Date.parse(input.rotatedAt));
    if (!old) return null;
    const [oldAccess, row] = old;
    this.sessions.delete(oldAccess);
    this.sessions.set(input.nextAccessHash, {
      identity: row.identity,
      refreshHash: input.nextRefreshHash,
      accessExpiresAt: input.accessExpiresAt,
      refreshExpiresAt: input.refreshExpiresAt,
      revoked: false,
    });
    return row.identity;
  }
  async revokeAccess(input: Parameters<PlatformSessionRepository["revokeAccess"]>[0]) {
    const row = this.sessions.get(input.accessHash);
    if (row) row.revoked = true;
  }
}

describe("customer authentication", () => {
  it("keeps a verified OTP usable for the mobile name-capture retry", async () => {
    const repository = new MemorySessions();
    let code = "";
    const delivery: OtpDelivery = {
      async send(input) { code = input.code; },
    };
    const tenantId = createCanonicalId("tenant");
    const service = createCustomerAuthService({
      repository,
      tenantId,
      otpPepper: "p".repeat(48),
      emailDelivery: delivery,
      now: (() => {
        let tick = 0;
        return () => new Date(Date.parse("2026-10-04T20:00:00Z") + tick++ * 1000).toISOString();
      })(),
    });

    await expect(service.sendOtp({ email: "User@example.com" })).resolves.toMatchObject({
      email: "user@example.com",
    });
    expect(code).toMatch(/^\d{6}$/u);

    await expect(service.verifyOtp({
      email: "user@example.com",
      code,
    })).rejects.toMatchObject({ code: "NAME_REQUIRED_ON_SIGNUP" });

    const signedIn = await service.verifyOtp({
      email: "user@example.com",
      code,
      name: "Amina",
    });
    expect(signedIn.user).toMatchObject({
      name: "Amina",
      email: "user@example.com",
      isNewUser: true,
    });

    const authorizationNow = () => "2026-10-04T20:00:10.000Z";
    const customer = createPlatformCustomerSessionAuthorizer({ repository, now: authorizationNow });
    const financial = createPlatformSessionFinancialAuthorizer({ repository, now: authorizationNow });
    await expect(customer.authorize({
      authorizationHeader: `Bearer ${signedIn.accessToken}`,
    })).resolves.toMatchObject({ tenantId, profile: { name: "Amina" } });
    await expect(financial.authorize({
      authorizationHeader: `Bearer ${signedIn.accessToken}`,
    })).resolves.toMatchObject({ tenantId });

    const rotated = await service.refresh({ refreshToken: signedIn.refreshToken });
    await expect(customer.authorize({
      authorizationHeader: `Bearer ${signedIn.accessToken}`,
    })).rejects.toThrow("financial.auth.unauthorized");
    await expect(customer.authorize({
      authorizationHeader: `Bearer ${rotated.accessToken}`,
    })).resolves.toMatchObject({ tenantId });

    await service.logout({ authorizationHeader: `Bearer ${rotated.accessToken}` });
    await expect(customer.authorize({
      authorizationHeader: `Bearer ${rotated.accessToken}`,
    })).rejects.toThrow("financial.auth.unauthorized");
  });

  it("removes a challenge when delivery fails instead of accepting an unseen OTP", async () => {
    const repository = new MemorySessions();
    const service = createCustomerAuthService({
      repository,
      tenantId: createCanonicalId("tenant"),
      otpPepper: "p".repeat(48),
      emailDelivery: { async send() { throw new Error("provider down"); } },
    });
    await expect(service.sendOtp({ email: "user@example.com" }))
      .rejects.toMatchObject({ code: "OTP_DELIVERY_UNAVAILABLE" });
    expect(repository.challenge).toBeNull();
  });
});
