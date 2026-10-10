import { describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import type { PlatformAuthProfile, PlatformSessionRepository } from "@masanawa/security";
import {
  createPhonePasswordAuthService,
  type PhonePasswordCredentialRepository,
} from "./phone_password.js";
import { verifyNumericPassword } from "./phone_password_policy.js";

const pepper = "p".repeat(48);
const tenantId = createCanonicalId("tenant");
const phone = "+2348012345678";
const password = "80469127";

function fixture() {
  let issued = 0;
  let storedHash: string | null = null;
  let user: PlatformAuthProfile | null = null;
  let locked = false;
  let outage = false;
  const credentials: PhonePasswordCredentialRepository = {
    async register(request) {
      if (storedHash) throw new Error("auth.phone.duplicate");
      storedHash = request.passwordHash;
      user = Object.freeze({
        tenantId, userId: createCanonicalId("user"), phone: request.phone, email: null,
        name: request.name, locale: request.locale, createdAt: request.at,
      });
      return user;
    },
    async authenticate(request) {
      if (outage) throw new Error("private connection failed");
      if (locked) throw new Error("auth.phone.locked");
      const match = await request.verify(storedHash);
      return match ? user : null;
    },
  };
  const sessions = {
    async issueSession() { issued++; },
  } as unknown as PlatformSessionRepository;
  const service = createPhonePasswordAuthService({
    credentials, sessions, tenantId, pepper, now: () => "2026-10-10T00:00:00.000Z",
  });
  return {
    credentials, service,
    issued: () => issued,
    hash: () => storedHash,
    lock: () => { locked = true; },
    fail: () => { outage = true; },
  };
}

describe("AF08 phone numeric-password account (no phone ownership proof)", () => {
  it("persists one account credential and issues the canonical session with unverified phone", async () => {
    const f = fixture();
    const created = await f.service.register({ phone, password, name: "First User" });
    expect(created.user).toMatchObject({ name: "First User", phone, email: null, phoneVerified: false });
    expect(f.hash()).toMatch(/^scrypt:v1:/);
    expect(f.hash()).not.toContain(password);
    expect(f.issued()).toBe(1);
    await expect(f.service.login({ phone, password })).resolves.toMatchObject({
      user: { phone, phoneVerified: false },
    });
    expect(f.issued()).toBe(2);
    expect(await verifyNumericPassword(password, f.hash(), pepper)).toBe(true);
  });

  it("rejects predictable, short and nonnumeric PINs before writing or issuing a session", async () => {
    const f = fixture();
    for (const wrong of ["12345678", "00000000", "1234", "1234567890", "letters"]) {
      await expect(f.service.register({ phone, password: wrong, name: "User" }))
        .rejects.toMatchObject({ code: "PASSWORD_INVALID", statusCode: 400 });
    }
    expect(f.issued()).toBe(0);
    expect(f.hash()).toBeNull();
  });

  it("rejects duplicate phone signup and never silently upgrades OTP-linked identity", async () => {
    const f = fixture();
    await f.service.register({ phone, password, name: "First" });
    await expect(f.service.register({ phone, password: "94681270", name: "Second" }))
      .rejects.toMatchObject({ code: "PHONE_ALREADY_REGISTERED", statusCode: 409 });
    expect(f.issued()).toBe(1);
  });

  it("does not mint sessions for unknown or invalid credentials", async () => {
    const f = fixture();
    await expect(f.service.login({ phone, password }))
      .rejects.toMatchObject({ code: "INVALID_CREDENTIALS", statusCode: 401 });
    await f.service.register({ phone, password, name: "First" });
    await expect(f.service.login({ phone, password: "94681270" }))
      .rejects.toMatchObject({ code: "INVALID_CREDENTIALS", statusCode: 401 });
    expect(f.issued()).toBe(1);
  });

  it("maps storage outages and repository lockout to sanitized retryable errors", async () => {
    const f = fixture();
    await f.service.register({ phone, password, name: "First" });
    f.fail();
    await expect(f.service.login({ phone, password }))
      .rejects.toMatchObject({ code: "AUTH_UNAVAILABLE", statusCode: 503 });
    const another = fixture();
    await another.service.register({ phone, password, name: "First" });
    another.lock();
    await expect(another.service.login({ phone, password }))
      .rejects.toMatchObject({ code: "PASSWORD_RATE_LIMITED", statusCode: 429 });
  });
});
