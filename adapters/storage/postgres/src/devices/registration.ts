import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  PlatformError,
  createCanonicalId,
  toInstant,
  type DeviceId,
  type Instant,
  type RequestId,
  type TenantId,
} from "@masanawa/contracts";
import { fingerprintCanonicalJson } from "@masanawa/security";
import type { Pool, PoolClient } from "pg";
import type { MigrationRoot } from "../migrations.js";
import { withTransaction } from "../transaction.js";

export interface RegisteredDevice {
  readonly tenantId: TenantId;
  readonly deviceId: DeviceId;
  readonly enrollmentFingerprint: string;
  readonly metadata: Readonly<{
    deviceClass: string;
    platform: string;
    platformVersion: string;
    model: string;
    appVersion: string;
  }>;
  readonly state: "pending-pairing" | "active" | "suspended";
  readonly revision: number;
  readonly registeredAt: Instant;
  readonly updatedAt: Instant;
  readonly pairedAt: Instant | null;
}

export interface PairingChallengeRecord {
  readonly tenantId: TenantId;
  readonly pairingRequestId: RequestId;
  readonly deviceId: DeviceId;
  readonly state: "pending" | "consumed" | "expired";
  readonly failedAttempts: number;
  readonly createdAt: Instant;
  readonly expiresAt: Instant;
  readonly consumedAt: Instant | null;
}

interface DeviceRow {
  tenant_id: TenantId;
  device_id: DeviceId;
  enrollment_fingerprint: string;
  registration_fingerprint: string;
  device_class: string;
  platform: string;
  platform_version: string;
  model: string;
  app_version: string;
  state: RegisteredDevice["state"];
  revision: string;
  registered_at: Date;
  updated_at: Date;
  paired_at: Date | null;
}

interface ChallengeRow {
  tenant_id: TenantId;
  pairing_request_id: RequestId;
  device_id: DeviceId;
  secret_hash: string;
  state: PairingChallengeRecord["state"];
  failed_attempts: number;
  created_at: Date;
  expires_at: Date;
  consumed_at: Date | null;
}

const deviceColumns = `
  tenant_id, device_id, enrollment_fingerprint, registration_fingerprint,
  device_class, platform, platform_version, model, app_version, state,
  revision::text, registered_at, updated_at, paired_at
`;

const challengeColumns = `
  tenant_id, pairing_request_id, device_id, secret_hash, state,
  failed_attempts, created_at, expires_at, consumed_at
`;

function deviceRecord(row: DeviceRow): RegisteredDevice {
  return Object.freeze({
    tenantId: row.tenant_id,
    deviceId: row.device_id,
    enrollmentFingerprint: row.enrollment_fingerprint,
    metadata: Object.freeze({
      deviceClass: row.device_class,
      platform: row.platform,
      platformVersion: row.platform_version,
      model: row.model,
      appVersion: row.app_version,
    }),
    state: row.state,
    revision: Number(row.revision),
    registeredAt: toInstant(row.registered_at),
    updatedAt: toInstant(row.updated_at),
    pairedAt: row.paired_at ? toInstant(row.paired_at) : null,
  });
}

function challengeRecord(row: ChallengeRow): PairingChallengeRecord {
  return Object.freeze({
    tenantId: row.tenant_id,
    pairingRequestId: row.pairing_request_id,
    deviceId: row.device_id,
    state: row.state,
    failedAttempts: row.failed_attempts,
    createdAt: toInstant(row.created_at),
    expiresAt: toInstant(row.expires_at),
    consumedAt: row.consumed_at ? toInstant(row.consumed_at) : null,
  });
}

function bounded(value: string, name: string, max: number): string {
  if (!value.trim() || value.length > max) {
    throw new TypeError(
      `${name} must be non-empty and no longer than ${max} characters`,
    );
  }
  return value;
}

function stableKey(value: string, name: string, max: number): string {
  const normalized = bounded(value, name, max).toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/u.test(normalized)) {
    throw new TypeError(`${name} must use a stable lowercase identifier format`);
  }
  return normalized;
}

function pairingHash(secret: string): string {
  if (typeof secret !== "string" || secret.length < 32 || secret.length > 256) {
    throw new TypeError("pairing secret must contain 32-256 characters");
  }
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

function pairingMatches(secret: string, expectedHash: string): boolean {
  let actual: string;
  try {
    actual = pairingHash(secret);
  } catch {
    return false;
  }
  return timingSafeEqual(
    Buffer.from(actual, "hex"),
    Buffer.from(expectedHash, "hex"),
  );
}

export function deviceMigrationRoots(): readonly MigrationRoot[] {
  return Object.freeze([
    Object.freeze({
      owner: "devices",
      directory: fileURLToPath(
        new URL("../../../../../packages/devices/migrations/", import.meta.url),
      ),
    }),
  ]);
}

export async function registerDevice(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly enrollmentFingerprint: string;
    readonly metadata: Readonly<{
      deviceClass: string;
      platform: string;
      platformVersion: string;
      model: string;
      appVersion: string;
    }>;
    readonly registeredAt: Instant;
  },
): Promise<RegisteredDevice> {
  const normalized = {
    tenantId: input.tenantId,
    enrollmentFingerprint: bounded(
      input.enrollmentFingerprint,
      "enrollmentFingerprint",
      256,
    ),
    metadata: {
      deviceClass: stableKey(input.metadata.deviceClass, "deviceClass", 64),
      platform: stableKey(input.metadata.platform, "platform", 64),
      platformVersion: bounded(
        input.metadata.platformVersion,
        "platformVersion",
        96,
      ),
      model: bounded(input.metadata.model, "model", 160),
      appVersion: bounded(input.metadata.appVersion, "appVersion", 96),
    },
  };
  const registrationFingerprint = fingerprintCanonicalJson(normalized);

  return withTransaction(pool, async (client) => {
    const deviceId = createCanonicalId("device");
    const inserted = await client.query<DeviceRow>(
      `INSERT INTO devices.devices (
         tenant_id, device_id, enrollment_fingerprint,
         registration_fingerprint, device_class, platform,
         platform_version, model, app_version, state,
         registered_at, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending-pairing',$10,$10)
       ON CONFLICT (tenant_id, enrollment_fingerprint)
       DO NOTHING
       RETURNING ${deviceColumns}`,
      [
        normalized.tenantId,
        deviceId,
        normalized.enrollmentFingerprint,
        registrationFingerprint,
        normalized.metadata.deviceClass,
        normalized.metadata.platform,
        normalized.metadata.platformVersion,
        normalized.metadata.model,
        normalized.metadata.appVersion,
        input.registeredAt,
      ],
    );

    if (inserted.rowCount === 1) {
      return deviceRecord(inserted.rows[0]!);
    }

    const existing = await client.query<DeviceRow>(
      `SELECT ${deviceColumns}
         FROM devices.devices
        WHERE tenant_id = $1
          AND enrollment_fingerprint = $2
        FOR UPDATE`,
      [input.tenantId, normalized.enrollmentFingerprint],
    );
    const row = existing.rows[0];
    if (!row) {
      throw new PlatformError({
        code: "devices.registration_race_unresolved",
        category: "conflict",
        message: "Could not reconcile Device registration",
        retryable: true,
      });
    }
    if (row.registration_fingerprint !== registrationFingerprint) {
      throw new PlatformError({
        code: "devices.registration_conflict",
        category: "conflict",
        message: "Enrollment identity is already bound to different Device metadata",
        retryable: false,
      });
    }
    return deviceRecord(row);
  });
}

async function loadDevice(
  client: PoolClient,
  tenantId: TenantId,
  deviceId: DeviceId,
  forUpdate = false,
): Promise<DeviceRow | null> {
  const result = await client.query<DeviceRow>(
    `SELECT ${deviceColumns}
       FROM devices.devices
      WHERE tenant_id = $1 AND device_id = $2
      ${forUpdate ? "FOR UPDATE" : ""}`,
    [tenantId, deviceId],
  );
  return result.rows[0] ?? null;
}

export async function issueDevicePairingChallenge(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly deviceId: DeviceId;
    readonly lifetimeMs: number;
    readonly at: Instant;
  },
): Promise<Readonly<{
  challenge: PairingChallengeRecord;
  secret: string;
}>> {
  if (
    !Number.isSafeInteger(input.lifetimeMs) ||
    input.lifetimeMs < 60_000 ||
    input.lifetimeMs > 900_000
  ) {
    throw new RangeError("pairing lifetimeMs must be between 60000 and 900000");
  }

  return withTransaction(pool, async (client) => {
    const device = await loadDevice(
      client,
      input.tenantId,
      input.deviceId,
      true,
    );
    if (!device) {
      throw new PlatformError({
        code: "devices.not_found",
        category: "not-found",
        message: "Device does not exist in the requested tenant",
        retryable: false,
      });
    }
    if (device.state !== "pending-pairing") {
      throw new PlatformError({
        code: "devices.already_paired",
        category: "conflict",
        message: "Device no longer accepts pairing challenges",
        retryable: false,
      });
    }

    await client.query(
      `UPDATE devices.pairing_challenges
          SET state = 'expired'
        WHERE tenant_id = $1
          AND device_id = $2
          AND state = 'pending'
          AND expires_at <= $3::timestamptz`,
      [input.tenantId, input.deviceId, input.at],
    );

    const pending = await client.query(
      `SELECT 1
         FROM devices.pairing_challenges
        WHERE tenant_id = $1
          AND device_id = $2
          AND state = 'pending'
        LIMIT 1`,
      [input.tenantId, input.deviceId],
    );
    if (pending.rowCount) {
      throw new PlatformError({
        code: "devices.pairing_already_pending",
        category: "conflict",
        message: "Device already has a current pairing challenge",
        retryable: false,
      });
    }

    const secret = randomBytes(32).toString("base64url");
    const secretHash = pairingHash(secret);
    const pairingRequestId = createCanonicalId("request");
    const expiresAt = toInstant(
      new Date(new Date(input.at).getTime() + input.lifetimeMs),
    );
    const inserted = await client.query<ChallengeRow>(
      `INSERT INTO devices.pairing_challenges (
         tenant_id, pairing_request_id, device_id, secret_hash,
         state, created_at, expires_at
       )
       VALUES ($1,$2,$3,$4,'pending',$5,$6)
       RETURNING ${challengeColumns}`,
      [
        input.tenantId,
        pairingRequestId,
        input.deviceId,
        secretHash,
        input.at,
        expiresAt,
      ],
    );

    return Object.freeze({
      challenge: challengeRecord(inserted.rows[0]!),
      secret,
    });
  });
}

export async function completeDevicePairing(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly deviceId: DeviceId;
    readonly pairingRequestId: RequestId;
    readonly secret: string;
    readonly at: Instant;
  },
): Promise<RegisteredDevice> {
  const outcome = await withTransaction(pool, async (client) => {
    const challengeResult = await client.query<ChallengeRow>(
      `SELECT ${challengeColumns}
         FROM devices.pairing_challenges
        WHERE tenant_id = $1
          AND pairing_request_id = $2
          AND device_id = $3
        FOR UPDATE`,
      [input.tenantId, input.pairingRequestId, input.deviceId],
    );
    const challenge = challengeResult.rows[0];
    if (!challenge) {
      return Object.freeze({ kind: "not-found" as const });
    }

    const device = await loadDevice(
      client,
      input.tenantId,
      input.deviceId,
      true,
    );
    if (!device) {
      return Object.freeze({ kind: "device-not-found" as const });
    }

    if (challenge.state === "consumed") {
      if (
        device.state === "active" &&
        pairingMatches(input.secret, challenge.secret_hash)
      ) {
        return Object.freeze({
          kind: "paired" as const,
          device: deviceRecord(device),
        });
      }
      return Object.freeze({ kind: "already-consumed" as const });
    }

    if (
      challenge.state === "expired" ||
      input.at >= toInstant(challenge.expires_at)
    ) {
      if (challenge.state === "pending") {
        await client.query(
          `UPDATE devices.pairing_challenges
              SET state = 'expired'
            WHERE tenant_id = $1 AND pairing_request_id = $2`,
          [input.tenantId, input.pairingRequestId],
        );
      }
      return Object.freeze({ kind: "expired" as const });
    }

    if (!pairingMatches(input.secret, challenge.secret_hash)) {
      const attempts = challenge.failed_attempts + 1;
      await client.query(
        `UPDATE devices.pairing_challenges
            SET failed_attempts = $3,
                state = CASE WHEN $3 >= 5 THEN 'expired' ELSE state END
          WHERE tenant_id = $1 AND pairing_request_id = $2`,
        [input.tenantId, input.pairingRequestId, attempts],
      );
      return Object.freeze({
        kind: attempts >= 5 ? "locked" as const : "invalid-secret" as const,
      });
    }

    if (device.state !== "pending-pairing") {
      return Object.freeze({ kind: "device-state-conflict" as const });
    }

    const consumed = await client.query(
      `UPDATE devices.pairing_challenges
          SET state = 'consumed',
              consumed_at = $3
        WHERE tenant_id = $1
          AND pairing_request_id = $2
          AND state = 'pending'`,
      [input.tenantId, input.pairingRequestId, input.at],
    );
    if (consumed.rowCount !== 1) {
      return Object.freeze({ kind: "already-consumed" as const });
    }

    const updated = await client.query<DeviceRow>(
      `UPDATE devices.devices
          SET state = 'active',
              revision = revision + 1,
              paired_at = $3,
              updated_at = $3
        WHERE tenant_id = $1
          AND device_id = $2
          AND state = 'pending-pairing'
        RETURNING ${deviceColumns}`,
      [input.tenantId, input.deviceId, input.at],
    );
    if (updated.rowCount !== 1) {
      throw new PlatformError({
        code: "devices.pairing_device_state_conflict",
        category: "conflict",
        message: "Device state changed before pairing completed",
        retryable: false,
      });
    }
    return Object.freeze({
      kind: "paired" as const,
      device: deviceRecord(updated.rows[0]!),
    });
  });

  if (outcome.kind === "paired") {
    return outcome.device;
  }

  const errorByKind = {
    "not-found": {
      code: "devices.pairing_not_found",
      category: "not-found",
      message: "Pairing challenge does not exist for this Device and tenant",
    },
    "device-not-found": {
      code: "devices.not_found",
      category: "not-found",
      message: "Device does not exist in the requested tenant",
    },
    "already-consumed": {
      code: "devices.pairing_already_consumed",
      category: "conflict",
      message: "Pairing challenge has already been consumed",
    },
    "expired": {
      code: "devices.pairing_expired",
      category: "authorization",
      message: "Pairing challenge has expired",
    },
    "locked": {
      code: "devices.pairing_locked",
      category: "authorization",
      message: "Pairing challenge is locked after repeated invalid secrets",
    },
    "invalid-secret": {
      code: "devices.pairing_secret_invalid",
      category: "authorization",
      message: "Pairing secret is invalid",
    },
    "device-state-conflict": {
      code: "devices.pairing_device_state_conflict",
      category: "conflict",
      message: "Device is not awaiting pairing",
    },
  } as const;
  const error = errorByKind[outcome.kind];
  throw new PlatformError({
    code: error.code,
    category: error.category,
    message: error.message,
    retryable: false,
  });
}
