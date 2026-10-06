import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import {
  completeDevicePairing,
  createPostgresPool,
  deviceMigrationRoots,
  issueDevicePairingChallenge,
  publishDeviceCapabilities,
  readDeviceCapabilitySnapshot,
  recordDeviceHealth,
  registerDevice,
  runMigrations,
} from "@masanawa/postgres";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;

describePostgres("Device capability persistence acceptance", () => {
  const databaseName =
    `masanawa_device_cap_${randomUUID().replaceAll("-", "")}`;
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let created = false;

  beforeAll(async () => {
    admin = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "device-capability-admin",
      max: 1,
    });
    await admin.query(`CREATE DATABASE ${databaseName} TEMPLATE template0`);
    created = true;

    const url = new URL(connectionString!);
    url.pathname = `/${databaseName}`;
    pool = createPostgresPool({
      connectionString: url.toString(),
      applicationName: "device-capability",
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

  async function activeDevice() {
    const tenantId = createCanonicalId("tenant");
    const registered = await registerDevice(pool, {
      tenantId,
      enrollmentFingerprint: `enrollment-${randomUUID()}`,
      metadata: {
        deviceClass: "android_phone",
        platform: "android",
        platformVersion: "12",
        model: "TECNO Pop 7",
        appVersion: "1.0.0",
      },
      registeredAt: toInstant("2026-10-06T16:00:00.000Z"),
    });
    const issued = await issueDevicePairingChallenge(pool, {
      tenantId,
      deviceId: registered.deviceId,
      lifetimeMs: 60_000,
      at: toInstant("2026-10-06T16:00:10.000Z"),
    });
    const active = await completeDevicePairing(pool, {
      tenantId,
      deviceId: registered.deviceId,
      pairingRequestId: issued.challenge.pairingRequestId,
      secret: issued.secret,
      at: toInstant("2026-10-06T16:00:20.000Z"),
    });
    return { tenantId, deviceId: active.deviceId };
  }

  it("persists immutable complete generations with exact replay", async () => {
    const device = await activeDevice();
    const first = {
      ...device,
      generation: 1,
      capabilities: [
        {
          key: "SMS.Send",
          readiness: "ready" as const,
          reason: null,
          observedAt: toInstant("2026-10-06T16:01:00.000Z"),
        },
      ],
      publishedAt: toInstant("2026-10-06T16:01:00.000Z"),
    };

    const stored = await publishDeviceCapabilities(pool, first);
    expect(stored.capabilities[0]?.key).toBe("sms.send");

    const replay = await publishDeviceCapabilities(pool, first);
    expect(replay).toEqual(stored);

    await expect(
      publishDeviceCapabilities(pool, {
        ...first,
        capabilities: [
          {
            key: "sms.send",
            readiness: "degraded",
            reason: "radio_limited",
            observedAt: first.publishedAt,
          },
        ],
      }),
    ).rejects.toMatchObject({
      code: "devices.capability_generation_conflict",
      category: "conflict",
    });

    const second = await publishDeviceCapabilities(pool, {
      ...device,
      generation: 2,
      capabilities: [],
      publishedAt: toInstant("2026-10-06T16:02:00.000Z"),
    });
    expect(second.generation).toBe(2);
    expect(second.capabilities).toEqual([]);

    await expect(
      publishDeviceCapabilities(pool, {
        ...device,
        generation: 4,
        capabilities: [],
        publishedAt: toInstant("2026-10-06T16:03:00.000Z"),
      }),
    ).rejects.toMatchObject({
      code: "devices.capability_generation_stale",
    });
  });

  it("stores monotonic health with exact replay and conflict detection", async () => {
    const device = await activeDevice();
    const healthy = {
      ...device,
      state: "healthy" as const,
      reason: null,
      observedAt: toInstant("2026-10-06T16:01:00.000Z"),
    };
    await expect(recordDeviceHealth(pool, healthy)).resolves.toEqual(healthy);
    await expect(recordDeviceHealth(pool, healthy)).resolves.toEqual(healthy);

    await expect(
      recordDeviceHealth(pool, {
        ...healthy,
        state: "degraded",
        reason: "battery_low",
      }),
    ).rejects.toMatchObject({
      code: "devices.health_observation_conflict",
    });

    await expect(
      recordDeviceHealth(pool, {
        ...healthy,
        observedAt: toInstant("2026-10-06T16:00:59.000Z"),
      }),
    ).rejects.toMatchObject({
      code: "devices.health_observation_stale",
    });

    const newer = {
      ...device,
      state: "degraded" as const,
      reason: "battery_low",
      observedAt: toInstant("2026-10-06T16:02:00.000Z"),
    };
    await expect(recordDeviceHealth(pool, newer)).resolves.toEqual(newer);
  });

  it("reads the latest complete publication and computes health staleness", async () => {
    const device = await activeDevice();
    await publishDeviceCapabilities(pool, {
      ...device,
      generation: 1,
      capabilities: [
        {
          key: "telephony.call.place",
          readiness: "ready",
          reason: null,
          observedAt: toInstant("2026-10-06T16:01:00.000Z"),
        },
      ],
      publishedAt: toInstant("2026-10-06T16:01:00.000Z"),
    });
    await publishDeviceCapabilities(pool, {
      ...device,
      generation: 2,
      capabilities: [
        {
          key: "sms.send",
          readiness: "ready",
          reason: null,
          observedAt: toInstant("2026-10-06T16:02:00.000Z"),
        },
      ],
      publishedAt: toInstant("2026-10-06T16:02:00.000Z"),
    });
    await recordDeviceHealth(pool, {
      ...device,
      state: "healthy",
      reason: null,
      observedAt: toInstant("2026-10-06T16:02:00.000Z"),
    });

    const fresh = await readDeviceCapabilitySnapshot(pool, {
      ...device,
      at: toInstant("2026-10-06T16:02:30.000Z"),
      staleAfterMs: 60_000,
    });
    expect(fresh).toMatchObject({
      generation: 2,
      healthStale: false,
      capabilities: [{ key: "sms.send", readiness: "ready" }],
    });
    expect(JSON.stringify(fresh)).not.toContain("telephony.call.place");

    const stale = await readDeviceCapabilitySnapshot(pool, {
      ...device,
      at: toInstant("2026-10-06T16:04:00.000Z"),
      staleAfterMs: 60_000,
    });
    expect(stale?.healthStale).toBe(true);
  });

  it("rejects writes/reads for inactive or cross-tenant Devices", async () => {
    const device = await activeDevice();
    await pool.query(
      `UPDATE devices.devices
          SET state='suspended', updated_at=$3
        WHERE tenant_id=$1 AND device_id=$2`,
      [
        device.tenantId,
        device.deviceId,
        toInstant("2026-10-06T16:05:00.000Z"),
      ],
    );

    await expect(
      publishDeviceCapabilities(pool, {
        ...device,
        generation: 1,
        capabilities: [],
        publishedAt: toInstant("2026-10-06T16:06:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "devices.not_active" });

    await expect(
      readDeviceCapabilitySnapshot(pool, {
        tenantId: createCanonicalId("tenant"),
        deviceId: device.deviceId,
        at: toInstant("2026-10-06T16:06:00.000Z"),
        staleAfterMs: 60_000,
      }),
    ).rejects.toMatchObject({
      code: "devices.not_found",
      category: "not-found",
    });
  });
});
