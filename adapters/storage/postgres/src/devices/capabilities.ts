import {
  PlatformError,
  toInstant,
  type DeviceId,
  type Instant,
  type TenantId,
} from "@masanawa/contracts";
import { fingerprintCanonicalJson } from "@masanawa/security";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";

export type StoredDeviceCapabilityReadiness =
  | "ready"
  | "degraded"
  | "unavailable";

export interface StoredDeviceCapabilityFact {
  readonly key: string;
  readonly readiness: StoredDeviceCapabilityReadiness;
  readonly reason: string | null;
  readonly observedAt: Instant;
}

export interface StoredDeviceCapabilityPublication {
  readonly tenantId: TenantId;
  readonly deviceId: DeviceId;
  readonly generation: number;
  readonly capabilities: readonly StoredDeviceCapabilityFact[];
  readonly publishedAt: Instant;
}

export type StoredDeviceHealthState =
  | "healthy"
  | "degraded"
  | "unavailable";

export interface StoredDeviceHealthFact {
  readonly tenantId: TenantId;
  readonly deviceId: DeviceId;
  readonly state: StoredDeviceHealthState;
  readonly reason: string | null;
  readonly observedAt: Instant;
}

export interface StoredDeviceCapabilitySnapshot {
  readonly tenantId: TenantId;
  readonly deviceId: DeviceId;
  readonly generation: number;
  readonly capabilities: readonly StoredDeviceCapabilityFact[];
  readonly health: StoredDeviceHealthFact | null;
  readonly healthStale: boolean;
}

interface DeviceStateRow {
  state: "pending-pairing" | "active" | "suspended";
}

interface PublicationRow {
  tenant_id: TenantId;
  device_id: DeviceId;
  generation: string;
  publication_fingerprint: string;
  published_at: Date;
}

interface CapabilityRow {
  capability_key: string;
  readiness: StoredDeviceCapabilityReadiness;
  reason: string | null;
  observed_at: Date;
}

interface HealthRow {
  tenant_id: TenantId;
  device_id: DeviceId;
  state: StoredDeviceHealthState;
  reason: string | null;
  fact_fingerprint: string;
  observed_at: Date;
  revision: string;
  updated_at: Date;
}

const keyPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u;

function bounded(value: string, name: string, max: number): string {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) {
    throw new TypeError(`${name} is invalid`);
  }
  return normalized;
}

function capabilityKey(value: string): string {
  const normalized = bounded(value, "capability.key", 160).toLowerCase();
  if (!keyPattern.test(normalized)) {
    throw new TypeError("capability.key is invalid");
  }
  return normalized;
}

function generation(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError("capability generation is invalid");
  }
  return value;
}

function reasonFor(
  state: StoredDeviceCapabilityReadiness | StoredDeviceHealthState,
  reason: string | null,
  readyState: "ready" | "healthy",
): string | null {
  if (state === readyState) {
    if (reason !== null) {
      throw new TypeError(`${readyState} state cannot carry a reason`);
    }
    return null;
  }
  if (reason === null) {
    throw new TypeError("non-ready state requires a reason");
  }
  return bounded(reason, "reason", 500);
}

function normalizePublication(
  input: StoredDeviceCapabilityPublication,
): StoredDeviceCapabilityPublication {
  const publishedAt = toInstant(input.publishedAt);
  if (!Array.isArray(input.capabilities) || input.capabilities.length > 128) {
    throw new RangeError("capability publication is invalid");
  }
  const capabilities = input.capabilities
    .map((item) => {
      if (
        item.readiness !== "ready" &&
        item.readiness !== "degraded" &&
        item.readiness !== "unavailable"
      ) {
        throw new TypeError("capability readiness is invalid");
      }
      const observedAt = toInstant(item.observedAt);
      if (Date.parse(observedAt) > Date.parse(publishedAt)) {
        throw new TypeError("capability observedAt cannot follow publishedAt");
      }
      return Object.freeze({
        key: capabilityKey(item.key),
        readiness: item.readiness,
        reason: reasonFor(item.readiness, item.reason, "ready"),
        observedAt,
      });
    })
    .sort((a, b) => a.key.localeCompare(b.key));
  if (new Set(capabilities.map((item) => item.key)).size !== capabilities.length) {
    throw new TypeError("capability keys must be unique");
  }
  return Object.freeze({
    tenantId: input.tenantId,
    deviceId: input.deviceId,
    generation: generation(input.generation),
    capabilities: Object.freeze(capabilities),
    publishedAt,
  });
}

function normalizeHealth(
  input: StoredDeviceHealthFact,
): StoredDeviceHealthFact {
  if (
    input.state !== "healthy" &&
    input.state !== "degraded" &&
    input.state !== "unavailable"
  ) {
    throw new TypeError("Device health state is invalid");
  }
  return Object.freeze({
    tenantId: input.tenantId,
    deviceId: input.deviceId,
    state: input.state,
    reason: reasonFor(input.state, input.reason, "healthy"),
    observedAt: toInstant(input.observedAt),
  });
}

function publicationFingerprint(
  input: StoredDeviceCapabilityPublication,
): string {
  return fingerprintCanonicalJson({
    tenantId: input.tenantId,
    deviceId: input.deviceId,
    generation: input.generation,
    capabilities: input.capabilities,
    publishedAt: input.publishedAt,
  });
}

function healthFingerprint(input: StoredDeviceHealthFact): string {
  return fingerprintCanonicalJson(input);
}

async function requireActiveDevice(
  client: PoolClient,
  tenantId: TenantId,
  deviceId: DeviceId,
  forUpdate = false,
): Promise<void> {
  const result = await client.query<DeviceStateRow>(
    `SELECT state
       FROM devices.devices
      WHERE tenant_id = $1 AND device_id = $2
      ${forUpdate ? "FOR UPDATE" : ""}`,
    [tenantId, deviceId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new PlatformError({
      code: "devices.not_found",
      category: "not-found",
      message: "Device does not exist in the requested tenant",
      retryable: false,
    });
  }
  if (row.state !== "active") {
    throw new PlatformError({
      code: "devices.not_active",
      category: "authorization",
      message: "Device is not active",
      retryable: false,
    });
  }
}

async function loadPublication(
  client: PoolClient,
  input: {
    readonly tenantId: TenantId;
    readonly deviceId: DeviceId;
    readonly generation: number;
  },
): Promise<StoredDeviceCapabilityPublication | null> {
  const publication = await client.query<PublicationRow>(
    `SELECT tenant_id, device_id, generation::text,
            publication_fingerprint, published_at
       FROM devices.capability_publications
      WHERE tenant_id = $1 AND device_id = $2 AND generation = $3`,
    [input.tenantId, input.deviceId, input.generation],
  );
  const row = publication.rows[0];
  if (!row) return null;

  const facts = await client.query<CapabilityRow>(
    `SELECT capability_key, readiness, reason, observed_at
       FROM devices.capability_facts
      WHERE tenant_id = $1 AND device_id = $2 AND generation = $3
      ORDER BY capability_key ASC`,
    [input.tenantId, input.deviceId, input.generation],
  );

  return Object.freeze({
    tenantId: row.tenant_id,
    deviceId: row.device_id,
    generation: Number(row.generation),
    capabilities: Object.freeze(
      facts.rows.map((fact) =>
        Object.freeze({
          key: fact.capability_key,
          readiness: fact.readiness,
          reason: fact.reason,
          observedAt: toInstant(fact.observed_at),
        }),
      ),
    ),
    publishedAt: toInstant(row.published_at),
  });
}

export async function publishDeviceCapabilities(
  pool: Pool,
  input: StoredDeviceCapabilityPublication,
): Promise<StoredDeviceCapabilityPublication> {
  const publication = normalizePublication(input);
  const fingerprint = publicationFingerprint(publication);

  return withTransaction(pool, async (client) => {
    await requireActiveDevice(
      client,
      publication.tenantId,
      publication.deviceId,
      true,
    );

    const latest = await client.query<{
      generation: string;
      publication_fingerprint: string;
    }>(
      `SELECT generation::text, publication_fingerprint
         FROM devices.capability_publications
        WHERE tenant_id = $1 AND device_id = $2
        ORDER BY generation DESC
        LIMIT 1
        FOR UPDATE`,
      [publication.tenantId, publication.deviceId],
    );
    const current = latest.rows[0];

    if (current) {
      const currentGeneration = Number(current.generation);
      if (publication.generation === currentGeneration) {
        if (current.publication_fingerprint !== fingerprint) {
          throw new PlatformError({
            code: "devices.capability_generation_conflict",
            category: "conflict",
            message: "Capability generation already exists with different evidence",
            retryable: false,
          });
        }
        const replay = await loadPublication(client, publication);
        if (!replay) {
          throw new Error("Capability publication replay could not be reloaded");
        }
        return replay;
      }
      if (publication.generation !== currentGeneration + 1) {
        throw new PlatformError({
          code: "devices.capability_generation_stale",
          category: "conflict",
          message: "Capability generation must advance exactly once",
          retryable: false,
        });
      }
    } else if (publication.generation !== 1) {
      throw new PlatformError({
        code: "devices.capability_generation_stale",
        category: "conflict",
        message: "First capability generation must be one",
        retryable: false,
      });
    }

    await client.query(
      `INSERT INTO devices.capability_publications (
         tenant_id, device_id, generation,
         publication_fingerprint, published_at
       ) VALUES ($1,$2,$3,$4,$5)`,
      [
        publication.tenantId,
        publication.deviceId,
        publication.generation,
        fingerprint,
        publication.publishedAt,
      ],
    );

    for (const fact of publication.capabilities) {
      await client.query(
        `INSERT INTO devices.capability_facts (
           tenant_id, device_id, generation, capability_key,
           readiness, reason, observed_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          publication.tenantId,
          publication.deviceId,
          publication.generation,
          fact.key,
          fact.readiness,
          fact.reason,
          fact.observedAt,
        ],
      );
    }

    return publication;
  });
}

export async function recordDeviceHealth(
  pool: Pool,
  input: StoredDeviceHealthFact,
): Promise<StoredDeviceHealthFact> {
  const health = normalizeHealth(input);
  const fingerprint = healthFingerprint(health);

  return withTransaction(pool, async (client) => {
    await requireActiveDevice(
      client,
      health.tenantId,
      health.deviceId,
      true,
    );

    const existing = await client.query<HealthRow>(
      `SELECT tenant_id, device_id, state, reason, fact_fingerprint,
              observed_at, revision::text, updated_at
         FROM devices.device_health
        WHERE tenant_id = $1 AND device_id = $2
        FOR UPDATE`,
      [health.tenantId, health.deviceId],
    );
    const current = existing.rows[0];

    if (!current) {
      await client.query(
        `INSERT INTO devices.device_health (
           tenant_id, device_id, state, reason, fact_fingerprint,
           observed_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$6)`,
        [
          health.tenantId,
          health.deviceId,
          health.state,
          health.reason,
          fingerprint,
          health.observedAt,
        ],
      );
      return health;
    }

    const currentObservedAt = toInstant(current.observed_at);
    if (health.observedAt === currentObservedAt) {
      if (current.fact_fingerprint !== fingerprint) {
        throw new PlatformError({
          code: "devices.health_observation_conflict",
          category: "conflict",
          message: "Device health timestamp already has different evidence",
          retryable: false,
        });
      }
      return Object.freeze({
        tenantId: current.tenant_id,
        deviceId: current.device_id,
        state: current.state,
        reason: current.reason,
        observedAt: currentObservedAt,
      });
    }

    if (Date.parse(health.observedAt) < Date.parse(currentObservedAt)) {
      throw new PlatformError({
        code: "devices.health_observation_stale",
        category: "conflict",
        message: "Device health observation is older than current state",
        retryable: false,
      });
    }

    await client.query(
      `UPDATE devices.device_health
          SET state = $3,
              reason = $4,
              fact_fingerprint = $5,
              observed_at = $6,
              revision = revision + 1,
              updated_at = $6
        WHERE tenant_id = $1 AND device_id = $2`,
      [
        health.tenantId,
        health.deviceId,
        health.state,
        health.reason,
        fingerprint,
        health.observedAt,
      ],
    );
    return health;
  });
}

export async function readDeviceCapabilitySnapshot(
  pool: Pool,
  input: {
    readonly tenantId: TenantId;
    readonly deviceId: DeviceId;
    readonly at: Instant;
    readonly staleAfterMs: number;
  },
): Promise<StoredDeviceCapabilitySnapshot | null> {
  if (!Number.isSafeInteger(input.staleAfterMs) || input.staleAfterMs <= 0) {
    throw new RangeError("staleAfterMs must be a positive safe integer");
  }
  const at = toInstant(input.at);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET TRANSACTION READ ONLY");
    await requireActiveDevice(client, input.tenantId, input.deviceId);

    const latest = await client.query<{ generation: string }>(
      `SELECT generation::text
         FROM devices.capability_publications
        WHERE tenant_id = $1 AND device_id = $2
        ORDER BY generation DESC
        LIMIT 1`,
      [input.tenantId, input.deviceId],
    );
    const row = latest.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return null;
    }

    const publication = await loadPublication(client, {
      tenantId: input.tenantId,
      deviceId: input.deviceId,
      generation: Number(row.generation),
    });
    if (!publication) {
      throw new Error("Latest capability publication could not be loaded");
    }

    const healthResult = await client.query<HealthRow>(
      `SELECT tenant_id, device_id, state, reason, fact_fingerprint,
              observed_at, revision::text, updated_at
         FROM devices.device_health
        WHERE tenant_id = $1 AND device_id = $2`,
      [input.tenantId, input.deviceId],
    );
    const healthRow = healthResult.rows[0];
    const health =
      healthRow === undefined
        ? null
        : Object.freeze({
            tenantId: healthRow.tenant_id,
            deviceId: healthRow.device_id,
            state: healthRow.state,
            reason: healthRow.reason,
            observedAt: toInstant(healthRow.observed_at),
          });

    const healthStale =
      health === null ||
      Date.parse(at) - Date.parse(health.observedAt) > input.staleAfterMs;

    await client.query("COMMIT");
    return Object.freeze({
      tenantId: publication.tenantId,
      deviceId: publication.deviceId,
      generation: publication.generation,
      capabilities: publication.capabilities,
      health,
      healthStale,
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Preserve the original read failure.
    }
    throw error;
  } finally {
    client.release();
  }
}
