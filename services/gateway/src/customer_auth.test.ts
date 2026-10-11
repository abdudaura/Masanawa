import { describe, expect, it } from "vitest";
import { createCanonicalId, nowInstant } from "@masanawa/contracts";
import type {
  AgentPresentation,
  AgentPresentationRepository,
  CharacterSkillAssignmentRepository,
  PlatformAgentProfile,
  PlatformAgentProfileRepository,
} from "@masanawa/agents";
import type {
  UserRelationshipProvisioner,
  UserRelationshipReader,
} from "@masanawa/identity";
import type {
  OtpConsumeResult,
  PlatformAuthChannel,
  PlatformAuthProfile,
  PlatformSessionIdentity,
  PlatformSessionRepository,
} from "@masanawa/security";
import {
  createCustomerAuthService,
  createResendOtpDelivery,
  renderMasanawaOtpEmail,
  createPlatformCustomerAuthorizers,
  createPlatformCustomerSessionAuthorizer,
  createPlatformSessionFinancialAuthorizer,
  type OtpDelivery,
  type PlatformCustomerSessionAuthorizer,
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
  rejectNewSessions = false;
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
    if (this.rejectNewSessions) throw new Error("auth.account_inactive");
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
  passwords = new Map<string, { hash: string; attempts: number; locked: boolean }>();
  devices = new Map<string, Set<string>>();
  private passwordKey(tenantId: string, userId: string) {
    return `${tenantId}:${userId}`;
  }
  async setPasswordCredential(input: Parameters<PlatformSessionRepository["setPasswordCredential"]>[0]) {
    this.passwords.set(this.passwordKey(input.tenantId, input.userId), {
      hash: input.passwordHash,
      attempts: 0,
      locked: false,
    });
  }
  async verifyPasswordCredential(input: Parameters<PlatformSessionRepository["verifyPasswordCredential"]>[0]) {
    const row = this.passwords.get(this.passwordKey(input.tenantId, input.userId));
    if (!row) return "missing" as const;
    if (row.locked) return "locked" as const;
    if (row.hash !== input.passwordHash) {
      row.attempts += 1;
      if (row.attempts >= 5) {
        row.locked = true;
        return "locked" as const;
      }
      return "invalid" as const;
    }
    row.attempts = 0;
    return "accepted" as const;
  }
  async registerDevice(input: Parameters<PlatformSessionRepository["registerDevice"]>[0]) {
    const key = this.passwordKey(input.tenantId, input.userId);
    const set = this.devices.get(key) ?? new Set<string>();
    set.add(input.deviceId);
    this.devices.set(key, set);
  }
  async isDeviceKnown(input: Parameters<PlatformSessionRepository["isDeviceKnown"]>[0]) {
    return this.devices.get(this.passwordKey(input.tenantId, input.userId))?.has(input.deviceId) ?? false;
  }
  async attachIdentity(input: Parameters<PlatformSessionRepository["attachIdentity"]>[0]) {
    if (!this.profile || this.profile.userId !== input.userId) return null;
    this.profile = Object.freeze({
      ...this.profile,
      email: input.channel === "email" ? input.identifier : this.profile.email,
      phone: input.channel === "sms" ? input.identifier : this.profile.phone,
    });
    return this.profile;
  }
}

describe("platform-session Agent authorization", () => {
  it("admits platform support Characters and rejects an unrelated personal clone", async () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const supportId = createCanonicalId("character");
    const cloneId = createCanonicalId("character");
    const supportVersionId = createCanonicalId("character-version");
    const cloneVersionId = createCanonicalId("character-version");
    const relationshipId = createCanonicalId("relationship");

    const supportPresentation: AgentPresentation = {
      schemaVersion: 1,
      tenantId,
      characterId: supportId,
      characterVersionId: supportVersionId,
      displayName: "Gwani",
      roleLabel: "Support Agent",
      about: "Helps the user",
      greeting: "Hello",
      visibleInUserApp: true,
      sortOrder: 1,
      revision: 1,
    };
    const clonePresentation: AgentPresentation = {
      ...supportPresentation,
      characterId: cloneId,
      characterVersionId: cloneVersionId,
      displayName: "Another User",
      roleLabel: "Personal Clone",
      sortOrder: 2,
    };
    const supportProfile: PlatformAgentProfile = {
      schemaVersion: 1,
      tenantId,
      characterId: supportId,
      supportAgent: true,
      defaultForNewUsers: true,
      voiceProvider: "gemini",
      voiceName: "Bodi",
      revision: 1,
    };

    const sessions: PlatformCustomerSessionAuthorizer = {
      async authorize() {
        return Object.freeze({
          tenantId,
          userId,
          profile: Object.freeze({
            tenantId,
            userId,
            name: "Test User",
            email: "user@example.com",
            phone: null,
            locale: "en-NG",
            createdAt: "2026-10-05T00:00:00.000Z",
          }),
        });
      },
    };
    const presentations: AgentPresentationRepository = {
      async readForCharacter(input) {
        if (input.characterId === supportId) return supportPresentation;
        if (input.characterId === cloneId) return clonePresentation;
        return null;
      },
      async listAll() { return [supportPresentation, clonePresentation]; },
      async listVisible() { return [supportPresentation, clonePresentation]; },
      async put(input) { return input.presentation; },
    };
    const skillAssignments: CharacterSkillAssignmentRepository = {
      async readForCharacter() { return null; },
      async put(input) { return input.assignment; },
    };
    const relationships: UserRelationshipReader = {
      async readForUserCharacter() { return null; },
      async listForUser() { return []; },
    };
    const relationshipProvisioner: UserRelationshipProvisioner = {
      async getOrCreateForUserCharacter(input) {
        expect(input.characterId).toBe(supportId);
        return Object.freeze({
          tenantId,
          relationshipId,
          userId,
          characterId: supportId,
          state: "active" as const,
          stage: null,
          tone: null,
          preferences: Object.freeze({}),
          disclosures: Object.freeze({}),
          permissions: Object.freeze({}),
          revision: 1,
          createdAt: nowInstant(),
          updatedAt: nowInstant(),
        });
      },
    };
    const platformProfiles: PlatformAgentProfileRepository = {
      async readForCharacter(input) {
        return input.characterId === supportId ? supportProfile : null;
      },
      async listSupportAgents() { return [supportProfile]; },
      async put(input) { return input.profile; },
    };

    const authorizers = createPlatformCustomerAuthorizers({
      sessions,
      presentations,
      skillAssignments,
      relationships,
      relationshipProvisioner,
      platformProfiles,
      policyRevision: "production-v1",
    });

    const directory = await authorizers.directory.authorize({
      authorizationHeader: "Bearer session",
      capability: "agents.directory.read",
    });
    expect(directory.characterIds).toEqual([supportId]);

    const admitted = await authorizers.conversation.authorize({
      authorizationHeader: "Bearer session",
      characterId: supportId,
    });
    expect(admitted.scope.userId).toBe(userId);
    expect(admitted.scope.relationshipId).toBe(relationshipId);

    await expect(authorizers.conversation.authorize({
      authorizationHeader: "Bearer session",
      characterId: cloneId,
    })).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
  });



  it("admits a discoverable public Twin on first contact and blocks continued chat after a safety block", async () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const characterId = createCanonicalId("character");
    const characterVersionId = createCanonicalId("character-version");
    const relationshipId = createCanonicalId("relationship");
    let relationship: Awaited<ReturnType<UserRelationshipReader["readForUserCharacter"]>> = null;
    let blocked = false;

    const sessions: PlatformCustomerSessionAuthorizer = {
      async authorize() {
        return Object.freeze({
          tenantId,
          userId,
          profile: Object.freeze({
            tenantId,
            userId,
            name: "Visitor",
            email: "visitor@example.com",
            phone: null,
            locale: "en-NG",
            createdAt: "2026-10-05T00:00:00.000Z",
          }),
        });
      },
    };
    const presentation: AgentPresentation = {
      schemaVersion: 1,
      tenantId,
      characterId,
      characterVersionId,
      displayName: "Public Twin",
      roleLabel: "AI twin",
      about: "Public twin",
      greeting: null,
      visibleInUserApp: true,
      sortOrder: 10,
      revision: 1,
    };

    const authorizers = createPlatformCustomerAuthorizers({
      sessions,
      presentations: {
        async readForCharacter(input) {
          return input.characterId === characterId ? presentation : null;
        },
        async listAll() { return [presentation]; },
        async listVisible() { return [presentation]; },
        async put(input) { return input.presentation; },
      },
      skillAssignments: {
        async readForCharacter() { return null; },
        async put(input) { return input.assignment; },
      },
      relationships: {
        async readForUserCharacter() { return relationship; },
        async listForUser() { return relationship ? [relationship] : []; },
      },
      relationshipProvisioner: {
        async getOrCreateForUserCharacter(input) {
          relationship = Object.freeze({
            tenantId,
            relationshipId,
            userId,
            characterId: input.characterId,
            state: "active" as const,
            stage: null,
            tone: null,
            preferences: Object.freeze({}),
            disclosures: Object.freeze({}),
            permissions: Object.freeze({}),
            revision: 1,
            createdAt: nowInstant(),
            updatedAt: nowInstant(),
          });
          return relationship;
        },
      },
      platformProfiles: {
        async readForCharacter() { return null; },
        async listSupportAgents() { return []; },
        async put(input) { return input.profile; },
      },
      publicTwinAdmission: {
        async canChat(input) {
          expect(input.characterId).toBe(characterId);
          return !blocked;
        },
        async canContinue(input) {
          expect(input.characterId).toBe(characterId);
          return !blocked;
        },
      },
      policyRevision: "production-v1",
    });

    await expect(authorizers.conversation.authorize({
      authorizationHeader: "Bearer session",
      characterId,
    })).resolves.toMatchObject({
      scope: { tenantId, userId, characterId, relationshipId },
    });
    expect(relationship).not.toBeNull();

    blocked = true;
    await expect(authorizers.conversation.authorize({
      authorizationHeader: "Bearer session",
      characterId,
    })).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
  });

  it("maps a rejected platform session to a mobile 401", async () => {
    const tenantId = createCanonicalId("tenant");
    const sessions: PlatformCustomerSessionAuthorizer = {
      async authorize() {
        throw new Error("financial.auth.unauthorized");
      },
    };
    const authorizers = createPlatformCustomerAuthorizers({
      sessions,
      presentations: {
        async readForCharacter() { return null; },
        async listAll() { return []; },
        async listVisible() { return []; },
        async put(input) { return input.presentation; },
      },
      skillAssignments: {
        async readForCharacter() { return null; },
        async put(input) { return input.assignment; },
      },
      relationships: {
        async readForUserCharacter() { return null; },
        async listForUser() { return []; },
      },
      relationshipProvisioner: {
        async getOrCreateForUserCharacter() {
          throw new Error("must not provision without a valid session");
        },
      },
      platformProfiles: {
        async readForCharacter() { return null; },
        async listSupportAgents() { return []; },
        async put(input) { return input.profile; },
      },
      policyRevision: "production-v1",
    });

    await expect(authorizers.directory.authorize({
      authorizationHeader: "Bearer bad",
      capability: "agents.directory.read",
    })).rejects.toMatchObject({ code: "UNAUTHORIZED", statusCode: 401 });
    expect(tenantId).toBeTruthy();
  });
});

describe("customer authentication", () => {
  it("reports session storage outages as retryable availability failures", async () => {
    const repository = new MemorySessions();
    repository.resolveAccess = async () => { throw new Error("private database credential"); };
    const sessions = createPlatformCustomerSessionAuthorizer({ repository });
    await expect(sessions.authorize({ authorizationHeader: `Bearer msw_access_${"a".repeat(64)}` }))
      .rejects.toMatchObject({ code: "AUTH_UNAVAILABLE", statusCode: 503, message: "AUTH_UNAVAILABLE" });
    await expect(sessions.authorize({ authorizationHeader: undefined }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED", statusCode: 401 });
  });

  it("returns a forbidden inactive-account state instead of issuing unusable session tokens", async () => {
    const repository = new MemorySessions();
    repository.rejectNewSessions = true;
    let code = "";
    const service = createCustomerAuthService({
      repository,
      tenantId: createCanonicalId("tenant"),
      otpPepper: "p".repeat(48),
      emailDelivery: { async send(input) { code = input.code; } },
    });
    await service.sendOtp({ email: "inactive@example.com" });
    await expect(service.verifyOtp({
      email: "inactive@example.com",
      code,
      name: "Inactive Customer",
    })).rejects.toMatchObject({
      code: "ACCOUNT_INACTIVE",
      statusCode: 403,
    });
    expect(repository.sessions.size).toBe(0);
  });

  it("advertises only OTP channels that are actually configured", () => {
    const repository = new MemorySessions();
    const service = createCustomerAuthService({
      repository,
      tenantId: createCanonicalId("tenant"),
      otpPepper: "p".repeat(48),
      emailDelivery: { async send() {} },
    });
    expect(service.capabilities()).toEqual({
      otpChannels: ["email"],
    });
  });

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
      isNewUser: false,
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
    })).rejects.toMatchObject({ code: "UNAUTHORIZED", statusCode: 401 });
    await expect(customer.authorize({
      authorizationHeader: `Bearer ${rotated.accessToken}`,
    })).resolves.toMatchObject({ tenantId });

    await service.logout({ authorizationHeader: `Bearer ${rotated.accessToken}` });
    await expect(customer.authorize({
      authorizationHeader: `Bearer ${rotated.accessToken}`,
    })).rejects.toMatchObject({ code: "UNAUTHORIZED", statusCode: 401 });
  });

  it("renders and sends a branded Masanawa OTP email", async () => {
    const rendered = renderMasanawaOtpEmail("123456");
    expect(rendered.subject).toBe("Your Masanawa sign-in code");
    expect(rendered.text).toContain("123456");
    expect(rendered.html).toContain("Masanawa");
    expect(rendered.html).toContain("123456");
    expect(rendered.html).toContain("#0121D2");
    expect(rendered.html).toContain("#1DA4FD");
    expect(rendered.html).toContain("Security note");

    let payload: Record<string, unknown> | null = null;
    const delivery = createResendOtpDelivery({
      apiKey: "test-key",
      from: "Masanawa <no-reply@example.test>",
      fetchImpl: async (_url, init) => {
        payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(null, { status: 202 });
      },
    });

    await delivery.send({
      identifier: "user@example.test",
      code: "123456",
    });

    expect(payload).toMatchObject({
      from: "Masanawa <no-reply@example.test>",
      to: ["user@example.test"],
      subject: "Your Masanawa sign-in code",
      text: expect.stringContaining("123456"),
      html: expect.stringContaining("123456"),
      tags: [{ name: "category", value: "authentication_otp" }],
    });
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

describe("customer password authentication", () => {
  const deviceId = "a".repeat(32);
  const otherDevice = "b".repeat(32);

  function service(repository: MemorySessions) {
    return createCustomerAuthService({
      repository,
      tenantId: createCanonicalId("tenant"),
      otpPepper: "p".repeat(48),
      emailDelivery: { async send() {} },
    });
  }

  it("runs setup, status, restore and verify as one loop", async () => {
    const repository = new MemorySessions();
    const auth = service(repository);
    const phone = "+2348012345678";
    await expect(auth.accountStatus({ phone, deviceId }))
      .resolves.toEqual({ registered: false, deviceKnown: false });
    const created = await auth.passwordSetup({
      phone,
      deviceId,
      password: "123456",
      name: "Amina",
    });
    expect(created.user).toMatchObject({
      name: "Amina",
      phone,
      isNewUser: true,
    });
    await expect(auth.accountStatus({ phone, deviceId }))
      .resolves.toEqual({ registered: true, deviceKnown: true });
    await expect(auth.accountStatus({ phone, deviceId: otherDevice }))
      .resolves.toEqual({ registered: true, deviceKnown: false });
    const restored = await auth.deviceRestore({ phone, deviceId });
    expect(restored.user.phone).toBe(phone);
    const verified = await auth.passwordVerify({
      phone,
      deviceId: otherDevice,
      password: "123456",
    });
    expect(verified.user.phone).toBe(phone);
    await expect(auth.accountStatus({ phone, deviceId: otherDevice }))
      .resolves.toEqual({ registered: true, deviceKnown: true });
  });

  it("locks after five wrong passwords and keeps the right one out", async () => {
    const repository = new MemorySessions();
    const auth = service(repository);
    const phone = "+2348012345678";
    await auth.passwordSetup({ phone, deviceId, password: "123456", name: "Amina" });
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(auth.passwordVerify({ phone, deviceId, password: "000000" }))
        .rejects.toMatchObject({ code: "PASSWORD_INVALID", statusCode: 400 });
    }
    await expect(auth.passwordVerify({ phone, deviceId, password: "000000" }))
      .rejects.toMatchObject({ code: "PASSWORD_LOCKED", statusCode: 429 });
    await expect(auth.passwordVerify({ phone, deviceId, password: "123456" }))
      .rejects.toMatchObject({ code: "PASSWORD_LOCKED", statusCode: 429 });
  });

  it("rejects unknown phones, duplicate setup and bad input", async () => {
    const repository = new MemorySessions();
    const auth = service(repository);
    const phone = "+2348012345678";
    await expect(auth.passwordVerify({ phone, deviceId, password: "123456" }))
      .rejects.toMatchObject({ code: "ACCOUNT_NOT_FOUND", statusCode: 404 });
    await auth.passwordSetup({ phone, deviceId, password: "123456", name: "Amina" });
    await expect(auth.passwordSetup({ phone, deviceId, password: "123456", name: "Amina" }))
      .rejects.toMatchObject({ code: "ACCOUNT_EXISTS", statusCode: 409 });
    await expect(auth.passwordSetup({ phone, deviceId, password: "12", name: "Amina" }))
      .rejects.toMatchObject({ code: "VALIDATION_FAILED", statusCode: 400 });
    await expect(auth.passwordVerify({ phone: "not-a-phone", deviceId, password: "123456" }))
      .rejects.toMatchObject({ code: "VALIDATION_FAILED", statusCode: 400 });
    await expect(auth.accountStatus({ phone, deviceId: "short" }))
      .rejects.toMatchObject({ code: "VALIDATION_FAILED", statusCode: 400 });
  });

  it("attaches the optional email identity at setup", async () => {
    const repository = new MemorySessions();
    const auth = service(repository);
    const created = await auth.passwordSetup({
      phone: "+2348012345678",
      deviceId,
      password: "123456",
      name: "Amina",
      email: "amina@example.com",
    });
    expect(created.user).toMatchObject({
      phone: "+2348012345678",
      email: "amina@example.com",
    });
  });

  it("routes registered numbers without a password to setup", async () => {
    const repository = new MemorySessions();
    const auth = service(repository);
    const tenantId = createCanonicalId("tenant");
    const local = createCustomerAuthService({
      repository,
      tenantId,
      otpPepper: "p".repeat(48),
      emailDelivery: { async send() {} },
    });
    await local.passwordSetup({
      phone: "+2348012345678",
      deviceId,
      password: "123456",
      name: "Amina",
    });
    // Simulate a legacy OTP-created account: profile exists, no credential.
    repository.passwords.clear();
    await expect(auth.passwordVerify({
      phone: "+2348012345678",
      deviceId,
      password: "123456",
    })).rejects.toMatchObject({ code: "PASSWORD_NOT_SET", statusCode: 409 });
  });
});

