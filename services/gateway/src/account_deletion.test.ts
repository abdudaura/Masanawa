import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import {
  openAccountDeletionRequest,
  transitionAccountDeletion,
  type AccountDeletionRequest,
  type AccountDeletionRepository,
  type AccountDeletionChallengeRepository,
} from "@masanawa/identity";
import type { PlatformCustomerSessionAuthorizer } from "./customer_auth.js";
import {
  createAccountDeletionService,
  type DeletionCodeSender,
} from "./account_deletion.js";
import { createGatewayApp } from "./app.js";

const tenantId = createCanonicalId("tenant");
const userId = createCanonicalId("user");
const otherUserId = createCanonicalId("user");
const beginAt = "2026-10-08T01:00:00.000Z";
const pepper = "A-long-server-side-deletion-purpose-pepper-0123456789";

function harness(options: { deliveryFails?: boolean; email?: boolean } = {}) {
  let currentAt = beginAt;
  let activeUser = userId;
  let record: AccountDeletionRequest | null = null;
  let challenge: {
    codeHash: string; userId: string; resendAfter: string;
    expiresAt: string; attempts: number; consumed: boolean;
  } | null = null;
  const deliveries: string[] = [];

  const sessions: PlatformCustomerSessionAuthorizer = {
    async authorize({ authorizationHeader }) {
      if (authorizationHeader !== "Bearer test-token") throw new Error("Unauthorized");
      return {
        tenantId,
        userId: activeUser,
        profile: {
          tenantId, userId: activeUser, name: "Test User", phone: "+2347010102053",
          email: options.email === false ? null : "test@example.com",
          locale: "en", createdAt: beginAt,
        },
      };
    },
  };
  const requests: AccountDeletionRepository = {
    async open(input) {
      if (input.userId !== userId && record) {
        // In production uniqueness is tenant/user-scoped.
        return openAccountDeletionRequest(input);
      }
      record ??= openAccountDeletionRequest(input);
      return record;
    },
    async read({ userId: requestedUser }) {
      return requestedUser === userId ? record : null;
    },
    async transition(input) {
      if (!record || input.userId !== userId) throw new Error("not_found");
      record = transitionAccountDeletion(record, input);
      return record;
    },
  };
  const challenges: AccountDeletionChallengeRepository = {
    async put(input) {
      if (challenge && !challenge.consumed &&
          Date.parse(challenge.resendAfter) > Date.parse(input.now)) {
        throw new Error("account_deletion.challenge_cooldown");
      }
      challenge = {
        codeHash: input.codeHash, userId: input.userId, resendAfter: input.resendAfter,
        expiresAt: input.expiresAt, attempts: 0, consumed: false,
      };
    },
    async consume(input) {
      if (!challenge || challenge.userId !== input.userId) return "missing";
      if (challenge.consumed || challenge.attempts >= 5) return "locked";
      if (Date.parse(challenge.expiresAt) <= Date.parse(input.now)) return "expired";
      if (challenge.codeHash !== input.codeHash) {
        challenge.attempts++;
        return challenge.attempts >= 5 ? "locked" : "invalid";
      }
      challenge.consumed = true;
      return "accepted";
    },
    async cancel(input) {
      if (challenge && challenge.userId === input.userId &&
          challenge.codeHash === input.codeHash) challenge = null;
    },
  };
  const sender: DeletionCodeSender = {
    async send({ code }) {
      if (options.deliveryFails) throw new Error("delivery unavailable");
      deliveries.push(code);
    },
  };
  const service = createAccountDeletionService({
    sessions, requests, challenges, otpPepper: pepper,
    ...(options.email === false ? { sms: sender } : { email: sender }),
    now: () => currentAt,
  });
  return {
    service, deliveries,
    setUser(user: typeof userId) { activeUser = user; },
    advance(ms: number) { currentAt = new Date(Date.parse(currentAt) + ms).toISOString(); },
    current() { return record; },
    challenge() { return challenge; },
  };
}
const auth = "Bearer test-token";

describe("R12 authenticated deletion intake", () => {
  it("requires signed-in ownership and never accepts caller-selected user IDs", async () => {
    const h = harness();
    await expect(h.service.request(undefined)).rejects.toMatchObject({
      code: "UNAUTHORIZED", statusCode: 401,
    });
    expect(await h.service.status(auth)).toBeNull();
    const created = await h.service.request(auth);
    expect(created.request.phase).toBe("requested");
    expect(created.verificationSent).toBe(true);
    h.setUser(otherUserId);
    expect(await h.service.status(auth)).toBeNull();
    await expect(h.service.verify({
      authorizationHeader: auth, code: h.deliveries[0]!,
    })).rejects.toMatchObject({ code: "ACCOUNT_DELETION_NOT_FOUND" });
  });

  it("is idempotent and throttles OTP sending", async () => {
    const h = harness();
    const first = await h.service.request(auth);
    await expect(h.service.request(auth)).rejects.toMatchObject({
      code: "ACCOUNT_DELETION_CODE_RATE_LIMITED", statusCode: 429,
    });
    h.advance(61_000);
    const again = await h.service.request(auth);
    expect(again.request.requestId).toBe(first.request.requestId);
    expect(h.deliveries).toHaveLength(2);
  });

  it("requires deletion-specific verification, not a client confirmation", async () => {
    const h = harness();
    await h.service.request(auth);
    await expect(h.service.verify({ authorizationHeader: auth, code: "abc" }))
      .rejects.toMatchObject({ code: "ACCOUNT_DELETION_CODE_INVALID" });
    await expect(h.service.verify({ authorizationHeader: auth, code: "000000" }))
      .rejects.toMatchObject({ code: "ACCOUNT_DELETION_CODE_INVALID" });
    const confirmed = await h.service.verify({
      authorizationHeader: auth, code: h.deliveries[0]!,
    });
    expect(confirmed.phase).toBe("identity-verified");
    expect(confirmed.phase).not.toBe("completed");
    expect(confirmed.revision).toBe(2);
    await expect(h.service.verify({
      authorizationHeader: auth, code: h.deliveries[0]!,
    })).rejects.toMatchObject({ code: "ACCOUNT_DELETION_ALREADY_VERIFIED" });
  });

  it("locks after five wrong attempts and never verifies a correct late code", async () => {
    const h = harness();
    await h.service.request(auth);
    const wrong = h.deliveries[0] === "000000" ? "111111" : "000000";
    for (let index = 0; index < 4; index++) {
      await expect(h.service.verify({
        authorizationHeader: auth, code: wrong,
      })).rejects.toMatchObject({ code: "ACCOUNT_DELETION_CODE_INVALID" });
    }
    await expect(h.service.verify({
      authorizationHeader: auth, code: wrong,
    })).rejects.toMatchObject({ code: "ACCOUNT_DELETION_CODE_LOCKED" });
    await expect(h.service.verify({
      authorizationHeader: auth, code: h.deliveries[0]!,
    })).rejects.toMatchObject({ code: "ACCOUNT_DELETION_CODE_LOCKED" });
    expect(h.current()?.phase).toBe("requested");
  });

  it("keeps the request durable if delivery fails, clearing only the challenge", async () => {
    const h = harness({ deliveryFails: true });
    await expect(h.service.request(auth)).rejects.toMatchObject({
      code: "ACCOUNT_DELETION_DELIVERY_UNAVAILABLE", statusCode: 503,
    });
    expect(h.current()?.phase).toBe("requested");
    expect(h.challenge()).toBeNull();
  });

  it("supports verified contact fallback over SMS", async () => {
    const h = harness({ email: false });
    const result = await h.service.request(auth);
    expect(result.verificationChannel).toBe("sms");
    expect(h.deliveries).toHaveLength(1);
  });

  it("exposes only authenticated request operations in HTTP", async () => {
    const h = harness();
    const app = createGatewayApp({ accountDeletion: h.service });
    try {
      const unauthenticated = await app.inject({ method: "GET", url: "/account/deletion" });
      expect(unauthenticated.statusCode).toBe(401);
      const invalidBody = await app.inject({
        method: "POST", url: "/account/deletion/request",
        headers: { authorization: auth }, payload: { userId: otherUserId },
      });
      expect(invalidBody.statusCode).toBe(400);
      const requested = await app.inject({
        method: "POST", url: "/account/deletion/request",
        headers: { authorization: auth }, payload: {},
      });
      expect(requested.statusCode).toBe(200);
      const verified = await app.inject({
        method: "POST", url: "/account/deletion/verify",
        headers: { authorization: auth },
        payload: { code: h.deliveries[0]! },
      });
      expect(verified.statusCode).toBe(200);
      expect(verified.json().request.phase).toBe("identity-verified");
    } finally {
      await app.close();
    }
  });
});
