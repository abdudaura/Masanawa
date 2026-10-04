import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createCanonicalId,
  toInstant,
} from "@masanawa/contracts";
import {
  completeDevicePairing,
  createPostgresPool,
  deviceMigrationRoots,
  issueDevicePairingChallenge,
  registerDevice,
  runMigrations,
} from "@masanawa/postgres";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

describePostgres("Device registration and secure pairing acceptance", () => {
  const databaseName =
    `masanawa_device_pairing_${randomUUID().replaceAll("-", "")}`;
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let databaseUrl = "";
  let created = false;

  beforeAll(async () => {
    admin = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "device-pairing-admin",
      max: 1,
    });

    const version = await admin.query<{ server_version_num: string }>(
      "SHOW server_version_num",
    );
    expect(Number(version.rows[0]!.server_version_num)).toBeGreaterThanOrEqual(
      180000,
    );
    expect(Number(version.rows[0]!.server_version_num)).toBeLessThan(190000);

    await admin.query(`CREATE DATABASE ${databaseName} TEMPLATE template0`);
    created = true;

    const url = new URL(connectionString!);
    url.pathname = `/${databaseName}`;
    databaseUrl = url.toString();
    pool = createPostgresPool({
      connectionString: databaseUrl,
      applicationName: "device-pairing",
      max: 4,
    });

    await runMigrations(pool, deviceMigrationRoots());
  });

  afterAll(async () => {
    try {
      await pool?.end();
      if (created) {
        await admin.query(
          "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1",
          [databaseName],
        );
        await admin.query(`DROP DATABASE ${databaseName}`);
      }
    } finally {
      await admin?.end();
    }
  });

  function registrationInput(
    tenantId = createCanonicalId("tenant"),
    enrollmentFingerprint = `enrollment-${randomUUID()}`,
  ) {
    return {
      tenantId,
      enrollmentFingerprint,
      metadata: {
        deviceClass: "Android_Phone",
        platform: "ANDROID",
        platformVersion: "12",
        model: "TECNO Pop 7",
        appVersion: "1.0.0",
      },
      registeredAt: toInstant(new Date("2026-10-04T18:00:00.000Z")),
    };
  }

  it("registers one server-identified Device and reconciles exact enrollment replay", async () => {
    const input = registrationInput();
    const first = await registerDevice(pool, input);
    const replay = await registerDevice(pool, {
      ...input,
      registeredAt: toInstant(new Date("2026-10-04T18:01:00.000Z")),
    });

    expect(first.deviceId).toMatch(/^device_/u);
    expect(first).toEqual(replay);
    expect(first).toMatchObject({
      tenantId: input.tenantId,
      state: "pending-pairing",
      revision: 1,
      pairedAt: null,
      metadata: {
        deviceClass: "android_phone",
        platform: "android",
        platformVersion: "12",
        model: "TECNO Pop 7",
        appVersion: "1.0.0",
      },
    });

    await expect(
      registerDevice(pool, {
        ...input,
        metadata: {
          ...input.metadata,
          model: "Different physical device",
        },
      }),
    ).rejects.toMatchObject({
      code: "devices.registration_conflict",
      category: "conflict",
      retryable: false,
    });
  });

  it("persists only the pairing-secret hash and permits one current challenge", async () => {
    const device = await registerDevice(pool, registrationInput());
    const at = toInstant(new Date("2026-10-04T18:02:00.000Z"));
    const issued = await issueDevicePairingChallenge(pool, {
      tenantId: device.tenantId,
      deviceId: device.deviceId,
      lifetimeMs: 5 * 60_000,
      at,
    });

    expect(issued.secret.length).toBeGreaterThanOrEqual(32);
    expect(issued.challenge).toMatchObject({
      deviceId: device.deviceId,
      state: "pending",
      failedAttempts: 0,
    });

    const row = await pool.query<{ secret_hash: string }>(
      `SELECT secret_hash
         FROM devices.pairing_challenges
        WHERE tenant_id = $1 AND pairing_request_id = $2`,
      [device.tenantId, issued.challenge.pairingRequestId],
    );
    expect(row.rows[0]!.secret_hash).toMatch(/^[a-f0-9]{64}$/u);
    expect(row.rows[0]!.secret_hash).not.toBe(issued.secret);

    await expect(
      issueDevicePairingChallenge(pool, {
        tenantId: device.tenantId,
        deviceId: device.deviceId,
        lifetimeMs: 5 * 60_000,
        at,
      }),
    ).rejects.toMatchObject({
      code: "devices.pairing_already_pending",
      retryable: false,
    });
  });

  it("locks a challenge after five persisted invalid secret attempts", async () => {
    const device = await registerDevice(pool, registrationInput());
    const at = toInstant(new Date("2026-10-04T18:02:00.000Z"));
    const issued = await issueDevicePairingChallenge(pool, {
      tenantId: device.tenantId,
      deviceId: device.deviceId,
      lifetimeMs: 5 * 60_000,
      at,
    });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await expect(
        completeDevicePairing(pool, {
          tenantId: device.tenantId,
          deviceId: device.deviceId,
          pairingRequestId: issued.challenge.pairingRequestId,
          secret: `wrong-secret-${"x".repeat(32)}-${attempt}`,
          at: toInstant(
            new Date(new Date(at).getTime() + attempt * 1_000),
          ),
        }),
      ).rejects.toMatchObject({
        code:
          attempt === 5
            ? "devices.pairing_locked"
            : "devices.pairing_secret_invalid",
        category: "authorization",
        retryable: false,
      });
    }

    const row = await pool.query<{
      state: string;
      failed_attempts: number;
    }>(
      `SELECT state, failed_attempts
         FROM devices.pairing_challenges
        WHERE tenant_id = $1 AND pairing_request_id = $2`,
      [device.tenantId, issued.challenge.pairingRequestId],
    );
    expect(row.rows[0]).toEqual({
      state: "expired",
      failed_attempts: 5,
    });

    await expect(
      completeDevicePairing(pool, {
        tenantId: device.tenantId,
        deviceId: device.deviceId,
        pairingRequestId: issued.challenge.pairingRequestId,
        secret: issued.secret,
        at: toInstant(new Date(new Date(at).getTime() + 6_000)),
      }),
    ).rejects.toMatchObject({
      code: "devices.pairing_expired",
    });
  });

  it("expires stale challenges durably and permits a replacement challenge", async () => {
    const device = await registerDevice(pool, registrationInput());
    const at = toInstant(new Date("2026-10-04T18:02:00.000Z"));
    const issued = await issueDevicePairingChallenge(pool, {
      tenantId: device.tenantId,
      deviceId: device.deviceId,
      lifetimeMs: 60_000,
      at,
    });
    const afterExpiry = toInstant(
      new Date(new Date(issued.challenge.expiresAt).getTime() + 1),
    );

    await expect(
      completeDevicePairing(pool, {
        tenantId: device.tenantId,
        deviceId: device.deviceId,
        pairingRequestId: issued.challenge.pairingRequestId,
        secret: issued.secret,
        at: afterExpiry,
      }),
    ).rejects.toMatchObject({
      code: "devices.pairing_expired",
      category: "authorization",
    });

    const expired = await pool.query<{ state: string }>(
      `SELECT state
         FROM devices.pairing_challenges
        WHERE tenant_id = $1 AND pairing_request_id = $2`,
      [device.tenantId, issued.challenge.pairingRequestId],
    );
    expect(expired.rows[0]!.state).toBe("expired");

    const replacement = await issueDevicePairingChallenge(pool, {
      tenantId: device.tenantId,
      deviceId: device.deviceId,
      lifetimeMs: 60_000,
      at: afterExpiry,
    });
    expect(replacement.challenge.pairingRequestId).not.toBe(
      issued.challenge.pairingRequestId,
    );
  });

  it("activates a Device once and reconciles exact completion replay after response loss", async () => {
    const device = await registerDevice(pool, registrationInput());
    const at = toInstant(new Date("2026-10-04T18:02:00.000Z"));
    const issued = await issueDevicePairingChallenge(pool, {
      tenantId: device.tenantId,
      deviceId: device.deviceId,
      lifetimeMs: 5 * 60_000,
      at,
    });
    const pairedAt = toInstant(
      new Date(new Date(at).getTime() + 1_000),
    );

    const paired = await completeDevicePairing(pool, {
      tenantId: device.tenantId,
      deviceId: device.deviceId,
      pairingRequestId: issued.challenge.pairingRequestId,
      secret: issued.secret,
      at: pairedAt,
    });
    expect(paired).toMatchObject({
      state: "active",
      revision: 2,
      pairedAt,
    });

    const replay = await completeDevicePairing(pool, {
      tenantId: device.tenantId,
      deviceId: device.deviceId,
      pairingRequestId: issued.challenge.pairingRequestId,
      secret: issued.secret,
      at: toInstant(new Date(new Date(pairedAt).getTime() + 30_000)),
    });
    expect(replay).toEqual(paired);

    const challenge = await pool.query<{
      state: string;
      consumed_at: Date | null;
    }>(
      `SELECT state, consumed_at
         FROM devices.pairing_challenges
        WHERE tenant_id = $1 AND pairing_request_id = $2`,
      [device.tenantId, issued.challenge.pairingRequestId],
    );
    expect(challenge.rows[0]!.state).toBe("consumed");
    expect(challenge.rows[0]!.consumed_at).not.toBeNull();

    await expect(
      issueDevicePairingChallenge(pool, {
        tenantId: device.tenantId,
        deviceId: device.deviceId,
        lifetimeMs: 60_000,
        at: pairedAt,
      }),
    ).rejects.toMatchObject({
      code: "devices.already_paired",
    });
  });

  it("rejects cross-Tenant pairing without revealing the Device challenge", async () => {
    const device = await registerDevice(pool, registrationInput());
    const at = toInstant(new Date("2026-10-04T18:02:00.000Z"));
    const issued = await issueDevicePairingChallenge(pool, {
      tenantId: device.tenantId,
      deviceId: device.deviceId,
      lifetimeMs: 5 * 60_000,
      at,
    });

    await expect(
      completeDevicePairing(pool, {
        tenantId: createCanonicalId("tenant"),
        deviceId: device.deviceId,
        pairingRequestId: issued.challenge.pairingRequestId,
        secret: issued.secret,
        at: toInstant(new Date(new Date(at).getTime() + 1_000)),
      }),
    ).rejects.toMatchObject({
      code: "devices.pairing_not_found",
      category: "not-found",
      retryable: false,
    });
  });
});
