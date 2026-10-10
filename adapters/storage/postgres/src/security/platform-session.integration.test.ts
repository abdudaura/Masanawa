import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import {
  hashOtpCode,
  hashPlatformSessionToken,
  mintPlatformSessionToken,
} from "@masanawa/security";
import { runMigrations } from "../migrations.js";
import { createPostgresPlatformSessionRepository } from "./platform-session.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("customer platform sessions PostgreSQL acceptance", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    await runMigrations(pool, [
      {
        owner: "events",
        directory: fileURLToPath(
          new URL("../../../../../packages/events/migrations", import.meta.url),
        ),
      },
      {
        owner: "security",
        directory: fileURLToPath(
          new URL("../../../../../packages/security/migrations", import.meta.url),
        ),
      },
      {
        owner: "identity",
        directory: fileURLToPath(
          new URL("../../../../../packages/identity/migrations", import.meta.url),
        ),
      },
    ]);
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("applies Security before Identity cleanly and provisions canonical identity on first profile", async () => {
    const repository = createPostgresPlatformSessionRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const createdAt = new Date().toISOString();

    const [left, right] = await Promise.all([
      repository.createProfile({
        tenantId,
        channel: "email",
        identifier: `customer-${tenantId.slice(-8)}@example.com`,
        name: "Customer",
        locale: "en-NG",
        createdAt,
      }),
      repository.createProfile({
        tenantId,
        channel: "email",
        identifier: `customer-${tenantId.slice(-8)}@example.com`,
        name: "Customer",
        locale: "en-NG",
        createdAt,
      }),
    ]);

    expect(left.userId).toBe(right.userId);
    await expect(repository.resolveProfile({
      tenantId,
      channel: "email",
      identifier: left.email!,
      observedAt: new Date().toISOString(),
    })).resolves.toEqual(left);

    const identityRows = await pool.query<{ tenants: string; users: string }>(
      `SELECT
         (SELECT count(*)::text FROM identity.tenants WHERE tenant_id=$1) AS tenants,
         (SELECT count(*)::text FROM identity.users WHERE tenant_id=$1 AND user_id=$2) AS users`,
      [tenantId,left.userId],
    );
    expect(identityRows.rows[0]).toEqual({ tenants: "1", users: "1" });
  });

  it("admits multiple email-only and SMS-only users while contacts remain unique per tenant", async () => {
    const repository = createPostgresPlatformSessionRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const createdAt = new Date().toISOString();
    const people = await Promise.all([
      repository.createProfile({
        tenantId, channel: "email", identifier: `nullable-a-${tenantId.slice(-8)}@example.com`,
        name: "Email Customer A", locale: "en-NG", createdAt,
      }),
      repository.createProfile({
        tenantId, channel: "email", identifier: `nullable-b-${tenantId.slice(-8)}@example.com`,
        name: "Email Customer B", locale: "en-NG", createdAt,
      }),
      repository.createProfile({
        tenantId, channel: "sms", identifier: "+2348012345601",
        name: "Phone Customer A", locale: "en-NG", createdAt,
      }),
      repository.createProfile({
        tenantId, channel: "sms", identifier: "+2348012345602",
        name: "Phone Customer B", locale: "en-NG", createdAt,
      }),
    ]);
    expect(new Set(people.map((profile) => profile.userId)).size).toBe(4);
    expect(people.slice(0, 2).map((profile) => profile.phone)).toEqual([null, null]);
    expect(people.slice(2).map((profile) => profile.email)).toEqual([null, null]);

    const total = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM security.platform_user_profiles WHERE tenant_id=$1`,
      [tenantId],
    );
    expect(total.rows[0]?.count).toBe("4");

    // Real contact values must remain unique even though missing values are allowed.
    for (const [email, phone] of [
      [people[0]!.email, null],
      [null, people[2]!.phone],
    ] as const) {
      await expect(pool.query(
        `INSERT INTO security.platform_user_profiles
           (tenant_id,user_id,display_name,email,phone,locale,created_at,updated_at)
         VALUES ($1,$2,'Duplicate',$3,$4,'en-NG',$5,$5)`,
        [tenantId,createCanonicalId("user"),email,phone,createdAt],
      )).rejects.toMatchObject({ code: "23505" });
    }
  });

  it("bounds OTP attempts and stores only the HMAC evidence", async () => {
    const repository = createPostgresPlatformSessionRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const identifier = `otp-${tenantId.slice(-8)}@example.com`;
    const pepper = "p".repeat(48);
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.parse(createdAt) + 10 * 60_000).toISOString();
    const resendAfter = new Date(Date.parse(createdAt) + 60_000).toISOString();
    const correct = hashOtpCode({
      pepper,tenantId,channel: "email",identifier,code: "123456",
    });
    const wrong = hashOtpCode({
      pepper,tenantId,channel: "email",identifier,code: "654321",
    });

    await repository.putOtpChallenge({
      tenantId,channel: "email",identifier,codeHash: correct,
      createdAt,expiresAt,resendAfter,maxAttempts: 2,
    });
    await expect(repository.putOtpChallenge({
      tenantId,channel: "email",identifier,codeHash: correct,
      createdAt:new Date(Date.parse(createdAt)+1000).toISOString(),
      expiresAt,resendAfter,maxAttempts:2,
    })).rejects.toThrow("auth.otp.cooldown");

    await expect(repository.consumeOtpChallenge({
      tenantId,channel:"email",identifier,codeHash:wrong,
      consumedAt:new Date(Date.parse(createdAt)+2000).toISOString(),
    })).resolves.toBe("invalid");
    await expect(repository.consumeOtpChallenge({
      tenantId,channel:"email",identifier,codeHash:wrong,
      consumedAt:new Date(Date.parse(createdAt)+3000).toISOString(),
    })).resolves.toBe("locked");
    await expect(repository.consumeOtpChallenge({
      tenantId,channel:"email",identifier,codeHash:correct,
      consumedAt:new Date(Date.parse(createdAt)+4000).toISOString(),
    })).resolves.toBe("locked");

    const row = await pool.query<{ code_hash: string }>(
      `SELECT code_hash FROM security.platform_otp_challenges
        WHERE tenant_id=$1 AND channel='email' AND identifier=$2`,
      [tenantId,identifier],
    );
    expect(row.rows[0]?.code_hash).toBe(correct);
    expect(row.rows[0]?.code_hash).not.toContain("123456");
  });

  it("supports validate-without-consume for name capture and then consumes exactly once", async () => {
    const repository = createPostgresPlatformSessionRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const identifier = `signup-${tenantId.slice(-8)}@example.com`;
    const createdAt = new Date().toISOString();
    const codeHash = "a".repeat(64);
    await repository.putOtpChallenge({
      tenantId,channel:"email",identifier,codeHash,
      createdAt,
      expiresAt:new Date(Date.parse(createdAt)+600_000).toISOString(),
      resendAfter:new Date(Date.parse(createdAt)+60_000).toISOString(),
      maxAttempts:5,
    });

    await expect(repository.consumeOtpChallenge({
      tenantId,channel:"email",identifier,codeHash,
      consumedAt:new Date(Date.parse(createdAt)+1000).toISOString(),
      consume:false,
    })).resolves.toBe("accepted");

    await expect(repository.consumeOtpChallenge({
      tenantId,channel:"email",identifier,codeHash,
      consumedAt:new Date(Date.parse(createdAt)+2000).toISOString(),
    })).resolves.toBe("accepted");

    await expect(repository.consumeOtpChallenge({
      tenantId,channel:"email",identifier,codeHash,
      consumedAt:new Date(Date.parse(createdAt)+3000).toISOString(),
    })).resolves.toBe("locked");
  });

  it("rotates refresh credentials atomically and revokes logout access", async () => {
    const repository = createPostgresPlatformSessionRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const createdAt = new Date().toISOString();
    const profile = await repository.createProfile({
      tenantId,
      channel:"email",
      identifier:`session-${tenantId.slice(-8)}@example.com`,
      name:"Session Customer",
      locale:"en-NG",
      createdAt,
    });
    const identity = Object.freeze({
      tenantId:profile.tenantId,userId:profile.userId,profile,
    });

    const access = mintPlatformSessionToken("access");
    const refresh = mintPlatformSessionToken("refresh");
    const accessHash = hashPlatformSessionToken(access);
    const refreshHash = hashPlatformSessionToken(refresh);
    await repository.issueSession({
      identity,accessHash,refreshHash,
      accessExpiresAt:new Date(Date.parse(createdAt)+900_000).toISOString(),
      refreshExpiresAt:new Date(Date.parse(createdAt)+30*24*60*60_000).toISOString(),
      issuedAt:createdAt,
    });
    await expect(repository.resolveAccess({
      accessHash,at:new Date(Date.parse(createdAt)+1000).toISOString(),
    })).resolves.toMatchObject({ userId:profile.userId });

    const nextAccess = mintPlatformSessionToken("access");
    const nextRefresh = mintPlatformSessionToken("refresh");
    const rotatedAt = new Date(Date.parse(createdAt)+2000).toISOString();
    await expect(repository.rotateRefresh({
      refreshHash,
      nextAccessHash:hashPlatformSessionToken(nextAccess),
      nextRefreshHash:hashPlatformSessionToken(nextRefresh),
      accessExpiresAt:new Date(Date.parse(rotatedAt)+900_000).toISOString(),
      refreshExpiresAt:new Date(Date.parse(rotatedAt)+30*24*60*60_000).toISOString(),
      rotatedAt,
    })).resolves.toMatchObject({ userId:profile.userId });

    await expect(repository.resolveAccess({
      accessHash,at:new Date(Date.parse(rotatedAt)+1000).toISOString(),
    })).resolves.toBeNull();

    const nextAccessHash = hashPlatformSessionToken(nextAccess);
    await repository.revokeAccess({
      accessHash:nextAccessHash,
      revokedAt:new Date(Date.parse(rotatedAt)+2000).toISOString(),
    });
    await expect(repository.resolveAccess({
      accessHash:nextAccessHash,
      at:new Date(Date.parse(rotatedAt)+3000).toISOString(),
    })).resolves.toBeNull();
  });

  it("denies access and refresh when the canonical platform tenant is disabled", async () => {
    const repository = createPostgresPlatformSessionRepository(pool);
    const tenantId = createCanonicalId("tenant");
    const createdAt = new Date().toISOString();
    const profile = await repository.createProfile({
      tenantId,
      channel:"email",
      identifier:`disabled-${tenantId.slice(-8)}@example.com`,
      name:"Disabled Tenant Customer",
      locale:"en-NG",
      createdAt,
    });
    const access = mintPlatformSessionToken("access");
    const refresh = mintPlatformSessionToken("refresh");
    const accessHash = hashPlatformSessionToken(access);
    const refreshHash = hashPlatformSessionToken(refresh);
    await repository.issueSession({
      identity:Object.freeze({ tenantId, userId:profile.userId, profile }),
      accessHash,
      refreshHash,
      accessExpiresAt:new Date(Date.parse(createdAt)+900_000).toISOString(),
      refreshExpiresAt:new Date(Date.parse(createdAt)+30*24*60*60_000).toISOString(),
      issuedAt:createdAt,
    });
    await pool.query(
      `UPDATE identity.tenants SET state='disabled',revision=revision+1,updated_at=clock_timestamp()
        WHERE tenant_id=$1`,
      [tenantId],
    );

    await expect(repository.resolveAccess({
      accessHash,
      at:new Date(Date.parse(createdAt)+1000).toISOString(),
    })).resolves.toBeNull();

    await expect(repository.rotateRefresh({
      refreshHash,
      nextAccessHash:hashPlatformSessionToken(mintPlatformSessionToken("access")),
      nextRefreshHash:hashPlatformSessionToken(mintPlatformSessionToken("refresh")),
      accessExpiresAt:new Date(Date.parse(createdAt)+901_000).toISOString(),
      refreshExpiresAt:new Date(Date.parse(createdAt)+30*24*60*60_000+1000).toISOString(),
      rotatedAt:new Date(Date.parse(createdAt)+1000).toISOString(),
    })).resolves.toBeNull();

    await expect(repository.createProfile({
      tenantId,
      channel:"email",
      identifier:`other-${tenantId.slice(-8)}@example.com`,
      name:"Blocked Customer",
      locale:"en-NG",
      createdAt:new Date(Date.parse(createdAt)+2000).toISOString(),
    })).rejects.toThrow("auth.tenant_inactive");
  });
});
