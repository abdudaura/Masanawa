import { generateKeyPairSync, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  createCanonicalId,
  normalizeCapabilityKey,
  toInstant,
  type OperationId,
} from "@masanawa/contracts";
import type { PlatformEvent } from "@masanawa/events";
import { createProviderRegistry } from "@masanawa/providers";
import {
  createToolRegistry,
  executeConsequentialTool,
} from "@masanawa/tools";
import {
  assertCurrentAuthority,
  createAuthorityContext,
  createPendingApproval,
  CredentialSecret,
  issueServiceCredential,
  resolveCredentialSecret,
  type CredentialEnvelopeCipher,
  verifyServiceCredential,
  type ApprovalBinding,
} from "@masanawa/security";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import {
  createFaultInjector,
  InjectedCrash,
} from "../../../../test/support/fault-injection.js";
import {
  admitInboxEvent,
  beginReconciliation,
  checkPostgresReadiness,
  claimInboxBatch,
  claimOutboxBatch,
  createPostgresPool,
  createTenant,
  createUser,
  linkExternalUserIdentity,
  resolveUserByExternalIdentity,
  createCharacter,
  createCharacterVersion,
  publishCharacterVersion,
  activateCharacterVersion,
  getOrCreateRelationship,
  createMemoryRecord,
  appendMemoryRevision,
  linkMemoryRecords,
  getMemoryRecordInScope,
  listMemoryRecordsByScopes,
  enqueueMemoryExtraction,
  claimMemoryExtractionBatch,
  renewMemoryExtractionClaim,
  settleMemoryExtractionClaim,
  getMemoryExtractionJob,
  listMemoryExtractionAttempts,
  prepareMemoryScopePublication,
  executeMemoryScopePublication,
  createWorld,
  getWorld,
  admitSimulationInput,
  commitWorldGeneration,
  pauseWorld,
  recoverPausedWorld,
  putCharacterLifeState,
  appendWorldEvent,
  appendWorldInteraction,
  getWorldInteraction,
  putRoutine,
  admitRoutineOccurrence,
  putStoryArc,
  prepareWorldCanonGovernance,
  executeWorldCanonGovernance,
  putServiceVerificationKey,
  deactivateServiceVerificationKey,
  createPostgresServiceCredentialKeySource,
  createProviderCredentialRef,
  rotateProviderCredentialRef,
  revokeProviderCredentialRef,
  createPostgresCredentialMaterialSource,
  settlePendingApproval,
  setPolicyRevision,
  revokeAuthorityContext,
  persistPendingApproval,
  createPostgresCurrentAuthoritySource,
  createPostgresToolOperationStore,
  consumeOnceApproval,
  enqueueOutbox,
  listExternalReceiptsForOperation,
  prepareOperation,
  persistPlatformEventWithOutbox,
  recordExternalReceipt,
  renewOutboxClaim,
  runMigrations,
  settleInboxClaim,
  settleOutboxClaim,
  transitionReconciliationCase,
  transitionOperation,
  withTransaction,
} from "./index.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;
const eventMigrationDirectory = fileURLToPath(
  new URL("../../../../packages/events/migrations", import.meta.url),
);
const securityMigrationDirectory = fileURLToPath(
  new URL("../../../../packages/security/migrations", import.meta.url),
);
const identityMigrationDirectory = fileURLToPath(
  new URL("../../../../packages/identity/migrations", import.meta.url),
);
const memoryMigrationDirectory = fileURLToPath(
  new URL("../../../../packages/memory/migrations", import.meta.url),
);
const worldMigrationDirectory = fileURLToPath(
  new URL("../../../../packages/world/migrations", import.meta.url),
);
const foundationMigrationRootsForTest = [
  { owner: "events", directory: eventMigrationDirectory },
  { owner: "identity", directory: identityMigrationDirectory },
  { owner: "memory", directory: memoryMigrationDirectory },
  { owner: "security", directory: securityMigrationDirectory },
  { owner: "world", directory: worldMigrationDirectory },
] as const;

function testWorldPolicy() {
  return {
    schemaVersion: 1,
    catchUpMode: "skip",
    maxCatchUpSteps: 0,
    spatialEnabled: false,
    automaticCanonEnabled: true,
  } as const;
}

function testCharacterConstitution() {
  return {
    schemaVersion: 1,
    displayName: "Amina",
    biography: "",
    personality: [],
    boundaries: [],
    disclosurePolicy: {},
    languages: ["ha"],
    voiceReferences: [],
    appearanceReferences: [],
    expertise: [],
  } as const;
}

describePostgres("PostgreSQL 18 foundation integration", () => {
  let pool: Pool;
  let adminPool: Pool | undefined;
  // This suite resets entire migration registries per test. Never share its
  // database with the other concurrently running PostgreSQL acceptance suites.
  const isolatedDatabaseName = `masanawa_foundation_${randomUUID().replace(/-/gu, "")}`;

  beforeAll(async () => {
    adminPool = createPostgresPool({
      connectionString: connectionString!,
      applicationName: "masanawa-foundation-database-setup",
      max: 1,
    });
    await adminPool.query(`CREATE DATABASE "${isolatedDatabaseName}"`);
    const isolatedUrl = new URL(connectionString!);
    isolatedUrl.pathname = `/${isolatedDatabaseName}`;
    pool = createPostgresPool({
      connectionString: isolatedUrl.toString(),
      applicationName: "masanawa-foundation-integration",
      max: 4,
    });

    const version = await pool.query<{ server_version_num: string }>(
      "SHOW server_version_num",
    );
    const versionNumber = Number(version.rows[0]?.server_version_num);
    expect(versionNumber).toBeGreaterThanOrEqual(180000);
    expect(versionNumber).toBeLessThan(190000);
  });

  beforeEach(async () => {
    await pool.query("DROP SCHEMA IF EXISTS world CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS memory CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS identity CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS security CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS events CASCADE");
    await pool.query(
      "DROP TABLE IF EXISTS public.masanawa_schema_migrations CASCADE",
    );

    const applied = await runMigrations(pool, [
      { owner: "events", directory: eventMigrationDirectory },
      { owner: "identity", directory: identityMigrationDirectory },
      { owner: "memory", directory: memoryMigrationDirectory },
      { owner: "security", directory: securityMigrationDirectory },
      { owner: "world", directory: worldMigrationDirectory },
    ]);
    expect(applied).toEqual([
      "events/0001_event_foundation.sql",
      "events/0002_inbox_leases.sql",
      "events/0003_receipt_reconciliation_integrity.sql",
      "events/0004_outbox_recovery.sql",
      "identity/0001_identity_foundation.sql",
      "identity/0002_character_ownership.sql",
      "identity/0003_clone_setup.sql",
      "identity/0004_twin_profiles.sql",
      "identity/0005_account_deletion_requests.sql",
      "identity/0006_account_deletion_access_revocation.sql",
      "memory/0001_memory_foundation.sql",
      "memory/0002_memory_lifecycle.sql",
      "memory/0003_memory_extraction_liveness.sql",
      "memory/0004_memory_retrieval_projections.sql",
      "memory/0005_memory_multisignal_projections.sql",
      "memory/0006_memory_tombstones.sql",
      "memory/0007_memory_reflections.sql",
      "security/0001_security_foundation.sql",
      "security/0002_approval_operation_integrity.sql",
      "security/0003_service_credentials.sql",
      "security/0004_provider_credentials.sql",
      "security/0100_platform_sessions.sql",
      "security/0101_customer_channels.sql",
      "security/0102_customer_channel_delivery.sql",
      "security/0103_platform_nullable_contact_uniqueness.sql",
      "world/0001_world_foundation.sql",
      "world/0002_world_canon.sql",
      "world/0003_world_routines_story_arcs.sql",
      "world/0004_world_interactions.sql",
      "world/0005_world_recovery.sql",
      "world/0006_world_evidence_publications.sql",
    ]);
  });

  afterAll(async () => {
    await pool?.end();
    if (adminPool) {
      try {
        await adminPool.query(`DROP DATABASE IF EXISTS "${isolatedDatabaseName}" WITH (FORCE)`);
      } finally {
        await adminPool.end();
      }
    }
  });

  it("resolves explicitly linked external identity only inside its tenant", async () => {
    const tenantId = createCanonicalId("tenant");
    const otherTenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const otherUserId = createCanonicalId("user");
    const now = toInstant(new Date());
    const subject = {
      system: "whatsapp",
      namespace: "jid",
      value: "234000000000@s.whatsapp.net",
      subjectKind: "user",
      authenticationStrength: "linked",
      observedAt: now,
    } as const;

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await createTenant(client, { tenantId: otherTenantId, createdAt: now });
      await createUser(client, { tenantId, userId, createdAt: now });
      await createUser(client, { tenantId, userId: otherUserId, createdAt: now });

      await linkExternalUserIdentity(client, {
        tenantId,
        userId,
        subject,
        linkedAt: now,
      });

      await expect(
        resolveUserByExternalIdentity(client, tenantId, subject),
      ).resolves.toBe(userId);
      await expect(
        resolveUserByExternalIdentity(client, otherTenantId, subject),
      ).resolves.toBeNull();

      await expect(
        linkExternalUserIdentity(client, {
          tenantId,
          userId: otherUserId,
          subject,
          linkedAt: now,
        }),
      ).rejects.toMatchObject({
        code: "identity.external_subject_already_linked",
      });
    });
  });

  it("publishes and activates immutable CharacterVersion state with CAS", async () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const characterId = createCanonicalId("character");
    const characterVersionId = createCanonicalId("character-version");
    const relationshipId = createCanonicalId("relationship");
    const now = toInstant(new Date());
    const constitution = {
      schemaVersion: 1,
      displayName: "Amina Bello",
      biography: "A persistent fictional character.",
      personality: ["warm", "curious"],
      boundaries: ["Keep private relationship state scoped."],
      disclosurePolicy: { aiNature: "disclose" },
      languages: ["ha", "en"],
      voiceReferences: [],
      appearanceReferences: [],
      expertise: ["education"],
    } as const;

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await createUser(client, { tenantId, userId, createdAt: now });
      const character = await createCharacter(client, {
        tenantId,
        characterId,
        createdAt: now,
      });
      await createCharacterVersion(client, {
        tenantId,
        characterVersionId,
        characterId,
        versionNumber: 1,
        constitution,
        createdAt: now,
      });

      await expect(
        activateCharacterVersion(client, {
          tenantId,
          characterId,
          characterVersionId,
          expectedCharacterRevision: character.revision,
          activatedAt: now,
        }),
      ).rejects.toMatchObject({
        code: "identity.character_version_not_activatable",
      });

      await publishCharacterVersion(client, {
        tenantId,
        characterVersionId,
        publishedAt: now,
      });
      const activated = await activateCharacterVersion(client, {
        tenantId,
        characterId,
        characterVersionId,
        expectedCharacterRevision: character.revision,
        activatedAt: now,
      });

      expect(activated.activeCharacterVersionId).toBe(characterVersionId);
      expect(activated.revision).toBe(2);

      await expect(
        activateCharacterVersion(client, {
          tenantId,
          characterId,
          characterVersionId,
          expectedCharacterRevision: character.revision,
          activatedAt: now,
        }),
      ).rejects.toMatchObject({
        code: "identity.character_revision_conflict",
      });

      const relationship = await getOrCreateRelationship(client, {
        tenantId,
        relationshipId,
        userId,
        characterId,
        createdAt: now,
      });
      const replay = await getOrCreateRelationship(client, {
        tenantId,
        relationshipId: createCanonicalId("relationship"),
        userId,
        characterId,
        createdAt: now,
      });
      expect(replay.relationshipId).toBe(relationship.relationshipId);
    });

    await expect(
      pool.query(
        `UPDATE identity.character_versions
            SET constitution = '{"schemaVersion":1}'::jsonb
          WHERE tenant_id = $1 AND character_version_id = $2`,
        [tenantId, characterVersionId],
      ),
    ).rejects.toThrow(/immutable/u);
  });

  it("admits simulation input idempotently and settles it with one generation commit", async () => {
    const tenantId = createCanonicalId("tenant");
    const worldId = createCanonicalId("world");
    const initialGenerationId = createCanonicalId("world-generation");
    const nextGenerationId = createCanonicalId("world-generation");
    const now = toInstant("2026-10-01T10:00:00Z");
    const nextTime = toInstant("2026-10-01T10:05:00Z");

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      const world = await createWorld(client, {
        tenantId,
        worldId,
        initialGenerationId,
        policy: {
          schemaVersion: 1,
          catchUpMode: "bounded",
          maxCatchUpSteps: 12,
          spatialEnabled: false,
          automaticCanonEnabled: true,
        },
        simulationTime: now,
        createdAt: now,
      });
      expect(world.currentGenerationNumber).toBe(0);

      const first = await admitSimulationInput(client, {
        tenantId,
        worldId,
        idempotencyKey: "routine:morning:2026-10-01",
        kind: "routine.due",
        payload: { routineId: "morning" },
        receivedAt: now,
        effectiveAt: nextTime,
      });
      const replay = await admitSimulationInput(client, {
        tenantId,
        worldId,
        idempotencyKey: "routine:morning:2026-10-01",
        kind: "routine.due",
        payload: { routineId: "morning" },
        receivedAt: nextTime,
        effectiveAt: nextTime,
      });
      expect(replay.sequence).toBe(first.sequence);

      await expect(
        admitSimulationInput(client, {
          tenantId,
          worldId,
          idempotencyKey: "routine:morning:2026-10-01",
          kind: "routine.due",
          payload: { routineId: "different" },
          receivedAt: nextTime,
          effectiveAt: nextTime,
        }),
      ).rejects.toMatchObject({
        code: "world.simulation_input_conflict",
      });

      const committed = await commitWorldGeneration(client, {
        tenantId,
        worldId,
        expectedGenerationNumber: 0,
        nextGenerationId,
        simulationTime: nextTime,
        committedAt: nextTime,
        completedInputSequences: [first.sequence],
      });

      expect(committed.world.currentGenerationNumber).toBe(1);
      expect(committed.world.currentGenerationId).toBe(nextGenerationId);
      expect(committed.generation.previousGenerationId).toBe(
        initialGenerationId,
      );
      expect(committed.completedInputs).toHaveLength(1);
      expect(committed.completedInputs[0]?.state).toBe("completed");
      expect(committed.completedInputs[0]?.completedGenerationNumber).toBe(1);
    });
  });

  it("rejects stale competing world generations and backward simulation time", async () => {
    const tenantId = createCanonicalId("tenant");
    const otherTenantId = createCanonicalId("tenant");
    const worldId = createCanonicalId("world");
    const initialGenerationId = createCanonicalId("world-generation");
    const now = toInstant("2026-10-01T11:00:00Z");
    const nextTime = toInstant("2026-10-01T11:01:00Z");

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await createTenant(client, { tenantId: otherTenantId, createdAt: now });
      await createWorld(client, {
        tenantId,
        worldId,
        initialGenerationId,
        policy: {
          schemaVersion: 1,
          catchUpMode: "skip",
          maxCatchUpSteps: 0,
          spatialEnabled: false,
          automaticCanonEnabled: false,
        },
        simulationTime: now,
        createdAt: now,
      });
    });

    const competing = await Promise.allSettled([
      withTransaction(pool, (client) =>
        commitWorldGeneration(client, {
          tenantId,
          worldId,
          expectedGenerationNumber: 0,
          nextGenerationId: createCanonicalId("world-generation"),
          simulationTime: nextTime,
          committedAt: nextTime,
          completedInputSequences: [],
        }),
      ),
      withTransaction(pool, (client) =>
        commitWorldGeneration(client, {
          tenantId,
          worldId,
          expectedGenerationNumber: 0,
          nextGenerationId: createCanonicalId("world-generation"),
          simulationTime: nextTime,
          committedAt: nextTime,
          completedInputSequences: [],
        }),
      ),
    ]);

    expect(competing.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(competing.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rejected = competing.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({
      reason: expect.objectContaining({ code: "world.generation_conflict" }),
    });

    await withTransaction(pool, async (client) => {
      const current = await getWorld(client, tenantId, worldId);
      expect(current?.currentGenerationNumber).toBe(1);
      await expect(
        getWorld(client, otherTenantId, worldId),
      ).resolves.toBeNull();

      await expect(
        commitWorldGeneration(client, {
          tenantId,
          worldId,
          expectedGenerationNumber: 1,
          nextGenerationId: createCanonicalId("world-generation"),
          simulationTime: toInstant("2026-10-01T10:59:59Z"),
          committedAt: nextTime,
          completedInputSequences: [],
        }),
      ).rejects.toMatchObject({
        code: "world.simulation_time_regression",
      });
    });
  });

  it("recovers bounded routine catch-up in generation-recorded batches without duplicates", async () => {
    const tenantId = createCanonicalId("tenant");
    const worldId = createCanonicalId("world");
    const characterId = createCanonicalId("character");
    const versionId = createCanonicalId("character-version");
    const initialGenerationId = createCanonicalId("world-generation");
    const now = toInstant("2026-10-01T06:55:00Z");
    const resumeTo = toInstant("2026-10-03T08:00:00Z");

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await createWorld(client, {
        tenantId,
        worldId,
        initialGenerationId,
        policy: {
          schemaVersion: 1,
          catchUpMode: "bounded",
          maxCatchUpSteps: 1,
          spatialEnabled: false,
          automaticCanonEnabled: true,
        },
        simulationTime: now,
        createdAt: now,
      });
      const character = await createCharacter(client, {
        tenantId,
        characterId,
        createdAt: now,
      });
      await createCharacterVersion(client, {
        tenantId,
        characterVersionId: versionId,
        characterId,
        versionNumber: 1,
        constitution: testCharacterConstitution(),
        createdAt: now,
      });
      await publishCharacterVersion(client, {
        tenantId,
        characterVersionId: versionId,
        publishedAt: now,
      });
      await activateCharacterVersion(client, {
        tenantId,
        characterId,
        characterVersionId: versionId,
        expectedCharacterRevision: character.revision,
        activatedAt: now,
      });
      await putRoutine(client, {
        tenantId,
        worldId,
        routineKey: "morning",
        characterId,
        characterVersionId: versionId,
        expectedRevision: null,
        timezone: "Africa/Lagos",
        localTime: "08:00",
        enabled: true,
        inputKind: "routine.due",
        inputPayload: { activity: "morning" },
        updatedAt: now,
      });

      const paused = await pauseWorld(client, {
        tenantId,
        worldId,
        expectedRevision: 1,
        pausedAt: now,
      });
      expect(paused).toMatchObject({
        status: "paused",
        revision: 2,
        pausedAt: now,
      });

      await expect(
        commitWorldGeneration(client, {
          tenantId,
          worldId,
          expectedGenerationNumber: 0,
          nextGenerationId: createCanonicalId("world-generation"),
          simulationTime: toInstant("2026-10-01T07:00:00Z"),
          committedAt: toInstant("2026-10-01T07:00:00Z"),
          completedInputSequences: [],
        }),
      ).rejects.toMatchObject({ code: "world.not_active" });

      const first = await recoverPausedWorld(client, {
        tenantId,
        worldId,
        expectedRevision: 2,
        nextGenerationId: createCanonicalId("world-generation"),
        resumeTo,
        requestedAt: toInstant("2026-10-03T08:01:00Z"),
      });
      expect(first.complete).toBe(false);
      expect(first.world).toMatchObject({
        status: "paused",
        revision: 3,
        currentGenerationNumber: 1,
        simulationTime: toInstant("2026-10-01T07:00:00Z"),
        recoveryTargetTime: resumeTo,
      });
      expect(first.admittedInputs).toHaveLength(1);

      const second = await recoverPausedWorld(client, {
        tenantId,
        worldId,
        expectedRevision: 3,
        nextGenerationId: createCanonicalId("world-generation"),
        resumeTo,
        requestedAt: toInstant("2026-10-03T08:02:00Z"),
      });
      expect(second.complete).toBe(false);
      expect(second.world).toMatchObject({
        status: "paused",
        revision: 4,
        currentGenerationNumber: 2,
        simulationTime: toInstant("2026-10-02T07:00:00Z"),
        recoveryTargetTime: resumeTo,
      });
      expect(second.admittedInputs).toHaveLength(1);

      const third = await recoverPausedWorld(client, {
        tenantId,
        worldId,
        expectedRevision: 4,
        nextGenerationId: createCanonicalId("world-generation"),
        resumeTo,
        requestedAt: toInstant("2026-10-03T08:03:00Z"),
      });
      expect(third.complete).toBe(true);
      expect(third.world).toMatchObject({
        status: "active",
        revision: 5,
        currentGenerationNumber: 3,
        simulationTime: resumeTo,
        pausedAt: null,
        recoveryTargetTime: null,
      });
      expect(third.admittedInputs).toHaveLength(1);

      const admitted = await client.query<{
        idempotency_key: string;
        effective_at: Date;
      }>(
        `SELECT idempotency_key, effective_at
           FROM world.simulation_inputs
          WHERE tenant_id = $1
            AND world_id = $2
            AND kind = 'routine.due'
          ORDER BY effective_at`,
        [tenantId, worldId],
      );
      expect(admitted.rows).toHaveLength(3);
      expect(new Set(admitted.rows.map((row) => row.idempotency_key)).size).toBe(3);
      expect(
        admitted.rows.map((row) => row.effective_at.toISOString()),
      ).toEqual([
        "2026-10-01T07:00:00.000Z",
        "2026-10-02T07:00:00.000Z",
        "2026-10-03T07:00:00.000Z",
      ]);
    });
  });

  it("applies skip recovery without replaying routines while preserving queued inputs", async () => {
    const tenantId = createCanonicalId("tenant");
    const worldId = createCanonicalId("world");
    const now = toInstant("2026-10-01T10:00:00Z");
    const resumeTo = toInstant("2026-10-02T10:00:00Z");

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await createWorld(client, {
        tenantId,
        worldId,
        initialGenerationId: createCanonicalId("world-generation"),
        policy: {
          schemaVersion: 1,
          catchUpMode: "skip",
          maxCatchUpSteps: 0,
          spatialEnabled: false,
          automaticCanonEnabled: false,
        },
        simulationTime: now,
        createdAt: now,
      });
      await pauseWorld(client, {
        tenantId,
        worldId,
        expectedRevision: 1,
        pausedAt: now,
      });
      const queued = await admitSimulationInput(client, {
        tenantId,
        worldId,
        idempotencyKey: "external:queued:1",
        kind: "external.command",
        payload: { command: "queued while paused" },
        receivedAt: toInstant("2026-10-01T11:00:00Z"),
        effectiveAt: toInstant("2026-10-01T11:00:00Z"),
      });

      const recovered = await recoverPausedWorld(client, {
        tenantId,
        worldId,
        expectedRevision: 2,
        nextGenerationId: createCanonicalId("world-generation"),
        resumeTo,
        requestedAt: resumeTo,
      });
      expect(recovered.complete).toBe(true);
      expect(recovered.admittedInputs).toEqual([]);
      expect(recovered.world).toMatchObject({
        status: "active",
        currentGenerationNumber: 1,
        simulationTime: resumeTo,
        pausedAt: null,
      });

      const committed = await commitWorldGeneration(client, {
        tenantId,
        worldId,
        expectedGenerationNumber: 1,
        nextGenerationId: createCanonicalId("world-generation"),
        simulationTime: resumeTo,
        committedAt: resumeTo,
        completedInputSequences: [queued.sequence],
      });
      expect(committed.completedInputs[0]?.state).toBe("completed");
      expect(committed.world.currentGenerationNumber).toBe(2);
    });
  });

  it("keeps manual-recovery Worlds paused until operator reconciliation", async () => {
    const tenantId = createCanonicalId("tenant");
    const worldId = createCanonicalId("world");
    const now = toInstant("2026-10-01T16:00:00Z");

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await createWorld(client, {
        tenantId,
        worldId,
        initialGenerationId: createCanonicalId("world-generation"),
        policy: {
          schemaVersion: 1,
          catchUpMode: "manual",
          maxCatchUpSteps: 0,
          spatialEnabled: false,
          automaticCanonEnabled: false,
        },
        simulationTime: now,
        createdAt: now,
      });
      await pauseWorld(client, {
        tenantId,
        worldId,
        expectedRevision: 1,
        pausedAt: now,
      });

      await expect(
        recoverPausedWorld(client, {
          tenantId,
          worldId,
          expectedRevision: 2,
          nextGenerationId: createCanonicalId("world-generation"),
          resumeTo: toInstant("2026-10-02T16:00:00Z"),
          requestedAt: toInstant("2026-10-02T16:00:00Z"),
        }),
      ).rejects.toMatchObject({ code: "world.manual_recovery_required" });

      await expect(getWorld(client, tenantId, worldId)).resolves.toMatchObject({
        status: "paused",
        revision: 2,
        currentGenerationNumber: 0,
        simulationTime: now,
      });
    });
  });

  it("rejects private relationship, user, and memory references at shared World ingress", async () => {
    const tenantId = createCanonicalId("tenant");
    const worldId = createCanonicalId("world");
    const characterId = createCanonicalId("character");
    const versionId = createCanonicalId("character-version");
    const relationshipId = createCanonicalId("relationship");
    const userId = createCanonicalId("user");
    const memoryId = createCanonicalId("memory-record");
    const now = toInstant("2026-10-01T11:30:00Z");

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await createWorld(client, {
        tenantId,
        worldId,
        initialGenerationId: createCanonicalId("world-generation"),
        policy: testWorldPolicy(),
        simulationTime: now,
        createdAt: now,
      });
      const character = await createCharacter(client, {
        tenantId,
        characterId,
        createdAt: now,
      });
      await createCharacterVersion(client, {
        tenantId,
        characterVersionId: versionId,
        characterId,
        versionNumber: 1,
        constitution: testCharacterConstitution(),
        createdAt: now,
      });
      await publishCharacterVersion(client, {
        tenantId,
        characterVersionId: versionId,
        publishedAt: now,
      });
      await activateCharacterVersion(client, {
        tenantId,
        characterId,
        characterVersionId: versionId,
        expectedCharacterRevision: character.revision,
        activatedAt: now,
      });

      await expect(
        admitSimulationInput(client, {
          tenantId,
          worldId,
          idempotencyKey: "private-leak-input",
          kind: "external.command",
          payload: {
            nested: {
              source: relationshipId,
            },
          },
          receivedAt: now,
          effectiveAt: now,
        }),
      ).rejects.toMatchObject({ code: "world.private_reference_forbidden" });

      await expect(
        appendWorldEvent(client, {
          tenantId,
          worldId,
          worldEventId: createCanonicalId("world-event"),
          characterId,
          characterVersionId: versionId,
          eventKind: "life.note",
          payload: {
            note: `Do not expose memory ${memoryId}`,
          },
          provenance: "authored",
          visibility: "shared",
          occurrenceKey: null,
          effectiveStart: now,
          effectiveEnd: null,
          recordedAt: now,
          admission: "draft",
        }),
      ).rejects.toMatchObject({ code: "world.private_reference_forbidden" });

      await expect(
        putRoutine(client, {
          tenantId,
          worldId,
          routineKey: "private-routine",
          characterId,
          characterVersionId: versionId,
          expectedRevision: null,
          timezone: "Africa/Lagos",
          localTime: "12:30",
          enabled: true,
          inputKind: "routine.private",
          inputPayload: {
            memoryRecordId: memoryId,
          },
          updatedAt: now,
        }),
      ).rejects.toMatchObject({ code: "world.private_reference_forbidden" });

      await expect(
        putCharacterLifeState(client, {
          tenantId,
          worldId,
          characterId,
          characterVersionId: versionId,
          expectedRevision: null,
          availability: "available",
          narrativeState: null,
          activeGoal: `Serve private user ${userId}`,
          storyArc: null,
          coarseLocation: "Kano",
          effectiveAt: now,
          updatedAt: now,
        }),
      ).rejects.toMatchObject({ code: "world.private_reference_forbidden" });

      await expect(
        putStoryArc(client, {
          tenantId,
          worldId,
          storyArcKey: "private-arc",
          characterId,
          characterVersionId: versionId,
          expectedRevision: null,
          state: "planned",
          title: "Private arc",
          summary: `Derived from ${relationshipId}`,
          updatedAt: now,
        }),
      ).rejects.toMatchObject({ code: "world.private_reference_forbidden" });

      const counts = await client.query<{
        inputs: string;
        events: string;
        routines: string;
        life_states: string;
        story_arcs: string;
      }>(
        `SELECT
           (SELECT count(*)::text
              FROM world.simulation_inputs
             WHERE tenant_id = $1 AND world_id = $2) AS inputs,
           (SELECT count(*)::text
              FROM world.events
             WHERE tenant_id = $1 AND world_id = $2) AS events,
           (SELECT count(*)::text
              FROM world.routines
             WHERE tenant_id = $1 AND world_id = $2) AS routines,
           (SELECT count(*)::text
              FROM world.character_life_state
             WHERE tenant_id = $1 AND world_id = $2) AS life_states,
           (SELECT count(*)::text
              FROM world.story_arcs
             WHERE tenant_id = $1 AND world_id = $2) AS story_arcs`,
        [tenantId, worldId],
      );
      expect(counts.rows[0]).toEqual({
        inputs: "0",
        events: "0",
        routines: "0",
        life_states: "0",
        story_arcs: "0",
      });
    });
  });

  it("gates Character life state on active published identity and revision CAS", async () => {
    const tenantId = createCanonicalId("tenant");
    const worldId = createCanonicalId("world");
    const characterId = createCanonicalId("character");
    const versionId = createCanonicalId("character-version");
    const now = toInstant("2026-10-01T12:00:00Z");

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await createWorld(client, {
        tenantId,
        worldId,
        initialGenerationId: createCanonicalId("world-generation"),
        policy: testWorldPolicy(),
        simulationTime: now,
        createdAt: now,
      });
      const character = await createCharacter(client, {
        tenantId,
        characterId,
        createdAt: now,
      });
      await createCharacterVersion(client, {
        tenantId,
        characterVersionId: versionId,
        characterId,
        versionNumber: 1,
        constitution: testCharacterConstitution(),
        createdAt: now,
      });

      const write = (expectedRevision: number | null, availability: string) =>
        putCharacterLifeState(client, {
          tenantId,
          worldId,
          characterId,
          characterVersionId: versionId,
          expectedRevision,
          availability,
          narrativeState: null,
          activeGoal: null,
          storyArc: null,
          coarseLocation: "Kano",
          effectiveAt: now,
          updatedAt: now,
        });

      await expect(write(null, "available")).rejects.toMatchObject({
        code: "world.character_version_not_active",
      });

      await publishCharacterVersion(client, {
        tenantId,
        characterVersionId: versionId,
        publishedAt: now,
      });
      await activateCharacterVersion(client, {
        tenantId,
        characterId,
        characterVersionId: versionId,
        expectedCharacterRevision: character.revision,
        activatedAt: now,
      });

      await expect(write(null, "available")).resolves.toMatchObject({
        revision: 1,
        availability: "available",
      });
      await expect(write(1, "busy")).resolves.toMatchObject({
        revision: 2,
        availability: "busy",
      });
      await expect(write(1, "offline")).rejects.toMatchObject({
        code: "world.life_state_revision_conflict",
      });

      await expect(
        putCharacterLifeState(client, {
          tenantId,
          worldId,
          characterId,
          characterVersionId: versionId,
          expectedRevision: 2,
          availability: "future",
          narrativeState: null,
          activeGoal: null,
          storyArc: null,
          coarseLocation: "Kano",
          effectiveAt: toInstant("2026-10-01T12:01:00Z"),
          updatedAt: toInstant("2026-10-01T12:01:00Z"),
        }),
      ).rejects.toMatchObject({ code: "world.life_state_from_future" });

      await commitWorldGeneration(client, {
        tenantId,
        worldId,
        expectedGenerationNumber: 0,
        nextGenerationId: createCanonicalId("world-generation"),
        simulationTime: toInstant("2026-10-01T12:10:00Z"),
        committedAt: toInstant("2026-10-01T12:10:00Z"),
        completedInputSequences: [],
      });

      await expect(
        putCharacterLifeState(client, {
          tenantId,
          worldId,
          characterId,
          characterVersionId: versionId,
          expectedRevision: 2,
          availability: "past",
          narrativeState: null,
          activeGoal: null,
          storyArc: null,
          coarseLocation: "Kano",
          effectiveAt: toInstant("2026-10-01T11:59:00Z"),
          updatedAt: toInstant("2026-10-01T12:10:00Z"),
        }),
      ).rejects.toMatchObject({ code: "world.life_state_time_regression" });
    });
  });

  it("gates automatic canon on active CharacterVersion and keeps approved content immutable", async () => {
    const tenantId = createCanonicalId("tenant");
    const worldId = createCanonicalId("world");
    const characterId = createCanonicalId("character");
    const versionId = createCanonicalId("character-version");
    const approvedEventId = createCanonicalId("world-event");
    const now = toInstant("2026-10-01T13:00:00Z");

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await createWorld(client, {
        tenantId,
        worldId,
        initialGenerationId: createCanonicalId("world-generation"),
        policy: testWorldPolicy(),
        simulationTime: now,
        createdAt: now,
      });
      const character = await createCharacter(client, {
        tenantId,
        characterId,
        createdAt: now,
      });
      await createCharacterVersion(client, {
        tenantId,
        characterVersionId: versionId,
        characterId,
        versionNumber: 1,
        constitution: testCharacterConstitution(),
        createdAt: now,
      });

      const automatic = (worldEventId: typeof approvedEventId, payload: { activity: string }) =>
        appendWorldEvent(client, {
          tenantId,
          worldId,
          worldEventId,
          characterId,
          characterVersionId: versionId,
          eventKind: "life.activity",
          payload,
          provenance: "engine",
          visibility: "shared",
          occurrenceKey: "routine:morning:2026-10-01",
          effectiveStart: now,
          effectiveEnd: null,
          recordedAt: now,
          admission: "automatic-approved",
        });

      await expect(
        automatic(approvedEventId, { activity: "teaching" }),
      ).rejects.toMatchObject({ code: "world.character_version_not_active" });

      await publishCharacterVersion(client, {
        tenantId,
        characterVersionId: versionId,
        publishedAt: now,
      });
      await activateCharacterVersion(client, {
        tenantId,
        characterId,
        characterVersionId: versionId,
        expectedCharacterRevision: character.revision,
        activatedAt: now,
      });

      const approved = await automatic(approvedEventId, { activity: "teaching" });
      expect(approved.canonState).toBe("approved");

      await expect(
        appendWorldEvent(client, {
          tenantId,
          worldId,
          worldEventId: createCanonicalId("world-event"),
          characterId,
          characterVersionId: versionId,
          eventKind: "life.model-proposal",
          payload: { activity: "speculative" },
          provenance: "model",
          visibility: "internal",
          occurrenceKey: null,
          effectiveStart: now,
          effectiveEnd: null,
          recordedAt: now,
          admission: "automatic-approved",
        }),
      ).rejects.toMatchObject({
        code: "world.automatic_canon_provenance_forbidden",
      });

      const manualWorldId = createCanonicalId("world");
      await createWorld(client, {
        tenantId,
        worldId: manualWorldId,
        initialGenerationId: createCanonicalId("world-generation"),
        policy: {
          ...testWorldPolicy(),
          automaticCanonEnabled: false,
        },
        simulationTime: now,
        createdAt: now,
      });
      await expect(
        appendWorldEvent(client, {
          tenantId,
          worldId: manualWorldId,
          worldEventId: createCanonicalId("world-event"),
          characterId,
          characterVersionId: versionId,
          eventKind: "life.activity",
          payload: { activity: "teaching" },
          provenance: "engine",
          visibility: "shared",
          occurrenceKey: null,
          effectiveStart: now,
          effectiveEnd: null,
          recordedAt: now,
          admission: "automatic-approved",
        }),
      ).rejects.toMatchObject({ code: "world.automatic_canon_disabled" });

      const replay = await automatic(
        createCanonicalId("world-event"),
        { activity: "teaching" },
      );
      expect(replay.worldEventId).toBe(approvedEventId);

      await expect(
        automatic(createCanonicalId("world-event"), { activity: "travelling" }),
      ).rejects.toMatchObject({ code: "world.event_occurrence_conflict" });

      const draft = await appendWorldEvent(client, {
        tenantId,
        worldId,
        worldEventId: createCanonicalId("world-event"),
        characterId,
        characterVersionId: versionId,
        eventKind: "canon.authored",
        payload: { note: "approved by operator" },
        provenance: "authored",
        visibility: "shared",
        occurrenceKey: null,
        effectiveStart: now,
        effectiveEnd: null,
        recordedAt: now,
        admission: "draft",
      });
      expect(draft.canonState).toBe("draft");
    });

    await expect(
      pool.query(
        `UPDATE world.events
            SET payload = '{"activity":"rewritten"}'::jsonb
          WHERE tenant_id = $1 AND world_event_id = $2`,
        [tenantId, approvedEventId],
      ),
    ).rejects.toThrow(/immutable/u);
  });

  it("persists version-bound WorldInteraction evidence with replay-safe canon admission", async () => {
    const tenantId = createCanonicalId("tenant");
    const otherTenantId = createCanonicalId("tenant");
    const worldId = createCanonicalId("world");
    const manualWorldId = createCanonicalId("world");
    const characterA = createCanonicalId("character");
    const characterB = createCanonicalId("character");
    const versionA = createCanonicalId("character-version");
    const versionB = createCanonicalId("character-version");
    const approvedInteractionId = createCanonicalId("world-interaction");
    const now = toInstant("2026-10-01T14:30:00Z");

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await createTenant(client, { tenantId: otherTenantId, createdAt: now });
      await createWorld(client, {
        tenantId,
        worldId,
        initialGenerationId: createCanonicalId("world-generation"),
        policy: testWorldPolicy(),
        simulationTime: now,
        createdAt: now,
      });
      await createWorld(client, {
        tenantId,
        worldId: manualWorldId,
        initialGenerationId: createCanonicalId("world-generation"),
        policy: { ...testWorldPolicy(), automaticCanonEnabled: false },
        simulationTime: now,
        createdAt: now,
      });

      const a = await createCharacter(client, {
        tenantId,
        characterId: characterA,
        createdAt: now,
      });
      const b = await createCharacter(client, {
        tenantId,
        characterId: characterB,
        createdAt: now,
      });
      await createCharacterVersion(client, {
        tenantId,
        characterVersionId: versionA,
        characterId: characterA,
        versionNumber: 1,
        constitution: testCharacterConstitution(),
        createdAt: now,
      });
      await createCharacterVersion(client, {
        tenantId,
        characterVersionId: versionB,
        characterId: characterB,
        versionNumber: 1,
        constitution: testCharacterConstitution(),
        createdAt: now,
      });

      const automatic = (
        worldInteractionId: typeof approvedInteractionId,
        payload: { topic: string },
      ) =>
        appendWorldInteraction(client, {
          tenantId,
          worldId,
          worldInteractionId,
          interactionKind: "conversation",
          participants: [
            {
              characterId: characterB,
              characterVersionId: versionB,
              role: "listener",
            },
            {
              characterId: characterA,
              characterVersionId: versionA,
              role: "speaker",
            },
          ],
          payload,
          provenance: "engine",
          visibility: "shared",
          occurrenceKey: "interaction:lesson:2026-10-01",
          effectiveStart: now,
          effectiveEnd: null,
          recordedAt: now,
          admission: "automatic-approved",
        });

      await expect(
        automatic(approvedInteractionId, { topic: "lesson" }),
      ).rejects.toMatchObject({ code: "world.character_version_not_active" });

      for (const [characterId, characterVersionId, revision] of [
        [characterA, versionA, a.revision],
        [characterB, versionB, b.revision],
      ] as const) {
        await publishCharacterVersion(client, {
          tenantId,
          characterVersionId,
          publishedAt: now,
        });
        await activateCharacterVersion(client, {
          tenantId,
          characterId,
          characterVersionId,
          expectedCharacterRevision: revision,
          activatedAt: now,
        });
      }

      const approved = await automatic(approvedInteractionId, { topic: "lesson" });
      expect(approved.canonState).toBe("approved");
      expect(approved.participants.map((participant) => participant.characterId)).toEqual(
        [characterA, characterB].sort(),
      );

      const replay = await automatic(
        createCanonicalId("world-interaction"),
        { topic: "lesson" },
      );
      expect(replay.worldInteractionId).toBe(approvedInteractionId);

      await expect(
        automatic(createCanonicalId("world-interaction"), {
          topic: "different lesson",
        }),
      ).rejects.toMatchObject({ code: "world.interaction_occurrence_conflict" });

      await expect(
        appendWorldInteraction(client, {
          tenantId,
          worldId,
          worldInteractionId: createCanonicalId("world-interaction"),
          interactionKind: "conversation",
          participants: [
            {
              characterId: characterA,
              characterVersionId: versionA,
              role: "speaker",
            },
            {
              characterId: characterB,
              characterVersionId: versionB,
              role: "listener",
            },
          ],
          payload: { topic: "model proposal" },
          provenance: "model",
          visibility: "internal",
          occurrenceKey: null,
          effectiveStart: now,
          effectiveEnd: null,
          recordedAt: now,
          admission: "automatic-approved",
        }),
      ).rejects.toMatchObject({
        code: "world.automatic_canon_provenance_forbidden",
      });

      await expect(
        appendWorldInteraction(client, {
          tenantId,
          worldId: manualWorldId,
          worldInteractionId: createCanonicalId("world-interaction"),
          interactionKind: "conversation",
          participants: [
            {
              characterId: characterA,
              characterVersionId: versionA,
              role: "speaker",
            },
            {
              characterId: characterB,
              characterVersionId: versionB,
              role: "listener",
            },
          ],
          payload: { topic: "manual world" },
          provenance: "engine",
          visibility: "shared",
          occurrenceKey: null,
          effectiveStart: now,
          effectiveEnd: null,
          recordedAt: now,
          admission: "automatic-approved",
        }),
      ).rejects.toMatchObject({ code: "world.automatic_canon_disabled" });

      const draft = await appendWorldInteraction(client, {
        tenantId,
        worldId,
        worldInteractionId: createCanonicalId("world-interaction"),
        interactionKind: "authored-meeting",
        participants: [
          {
            characterId: characterA,
            characterVersionId: versionA,
            role: "host",
          },
          {
            characterId: characterB,
            characterVersionId: versionB,
            role: "guest",
          },
        ],
        payload: { note: "operator-authored" },
        provenance: "authored",
        visibility: "shared",
        occurrenceKey: null,
        effectiveStart: now,
        effectiveEnd: null,
        recordedAt: now,
        admission: "draft",
      });
      expect(draft.canonState).toBe("draft");

      await expect(
        getWorldInteraction(client, otherTenantId, approvedInteractionId),
      ).resolves.toBeNull();
    });

    await expect(
      pool.query(
        `UPDATE world.interactions
            SET payload = '{"topic":"rewritten"}'::jsonb
          WHERE tenant_id = $1 AND world_interaction_id = $2`,
        [tenantId, approvedInteractionId],
      ),
    ).rejects.toThrow(/immutable/u);

    await expect(
      pool.query(
        `DELETE FROM world.interaction_participants
          WHERE tenant_id = $1 AND world_interaction_id = $2 AND ordinal = 0`,
        [tenantId, approvedInteractionId],
      ),
    ).rejects.toThrow(/immutable/u);
  });

  it("publishes World evidence once to memory and workflow outboxes across replay", async () => {
    const tenantId = createCanonicalId("tenant");
    const worldId = createCanonicalId("world");
    const characterA = createCanonicalId("character");
    const characterB = createCanonicalId("character");
    const versionA = createCanonicalId("character-version");
    const versionB = createCanonicalId("character-version");
    const eventId = createCanonicalId("world-event");
    const interactionId = createCanonicalId("world-interaction");
    const now = toInstant("2026-10-01T14:45:00Z");

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await createWorld(client, {
        tenantId,
        worldId,
        initialGenerationId: createCanonicalId("world-generation"),
        policy: testWorldPolicy(),
        simulationTime: now,
        createdAt: now,
      });

      const a = await createCharacter(client, {
        tenantId,
        characterId: characterA,
        createdAt: now,
      });
      const b = await createCharacter(client, {
        tenantId,
        characterId: characterB,
        createdAt: now,
      });
      for (const [characterId, characterVersionId, revision] of [
        [characterA, versionA, a.revision],
        [characterB, versionB, b.revision],
      ] as const) {
        await createCharacterVersion(client, {
          tenantId,
          characterVersionId,
          characterId,
          versionNumber: 1,
          constitution: testCharacterConstitution(),
          createdAt: now,
        });
        await publishCharacterVersion(client, {
          tenantId,
          characterVersionId,
          publishedAt: now,
        });
        await activateCharacterVersion(client, {
          tenantId,
          characterId,
          characterVersionId,
          expectedCharacterRevision: revision,
          activatedAt: now,
        });
      }

      const appendEvent = (worldEventId: typeof eventId) =>
        appendWorldEvent(client, {
          tenantId,
          worldId,
          worldEventId,
          characterId: characterA,
          characterVersionId: versionA,
          eventKind: "life.lesson.started",
          payload: { lesson: "geometry" },
          provenance: "engine",
          visibility: "shared",
          occurrenceKey: "lesson:geometry:2026-10-01",
          effectiveStart: now,
          effectiveEnd: null,
          recordedAt: now,
          admission: "automatic-approved",
        });

      const firstEvent = await appendEvent(eventId);
      const replayEvent = await appendEvent(createCanonicalId("world-event"));
      expect(replayEvent.worldEventId).toBe(firstEvent.worldEventId);

      const appendInteraction = (worldInteractionId: typeof interactionId) =>
        appendWorldInteraction(client, {
          tenantId,
          worldId,
          worldInteractionId,
          interactionKind: "lesson-dialogue",
          participants: [
            {
              characterId: characterA,
              characterVersionId: versionA,
              role: "teacher",
            },
            {
              characterId: characterB,
              characterVersionId: versionB,
              role: "student",
            },
          ],
          payload: { lesson: "geometry" },
          provenance: "engine",
          visibility: "shared",
          occurrenceKey: "lesson-dialogue:geometry:2026-10-01",
          effectiveStart: now,
          effectiveEnd: null,
          recordedAt: now,
          admission: "automatic-approved",
        });

      const firstInteraction = await appendInteraction(interactionId);
      const replayInteraction = await appendInteraction(
        createCanonicalId("world-interaction"),
      );
      expect(replayInteraction.worldInteractionId).toBe(
        firstInteraction.worldInteractionId,
      );

      const publications = await client.query<{
        evidence_kind: string;
        evidence_id: string;
        event_id: string;
      }>(
        `SELECT evidence_kind, evidence_id, event_id
           FROM world.evidence_publications
          WHERE tenant_id = $1
          ORDER BY evidence_kind, evidence_id`,
        [tenantId],
      );
      expect(publications.rows).toHaveLength(2);
      expect(publications.rows.map((row) => row.evidence_kind).sort()).toEqual([
        "event",
        "interaction",
      ]);

      const platformEvents = await client.query<{
        event_id: string;
        event_type: string;
        aggregate_type: string;
        sensitivity: string;
        payload: {
          evidenceKind: string;
          canonState: string;
          worldId: string;
        };
      }>(
        `SELECT event_id,
                event_type,
                aggregate_type,
                sensitivity,
                payload
           FROM events.platform_events
          WHERE tenant_id = $1
            AND event_type = 'world.evidence.recorded'
          ORDER BY aggregate_type`,
        [tenantId],
      );
      expect(platformEvents.rows).toHaveLength(2);
      expect(platformEvents.rows.every((row) => row.sensitivity === "internal")).toBe(true);
      expect(
        platformEvents.rows.every(
          (row) =>
            row.payload.canonState === "approved" &&
            row.payload.worldId === worldId,
        ),
      ).toBe(true);

      const outbox = await client.query<{
        event_id: string;
        destination: string;
        payload: { evidenceKind: string };
      }>(
        `SELECT event_id, destination, payload
           FROM events.outbox
          WHERE tenant_id = $1
            AND event_type = 'world.evidence.recorded'
          ORDER BY event_id, destination`,
        [tenantId],
      );
      expect(outbox.rows).toHaveLength(4);
      const byEvent = new Map<string, string[]>();
      for (const row of outbox.rows) {
        byEvent.set(row.event_id, [
          ...(byEvent.get(row.event_id) ?? []),
          row.destination,
        ]);
      }
      expect([...byEvent.values()]).toHaveLength(2);
      for (const destinations of byEvent.values()) {
        expect(destinations.sort()).toEqual([
          "memory.world-evidence",
          "workflows.world-evidence",
        ]);
      }
    });
  });

  it("binds canon approval and retirement to current authority and one-time approvals", async () => {
    const tenantId = createCanonicalId("tenant");
    const worldId = createCanonicalId("world");
    const eventId = createCanonicalId("world-event");
    const now = toInstant("2026-10-01T15:00:00Z");
    const expiresAt = toInstant("2099-01-01T00:00:00Z");

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await setPolicyRevision(client, tenantId, "policy-1");
      await createWorld(client, {
        tenantId,
        worldId,
        initialGenerationId: createCanonicalId("world-generation"),
        policy: testWorldPolicy(),
        simulationTime: now,
        createdAt: now,
      });
      await appendWorldEvent(client, {
        tenantId,
        worldId,
        worldEventId: eventId,
        characterId: null,
        characterVersionId: null,
        eventKind: "canon.authored",
        payload: { note: "governed evidence" },
        provenance: "authored",
        visibility: "shared",
        occurrenceKey: null,
        effectiveStart: now,
        effectiveEnd: null,
        recordedAt: now,
        admission: "draft",
      });
    });

    const principal = { kind: "system", systemKind: "world-operator" } as const;
    const baseAuthority = createAuthorityContext({
      tenantId,
      principal,
      scopes: [],
      capabilities: ["world.canon.approve", "world.canon.retire"],
      resourceScope: { worldIds: [worldId] },
      policyRevision: "policy-1",
      approvalIds: [],
      delegationChain: [],
      expiresAt,
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });

    const preparedApproval = await prepareWorldCanonGovernance(pool, {
        tenantId,
        worldId,
        worldEventId: eventId,
        decision: "approve",
        authority: baseAuthority,
        idempotencyKey: "canon-approve-1",
        expiresAt,
      });
    const approval = createPendingApproval({
      kind: "once",
      binding: preparedApproval.binding,
      policyRevision: "policy-1",
      requestedAt: now,
      expiresAt,
    });
    await withTransaction(pool, async (client) => {
      await persistPendingApproval(client, approval);
      await settlePendingApproval(client, {
        tenantId,
        approvalId: approval.approvalId,
        decision: "approved",
        approverKey: "operator:integration-test",
        decidedAt: now,
      });
    });

    const approveAuthority = createAuthorityContext({
      tenantId,
      principal,
      scopes: [],
      capabilities: ["world.canon.approve", "world.canon.retire"],
      resourceScope: { worldIds: [worldId] },
      policyRevision: "policy-1",
      approvalIds: [approval.approvalId],
      delegationChain: [],
      expiresAt,
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });

    const approved = await executeWorldCanonGovernance(pool, {
        tenantId,
        worldId,
        worldEventId: eventId,
        decision: "approve",
        authority: approveAuthority,
        operationId: preparedApproval.operation.operationId,
        approvalId: approval.approvalId,
        decidedAt: now,
      });
    expect(approved.reused).toBe(false);
    expect(approved.operation.state).toBe("succeeded");
    expect(approved.event.canonState).toBe("approved");

    const replay = await executeWorldCanonGovernance(pool, {
        tenantId,
        worldId,
        worldEventId: eventId,
        decision: "approve",
        authority: approveAuthority,
        operationId: preparedApproval.operation.operationId,
        approvalId: approval.approvalId,
        decidedAt: now,
      });
    expect(replay.reused).toBe(true);
    expect(replay.event.canonState).toBe("approved");

    const preparedRetirement = await prepareWorldCanonGovernance(pool, {
        tenantId,
        worldId,
        worldEventId: eventId,
        decision: "retire",
        authority: baseAuthority,
        idempotencyKey: "canon-retire-1",
        expiresAt,
      });
    const retirementApproval = createPendingApproval({
      kind: "once",
      binding: preparedRetirement.binding,
      policyRevision: "policy-1",
      requestedAt: now,
      expiresAt,
    });
    await withTransaction(pool, async (client) => {
      await persistPendingApproval(client, retirementApproval);
      await settlePendingApproval(client, {
        tenantId,
        approvalId: retirementApproval.approvalId,
        decision: "approved",
        approverKey: "operator:integration-test",
        decidedAt: now,
      });
    });

    const retireAuthority = createAuthorityContext({
      tenantId,
      principal,
      scopes: [],
      capabilities: ["world.canon.approve", "world.canon.retire"],
      resourceScope: { worldIds: [worldId] },
      policyRevision: "policy-1",
      approvalIds: [retirementApproval.approvalId],
      delegationChain: [],
      expiresAt,
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });

    await executeWorldCanonGovernance(pool, {
        tenantId,
        worldId,
        worldEventId: eventId,
        decision: "retire",
        authority: retireAuthority,
        operationId: preparedRetirement.operation.operationId,
        approvalId: retirementApproval.approvalId,
        decidedAt: now,
      }).then((result) => {
      expect(result.event.canonState).toBe("retired");
      expect(result.operation.state).toBe("succeeded");
    });

    const stalePrepared = await withTransaction(pool, (client) =>
      prepareOperation(client, {
        tenantId,
        kind: "world.canon.retire",
        idempotencyKey: "canon-stale-policy",
        authorityScopeHash: preparedRetirement.operation.authorityScopeHash,
        requestFingerprint: preparedRetirement.operation.requestFingerprint,
        expiresAt,
      }),
    );
    const staleBinding = {
      ...preparedRetirement.binding,
      operationId: stalePrepared.operation.operationId,
    };
    const staleApproval = createPendingApproval({
      kind: "once",
      binding: staleBinding,
      policyRevision: "policy-1",
      requestedAt: now,
      expiresAt,
    });
    await withTransaction(pool, async (client) => {
      await persistPendingApproval(client, staleApproval);
      await settlePendingApproval(client, {
        tenantId,
        approvalId: staleApproval.approvalId,
        decision: "approved",
        approverKey: "operator:integration-test",
        decidedAt: now,
      });
      await setPolicyRevision(client, tenantId, "policy-2");
    });

    const staleAuthority = createAuthorityContext({
      tenantId,
      principal,
      scopes: [],
      capabilities: ["world.canon.retire"],
      resourceScope: { worldIds: [worldId] },
      policyRevision: "policy-1",
      approvalIds: [staleApproval.approvalId],
      delegationChain: [],
      expiresAt,
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });
    await expect(
      executeWorldCanonGovernance(pool, {
          tenantId,
          worldId,
          worldEventId: eventId,
          decision: "retire",
          authority: staleAuthority,
          operationId: stalePrepared.operation.operationId,
          approvalId: staleApproval.approvalId,
          decidedAt: now,
        }),
    ).rejects.toMatchObject({ code: "authority.stale_policy" });
  });

  it("admits one timezone routine occurrence per local date and rejects stale CharacterVersion bindings", async () => {
    const tenantId = createCanonicalId("tenant");
    const worldId = createCanonicalId("world");
    const characterId = createCanonicalId("character");
    const version1 = createCanonicalId("character-version");
    const version2 = createCanonicalId("character-version");
    const now = toInstant("2026-10-01T06:55:00Z");

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await createWorld(client, {
        tenantId,
        worldId,
        initialGenerationId: createCanonicalId("world-generation"),
        policy: testWorldPolicy(),
        simulationTime: now,
        createdAt: now,
      });
      const character = await createCharacter(client, {
        tenantId,
        characterId,
        createdAt: now,
      });
      await createCharacterVersion(client, {
        tenantId,
        characterVersionId: version1,
        characterId,
        versionNumber: 1,
        constitution: testCharacterConstitution(),
        createdAt: now,
      });
      await publishCharacterVersion(client, {
        tenantId,
        characterVersionId: version1,
        publishedAt: now,
      });
      await activateCharacterVersion(client, {
        tenantId,
        characterId,
        characterVersionId: version1,
        expectedCharacterRevision: character.revision,
        activatedAt: now,
      });

      const routine = await putRoutine(client, {
        tenantId,
        worldId,
        routineKey: "morning",
        characterId,
        characterVersionId: version1,
        expectedRevision: null,
        timezone: "Africa/Lagos",
        localTime: "08:00",
        enabled: true,
        inputKind: "routine.due",
        inputPayload: { activity: "morning routine" },
        updatedAt: now,
      });
      expect(routine.revision).toBe(1);

      const scheduled = toInstant("2026-10-01T07:00:00Z");
      const first = await admitRoutineOccurrence(client, {
        tenantId,
        worldId,
        routineKey: "morning",
        scheduledFor: scheduled,
        receivedAt: scheduled,
      });
      const replay = await admitRoutineOccurrence(client, {
        tenantId,
        worldId,
        routineKey: "morning",
        scheduledFor: scheduled,
        receivedAt: toInstant("2026-10-01T07:00:05Z"),
      });
      expect(replay.sequence).toBe(first.sequence);

      await expect(
        admitRoutineOccurrence(client, {
          tenantId,
          worldId,
          routineKey: "morning",
          scheduledFor: toInstant("2026-10-01T08:00:00Z"),
          receivedAt: scheduled,
        }),
      ).rejects.toThrow(/expected 08:00/u);

      await createCharacterVersion(client, {
        tenantId,
        characterVersionId: version2,
        characterId,
        versionNumber: 2,
        constitution: testCharacterConstitution(),
        createdAt: now,
      });
      await publishCharacterVersion(client, {
        tenantId,
        characterVersionId: version2,
        publishedAt: now,
      });
      await activateCharacterVersion(client, {
        tenantId,
        characterId,
        characterVersionId: version2,
        expectedCharacterRevision: 2,
        activatedAt: now,
      });

      await expect(
        admitRoutineOccurrence(client, {
          tenantId,
          worldId,
          routineKey: "morning",
          scheduledFor: toInstant("2026-10-02T07:00:00Z"),
          receivedAt: toInstant("2026-10-02T07:00:00Z"),
        }),
      ).rejects.toMatchObject({
        code: "world.character_version_not_active",
      });

      await putRoutine(client, {
        tenantId,
        worldId,
        routineKey: "morning",
        characterId,
        characterVersionId: version2,
        expectedRevision: 1,
        timezone: "Africa/Lagos",
        localTime: "08:00",
        enabled: true,
        inputKind: "routine.due",
        inputPayload: { activity: "morning routine" },
        updatedAt: toInstant("2026-10-02T06:50:00Z"),
      });

      await expect(
        admitRoutineOccurrence(client, {
          tenantId,
          worldId,
          routineKey: "morning",
          scheduledFor: toInstant("2026-10-02T07:00:00Z"),
          receivedAt: toInstant("2026-10-02T07:00:00Z"),
        }),
      ).resolves.toMatchObject({
        state: "admitted",
        kind: "routine.due",
      });
    });
  });

  it("keeps story arcs version-gated, revisioned, and forward-only", async () => {
    const tenantId = createCanonicalId("tenant");
    const worldId = createCanonicalId("world");
    const characterId = createCanonicalId("character");
    const versionId = createCanonicalId("character-version");
    const now = toInstant("2026-10-01T14:00:00Z");

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await createWorld(client, {
        tenantId,
        worldId,
        initialGenerationId: createCanonicalId("world-generation"),
        policy: testWorldPolicy(),
        simulationTime: now,
        createdAt: now,
      });
      const character = await createCharacter(client, {
        tenantId,
        characterId,
        createdAt: now,
      });
      await createCharacterVersion(client, {
        tenantId,
        characterVersionId: versionId,
        characterId,
        versionNumber: 1,
        constitution: testCharacterConstitution(),
        createdAt: now,
      });
      await publishCharacterVersion(client, {
        tenantId,
        characterVersionId: versionId,
        publishedAt: now,
      });
      await activateCharacterVersion(client, {
        tenantId,
        characterId,
        characterVersionId: versionId,
        expectedCharacterRevision: character.revision,
        activatedAt: now,
      });

      const write = (
        expectedRevision: number | null,
        state: "planned" | "active" | "completed" | "retired",
      ) =>
        putStoryArc(client, {
          tenantId,
          worldId,
          storyArcKey: "school-opening",
          characterId,
          characterVersionId: versionId,
          expectedRevision,
          state,
          title: "School opening",
          summary: "Prepare and complete the opening-week arc.",
          updatedAt: now,
        });

      await expect(write(null, "planned")).resolves.toMatchObject({
        state: "planned",
        revision: 1,
      });
      await expect(write(1, "active")).resolves.toMatchObject({
        state: "active",
        revision: 2,
      });
      await expect(write(2, "completed")).resolves.toMatchObject({
        state: "completed",
        revision: 3,
      });
      await expect(write(3, "active")).rejects.toMatchObject({
        code: "world.story_arc_transition_invalid",
      });
      await expect(write(2, "retired")).rejects.toMatchObject({
        code: "world.story_arc_revision_conflict",
      });
    });
  });

  it("reports schema-aware database readiness", async () => {
    await expect(
      checkPostgresReadiness(pool, foundationMigrationRootsForTest),
    ).resolves.toEqual({ ready: true });
  });

  it("fails readiness when a required migration is missing", async () => {
    await pool.query(
      `DELETE FROM public.masanawa_schema_migrations
        WHERE owner = 'security'
          AND name = '0002_approval_operation_integrity.sql'`,
    );

    await expect(
      checkPostgresReadiness(pool, foundationMigrationRootsForTest),
    ).resolves.toEqual({
      ready: false,
      reason: "schema-outdated",
    });
  });

  it("fails readiness when an applied migration hash drifts", async () => {
    await pool.query(
      `UPDATE public.masanawa_schema_migrations
          SET sha256 = 'sha256:tampered'
        WHERE owner = 'events'
          AND name = '0001_event_foundation.sql'`,
    );

    await expect(
      checkPostgresReadiness(pool, foundationMigrationRootsForTest),
    ).resolves.toEqual({
      ready: false,
      reason: "schema-drift",
    });
  });

  it("fails readiness when the schema ledger is absent", async () => {
    await pool.query(
      "DROP TABLE public.masanawa_schema_migrations",
    );

    await expect(
      checkPostgresReadiness(pool, foundationMigrationRootsForTest),
    ).resolves.toEqual({
      ready: false,
      reason: "schema-ledger-missing",
    });
  });

  it("replays package-owned migrations idempotently", async () => {
    const appliedAgain = await runMigrations(pool, [
      { owner: "events", directory: eventMigrationDirectory },
      { owner: "security", directory: securityMigrationDirectory },
    ]);

    expect(appliedAgain).toEqual([]);

    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = 'events'
        ORDER BY table_name`,
    );

    expect(tables.rows.map((row) => row.table_name)).toEqual([
      "audit_events",
      "external_receipts",
      "idempotency_records",
      "inbox",
      "operations",
      "outbox",
      "platform_events",
      "reconciliation_cases",
    ]);
  });

  it("commits a platform event and its outbox custody atomically", async () => {
    const occurredAt = toInstant(new Date());
    const event: PlatformEvent<{ message: string }> = {
      eventId: createCanonicalId("event"),
      eventType: "message.requested",
      schemaVersion: 1,
      tenantId: createCanonicalId("tenant"),
      aggregate: {
        type: "operation",
        id: createCanonicalId("operation"),
        revision: 1,
      },
      occurredAt,
      recordedAt: occurredAt,
      actor: null,
      authorityRef: null,
      correlationId: createCanonicalId("correlation"),
      causationId: null,
      requestId: null,
      workflowRunId: null,
      characterSessionId: null,
      provenance: { source: "foundation-integration" },
      sensitivity: "internal",
      payload: { message: "hello" },
    };

    const outboxEventId = await persistPlatformEventWithOutbox(pool, {
      event,
      outbox: {
        destination: "test-channel",
        availableAt: occurredAt,
        payload: { eventId: event.eventId, message: "hello" },
      },
    });

    const persisted = await pool.query<{
      event_id: string;
      outbox_event_id: string;
      tenant_id: string;
      event_type: string;
      correlation_id: string;
      destination: string;
    }>(
      `SELECT e.event_id,
              o.outbox_event_id,
              o.tenant_id,
              o.event_type,
              o.correlation_id,
              o.destination
         FROM events.platform_events AS e
         JOIN events.outbox AS o ON o.event_id = e.event_id
        WHERE e.event_id = $1`,
      [event.eventId],
    );

    expect(persisted.rows).toEqual([
      {
        event_id: event.eventId,
        outbox_event_id: outboxEventId,
        tenant_id: event.tenantId,
        event_type: event.eventType,
        correlation_id: event.correlationId,
        destination: "test-channel",
      },
    ]);
  });

  it("rolls back the event when outbox persistence fails", async () => {
    const occurredAt = toInstant(new Date());
    const event: PlatformEvent<{ message: string }> = {
      eventId: createCanonicalId("event"),
      eventType: "message.requested",
      schemaVersion: 1,
      tenantId: createCanonicalId("tenant"),
      aggregate: {
        type: "operation",
        id: createCanonicalId("operation"),
      },
      occurredAt,
      recordedAt: occurredAt,
      actor: null,
      authorityRef: null,
      correlationId: createCanonicalId("correlation"),
      causationId: null,
      requestId: null,
      workflowRunId: null,
      characterSessionId: null,
      provenance: { source: "foundation-integration" },
      sensitivity: "internal",
      payload: { message: "rollback-me" },
    };

    await expect(
      persistPlatformEventWithOutbox(pool, {
        event,
        outbox: {
          destination: "   ",
          availableAt: occurredAt,
          payload: { eventId: event.eventId },
        },
      }),
    ).rejects.toThrow("outbox destination is required");

    const eventCount = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM events.platform_events WHERE event_id = $1",
      [event.eventId],
    );
    const outboxCount = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM events.outbox WHERE event_id = $1",
      [event.eventId],
    );

    expect(eventCount.rows[0]?.count).toBe("0");
    expect(outboxCount.rows[0]?.count).toBe("0");
  });

  it("deduplicates inbox admission without collapsing tenant identity", async () => {
    const tenantA = createCanonicalId("tenant");
    const tenantB = createCanonicalId("tenant");
    const base = {
      namespace: "whatsapp:webhook",
      eventId: "provider-event-42",
      provider: "whatsapp",
      accountRef: "account-main",
      payloadHash: "sha256:payload-a",
      tombstoneUntil: toInstant(new Date(Date.now() + 86_400_000)),
    } as const;

    const first = await withTransaction(pool, (client) =>
      admitInboxEvent(client, {
        ...base,
        tenantId: tenantA,
        payloadRef: "blob://payload-a",
      }),
    );
    expect(first.reused).toBe(false);
    expect(first.state).toBe("admitted");

    const duplicate = await withTransaction(pool, (client) =>
      admitInboxEvent(client, {
        ...base,
        tenantId: tenantA,
        payloadRef: "blob://payload-a-copy",
      }),
    );
    expect(duplicate.reused).toBe(true);
    expect(duplicate.payloadHash).toBe(base.payloadHash);

    await expect(
      withTransaction(pool, (client) =>
        admitInboxEvent(client, {
          ...base,
          tenantId: tenantA,
          payloadHash: "sha256:payload-changed",
        }),
      ),
    ).rejects.toMatchObject({
      code: "inbox.payload_conflict",
      category: "conflict",
    });

    const otherTenant = await withTransaction(pool, (client) =>
      admitInboxEvent(client, {
        ...base,
        tenantId: tenantB,
      }),
    );
    expect(otherTenant.reused).toBe(false);

    const rows = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id
         FROM events.inbox
        WHERE namespace = $1 AND event_id = $2
        ORDER BY tenant_id`,
      [base.namespace, base.eventId],
    );
    expect(rows.rows.map((row) => row.tenant_id).sort()).toEqual(
      [tenantA, tenantB].sort(),
    );
  });

  it("reclaims expired inbox work and fences the stale worker", async () => {
    const tenantId = createCanonicalId("tenant");
    const admission = {
      tenantId,
      namespace: "telegram:update",
      eventId: "update-9001",
      provider: "telegram",
      accountRef: "bot-main",
      payloadHash: "sha256:update-9001",
      tombstoneUntil: toInstant(new Date(Date.now() + 86_400_000)),
    } as const;

    await withTransaction(pool, (client) => admitInboxEvent(client, admission));

    const [firstClaim] = await claimInboxBatch(pool, {
      tenantId,
      namespace: admission.namespace,
      workerId: "worker-a",
      limit: 1,
      leaseMs: 60_000,
    });
    expect(firstClaim).toMatchObject({
      eventId: admission.eventId,
      state: "processing",
      attempt: 1,
      fence: 1,
    });

    await pool.query(
      `UPDATE events.inbox
          SET lease_expires_at = clock_timestamp() - interval '1 second'
        WHERE tenant_id = $1 AND namespace = $2 AND event_id = $3`,
      [tenantId, admission.namespace, admission.eventId],
    );

    await expect(
      withTransaction(pool, (client) =>
        settleInboxClaim(client, {
          tenantId,
          namespace: admission.namespace,
          eventId: admission.eventId,
          workerId: "worker-a",
          fence: firstClaim!.fence,
          state: "completed",
        }),
      ),
    ).rejects.toMatchObject({
      code: "inbox.stale_claim",
      category: "conflict",
    });

    const [reclaimed] = await claimInboxBatch(pool, {
      tenantId,
      namespace: admission.namespace,
      workerId: "worker-b",
      limit: 1,
      leaseMs: 60_000,
    });
    expect(reclaimed).toMatchObject({
      eventId: admission.eventId,
      state: "processing",
      attempt: 2,
      fence: 2,
    });

    await expect(
      withTransaction(pool, (client) =>
        settleInboxClaim(client, {
          tenantId,
          namespace: admission.namespace,
          eventId: admission.eventId,
          workerId: "worker-a",
          fence: firstClaim!.fence,
          state: "completed",
        }),
      ),
    ).rejects.toMatchObject({
      code: "inbox.stale_claim",
      category: "conflict",
    });

    await withTransaction(pool, (client) =>
      settleInboxClaim(client, {
        tenantId,
        namespace: admission.namespace,
        eventId: admission.eventId,
        workerId: "worker-b",
        fence: reclaimed!.fence,
        state: "completed",
      }),
    );

    const afterCompletion = await claimInboxBatch(pool, {
      tenantId,
      namespace: admission.namespace,
      workerId: "worker-c",
      limit: 1,
      leaseMs: 60_000,
    });
    expect(afterCompletion).toEqual([]);

    const duplicate = await withTransaction(pool, (client) =>
      admitInboxEvent(client, admission),
    );
    expect(duplicate.reused).toBe(true);
    expect(duplicate.state).toBe("completed");

    const persisted = await pool.query<{
      state: string;
      attempt: number;
      fence: string;
      lease_owner: string | null;
      completed_at: Date | null;
    }>(
      `SELECT state,
              attempt,
              fence::text,
              lease_owner,
              completed_at
         FROM events.inbox
        WHERE tenant_id = $1 AND namespace = $2 AND event_id = $3`,
      [tenantId, admission.namespace, admission.eventId],
    );

    expect(persisted.rows[0]).toMatchObject({
      state: "completed",
      attempt: 2,
      fence: "2",
      lease_owner: null,
    });
    expect(persisted.rows[0]?.completed_at).toBeInstanceOf(Date);
  });

  it("recovers outbox work after an injected worker crash and fences the stale worker", async () => {
    const occurredAt = toInstant(new Date());
    const event: PlatformEvent<{ message: string }> = {
      eventId: createCanonicalId("event"),
      eventType: "message.requested",
      schemaVersion: 1,
      tenantId: createCanonicalId("tenant"),
      aggregate: {
        type: "operation",
        id: createCanonicalId("operation"),
        revision: 1,
      },
      occurredAt,
      recordedAt: occurredAt,
      actor: null,
      authorityRef: null,
      correlationId: createCanonicalId("correlation"),
      causationId: null,
      requestId: null,
      workflowRunId: null,
      characterSessionId: null,
      provenance: { source: "fault-injection-integration" },
      sensitivity: "internal",
      payload: { message: "recover-me" },
    };

    const outboxEventId = await persistPlatformEventWithOutbox(pool, {
      event,
      outbox: {
        destination: "restart-test",
        availableAt: occurredAt,
        payload: { eventId: event.eventId, message: "recover-me" },
      },
    });

    const [firstClaim] = await claimOutboxBatch(pool, {
      workerId: "worker-before-crash",
      destination: "restart-test",
      limit: 1,
      leaseMs: 60_000,
    });
    expect(firstClaim).toMatchObject({
      outboxEventId,
      state: "claimed",
      attempt: 1,
      fence: 1,
    });

    const faults = createFaultInjector({
      "after-outbox-claim": 1,
    });
    expect(() => faults.checkpoint("after-outbox-claim")).toThrowError(
      InjectedCrash,
    );
    expect(faults.hits("after-outbox-claim")).toBe(1);
    expect(faults.remaining("after-outbox-claim")).toBe(0);

    await pool.query(
      `UPDATE events.outbox
          SET lease_expires_at = clock_timestamp() - interval '1 second'
        WHERE outbox_event_id = $1`,
      [outboxEventId],
    );

    await expect(
      withTransaction(pool, (client) =>
        renewOutboxClaim(client, {
          outboxEventId,
          workerId: "worker-before-crash",
          fence: firstClaim!.fence,
          leaseMs: 60_000,
        }),
      ),
    ).rejects.toMatchObject({
      code: "outbox.stale_claim",
      category: "conflict",
    });

    await expect(
      withTransaction(pool, (client) =>
        settleOutboxClaim(client, {
          outboxEventId,
          workerId: "worker-before-crash",
          fence: firstClaim!.fence,
          state: "acknowledged",
          terminalReceiptRef: "should-not-win",
        }),
      ),
    ).rejects.toMatchObject({
      code: "outbox.stale_claim",
      category: "conflict",
    });

    const [reclaimed] = await claimOutboxBatch(pool, {
      workerId: "worker-after-restart",
      destination: "restart-test",
      limit: 1,
      leaseMs: 60_000,
    });
    expect(reclaimed).toMatchObject({
      outboxEventId,
      state: "claimed",
      attempt: 2,
      fence: 2,
    });

    await withTransaction(pool, (client) =>
      renewOutboxClaim(client, {
        outboxEventId,
        workerId: "worker-after-restart",
        fence: reclaimed!.fence,
        leaseMs: 60_000,
      }),
    );

    await expect(
      withTransaction(pool, (client) =>
        settleOutboxClaim(client, {
          outboxEventId,
          workerId: "worker-before-crash",
          fence: firstClaim!.fence,
          state: "acknowledged",
          terminalReceiptRef: "stale-receipt",
        }),
      ),
    ).rejects.toMatchObject({
      code: "outbox.stale_claim",
      category: "conflict",
    });

    await withTransaction(pool, (client) =>
      settleOutboxClaim(client, {
        outboxEventId,
        workerId: "worker-after-restart",
        fence: reclaimed!.fence,
        state: "acknowledged",
        terminalReceiptRef: "provider-receipt-42",
      }),
    );

    const afterSettlement = await claimOutboxBatch(pool, {
      workerId: "worker-third",
      destination: "restart-test",
      limit: 1,
      leaseMs: 60_000,
    });
    expect(afterSettlement).toEqual([]);

    const persisted = await pool.query<{
      state: string;
      attempt: number;
      fence: string;
      lease_owner: string | null;
      terminal_receipt_ref: string | null;
    }>(
      `SELECT state,
              attempt,
              fence::text,
              lease_owner,
              terminal_receipt_ref
         FROM events.outbox
        WHERE outbox_event_id = $1`,
      [outboxEventId],
    );
    expect(persisted.rows[0]).toEqual({
      state: "acknowledged",
      attempt: 2,
      fence: "2",
      lease_owner: null,
      terminal_receipt_ref: "provider-receipt-42",
    });
  });

  it("keeps provider receipt observations append-only and idempotent", async () => {
    const tenantId = createCanonicalId("tenant");
    const prepared = await withTransaction(pool, (client) =>
      prepareOperation(client, {
        tenantId,
        kind: "payment.capture",
        idempotencyKey: "receipt-operation",
        authorityScopeHash: "authority-v1",
        requestFingerprint: "receipt-request",
        expiresAt: toInstant(new Date(Date.now() + 86_400_000)),
      }),
    );

    const observedAt = toInstant(new Date());
    const first = await withTransaction(pool, (client) =>
      recordExternalReceipt(client, {
        tenantId,
        operationId: prepared.operation.operationId,
        provider: "provider-x",
        observationKey: "webhook:event-100",
        providerReference: "txn-900",
        normalizedStatus: "pending",
        payloadHash: "sha256:pending",
        payloadRef: "blob://pending",
        observedAt,
        verificationMethod: "signed-webhook",
        providerVersion: "2026-10",
      }),
    );
    expect(first.reused).toBe(false);

    const duplicate = await withTransaction(pool, (client) =>
      recordExternalReceipt(client, {
        tenantId,
        operationId: prepared.operation.operationId,
        provider: "provider-x",
        observationKey: "webhook:event-100",
        providerReference: "txn-900",
        normalizedStatus: "pending",
        payloadHash: "sha256:pending",
        payloadRef: "blob://pending-copy",
        observedAt: toInstant(new Date(Date.now() + 1_000)),
        verificationMethod: "signed-webhook",
        providerVersion: "2026-10",
      }),
    );
    expect(duplicate.reused).toBe(true);
    expect(duplicate.receipt.externalReceiptId).toBe(
      first.receipt.externalReceiptId,
    );

    const second = await withTransaction(pool, (client) =>
      recordExternalReceipt(client, {
        tenantId,
        operationId: prepared.operation.operationId,
        provider: "provider-x",
        observationKey: "status-query:2",
        providerReference: "txn-900",
        normalizedStatus: "succeeded",
        payloadHash: "sha256:succeeded",
        observedAt: toInstant(new Date(Date.now() + 2_000)),
        verificationMethod: "authenticated-status-query",
        providerVersion: "2026-10",
      }),
    );
    expect(second.reused).toBe(false);

    const receipts = await withTransaction(pool, (client) =>
      listExternalReceiptsForOperation(
        client,
        tenantId,
        prepared.operation.operationId,
      ),
    );
    expect(receipts).toHaveLength(2);
    expect(receipts.map((receipt) => receipt.providerReference)).toEqual([
      "txn-900",
      "txn-900",
    ]);
    expect(receipts.map((receipt) => receipt.normalizedStatus)).toEqual([
      "pending",
      "succeeded",
    ]);

    await expect(
      withTransaction(pool, (client) =>
        recordExternalReceipt(client, {
          tenantId,
          operationId: prepared.operation.operationId,
          provider: "provider-x",
          observationKey: "webhook:event-100",
          providerReference: "txn-900",
          normalizedStatus: "succeeded",
          payloadHash: "sha256:changed",
          observedAt,
          verificationMethod: "signed-webhook",
          providerVersion: "2026-10",
        }),
      ),
    ).rejects.toMatchObject({
      code: "external-receipt.observation_conflict",
      category: "conflict",
      operationId: prepared.operation.operationId,
    });

    await expect(
      withTransaction(pool, (client) =>
        recordExternalReceipt(client, {
          tenantId: createCanonicalId("tenant"),
          operationId: prepared.operation.operationId,
          provider: "provider-x",
          observationKey: "cross-tenant",
          normalizedStatus: "pending",
          observedAt,
          verificationMethod: "signed-webhook",
        }),
      ),
    ).rejects.toMatchObject({
      code: "operation.not_found",
      category: "not-found",
      operationId: prepared.operation.operationId,
    });
  });

  it("moves ambiguous operations into one durable reconciliation case", async () => {
    const tenantId = createCanonicalId("tenant");
    const prepared = await withTransaction(pool, (client) =>
      prepareOperation(client, {
        tenantId,
        kind: "airtime.purchase",
        idempotencyKey: "reconciliation-operation",
        authorityScopeHash: "authority-v1",
        requestFingerprint: "reconciliation-request",
        expiresAt: toInstant(new Date(Date.now() + 86_400_000)),
      }),
    );

    await withTransaction(pool, async (client) => {
      await transitionOperation(client, {
        operationId: prepared.operation.operationId,
        from: "prepared",
        to: "authorized",
      });
      await transitionOperation(client, {
        operationId: prepared.operation.operationId,
        from: "authorized",
        to: "dispatching",
      });
      await transitionOperation(client, {
        operationId: prepared.operation.operationId,
        from: "dispatching",
        to: "unknown",
      });
    });

    const opened = await beginReconciliation(pool, {
      tenantId,
      operationId: prepared.operation.operationId,
      reasonCode: "provider-timeout",
      safeRetry: false,
      nextAction: "query-provider",
    });
    expect(opened.reused).toBe(false);
    expect(opened.reconciliationCase.status).toBe("open");

    const operationState = await pool.query<{ state: string }>(
      "SELECT state FROM events.operations WHERE operation_id = $1",
      [prepared.operation.operationId],
    );
    expect(operationState.rows[0]?.state).toBe("reconciling");

    const duplicate = await beginReconciliation(pool, {
      tenantId,
      operationId: prepared.operation.operationId,
      reasonCode: "provider-timeout",
      safeRetry: false,
      nextAction: "query-provider",
    });
    expect(duplicate.reused).toBe(true);
    expect(duplicate.reconciliationCase.reconciliationCaseId).toBe(
      opened.reconciliationCase.reconciliationCaseId,
    );

    const checking = await withTransaction(pool, (client) =>
      transitionReconciliationCase(client, {
        tenantId,
        reconciliationCaseId:
          opened.reconciliationCase.reconciliationCaseId,
        from: "open",
        to: "checking",
        safeRetry: false,
        nextAction: "poll-provider-status",
      }),
    );
    expect(checking.status).toBe("checking");

    await expect(
      withTransaction(pool, (client) =>
        transitionReconciliationCase(client, {
          tenantId,
          reconciliationCaseId:
            opened.reconciliationCase.reconciliationCaseId,
          from: "open",
          to: "resolved",
          safeRetry: false,
          nextAction: null,
        }),
      ),
    ).rejects.toMatchObject({
      code: "reconciliation.stale_transition",
      category: "conflict",
    });

    const resolved = await withTransaction(pool, (client) =>
      transitionReconciliationCase(client, {
        tenantId,
        reconciliationCaseId:
          opened.reconciliationCase.reconciliationCaseId,
        from: "checking",
        to: "resolved",
        safeRetry: false,
        nextAction: null,
      }),
    );
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolvedAt).not.toBeNull();

    const nonAmbiguous = await withTransaction(pool, (client) =>
      prepareOperation(client, {
        tenantId,
        kind: "message.send",
        idempotencyKey: "not-ambiguous",
        authorityScopeHash: "authority-v1",
        requestFingerprint: "not-ambiguous",
        expiresAt: toInstant(new Date(Date.now() + 86_400_000)),
      }),
    );

    await expect(
      beginReconciliation(pool, {
        tenantId,
        operationId: nonAmbiguous.operation.operationId,
        reasonCode: "should-not-open",
        safeRetry: false,
        nextAction: null,
      }),
    ).rejects.toMatchObject({
      code: "reconciliation.operation_not_ambiguous",
      category: "conflict",
      operationId: nonAmbiguous.operation.operationId,
    });
  });

  it("uses durable service verification generation and revocation state", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const issuer = createCanonicalId("service");
    const audience = createCanonicalId("service");
    const tenantId = createCanonicalId("tenant");
    const keyId = "integration-service-key";
    const publicKeyPem = publicKey
      .export({ type: "spki", format: "pem" })
      .toString();

    await withTransaction(pool, (client) =>
      putServiceVerificationKey(client, {
        serviceId: issuer,
        keyId,
        credentialGeneration: 1,
        publicKeyPem,
      }),
    );

    const issue = (generation: number) =>
      issueServiceCredential({
        keyId,
        privateKey,
        issuer,
        audience,
        tenantId,
        capabilities: ["workflow.dispatch"],
        credentialGeneration: generation,
        issuedAt: toInstant("2026-10-01T18:00:00Z"),
        expiresAt: toInstant("2026-10-01T18:04:00Z"),
        requestId: createCanonicalId("request"),
        correlationId: createCanonicalId("correlation"),
      });

    const generationOne = issue(1);
    const first = await withTransaction(pool, (client) =>
      verifyServiceCredential(generationOne, {
        expectedAudience: audience,
        expectedTenantId: tenantId,
        requiredCapabilities: ["workflow.dispatch"],
        keySource: createPostgresServiceCredentialKeySource(client),
        at: toInstant("2026-10-01T18:02:00Z"),
        clockSkewMs: 0,
      }),
    );
    expect(first.principal).toEqual({
      kind: "service",
      serviceId: issuer,
    });

    await withTransaction(pool, (client) =>
      putServiceVerificationKey(client, {
        serviceId: issuer,
        keyId,
        credentialGeneration: 2,
        publicKeyPem,
      }),
    );

    await expect(
      withTransaction(pool, (client) =>
        verifyServiceCredential(generationOne, {
          expectedAudience: audience,
          keySource: createPostgresServiceCredentialKeySource(client),
          at: toInstant("2026-10-01T18:02:00Z"),
          clockSkewMs: 0,
        }),
      ),
    ).rejects.toMatchObject({
      code: "service-credential.stale_generation",
      category: "authentication",
    });

    const generationTwo = issue(2);
    await expect(
      withTransaction(pool, (client) =>
        verifyServiceCredential(generationTwo, {
          expectedAudience: audience,
          keySource: createPostgresServiceCredentialKeySource(client),
          at: toInstant("2026-10-01T18:02:00Z"),
          clockSkewMs: 0,
        }),
      ),
    ).resolves.toMatchObject({
      principal: {
        kind: "service",
        serviceId: issuer,
      },
    });

    const deactivated = await withTransaction(pool, (client) =>
      deactivateServiceVerificationKey(client, issuer, keyId),
    );
    expect(deactivated).toBe(true);

    await expect(
      withTransaction(pool, (client) =>
        verifyServiceCredential(generationTwo, {
          expectedAudience: audience,
          keySource: createPostgresServiceCredentialKeySource(client),
          at: toInstant("2026-10-01T18:02:00Z"),
          clockSkewMs: 0,
        }),
      ),
    ).rejects.toMatchObject({
      code: "service-credential.unknown_key",
      category: "authentication",
    });
  });

  it("atomically consumes an allow-once approval and rejects stale policy", async () => {
    const tenantId = createCanonicalId("tenant");
    const prepared = await withTransaction(pool, (client) =>
      prepareOperation(client, {
        tenantId,
        kind: "tool.execute",
        idempotencyKey: "approval-once",
        authorityScopeHash: "scope-v1",
        requestFingerprint: "request-v1",
        expiresAt: toInstant(new Date(Date.now() + 86_400_000)),
      }),
    );

    await withTransaction(pool, (client) =>
      setPolicyRevision(client, tenantId, "policy-1"),
    );

    const binding: ApprovalBinding = {
      operationId: prepared.operation.operationId,
      tenantId,
      principalKey: "system:integration-test",
      action: "tool.execute",
      actionVersion: "1",
      resourceKey: "resource:test",
      argumentsFingerprint: "sha256:args-v1",
      riskClass: "consequential",
    };
    const requestedAt = toInstant(new Date(Date.now() - 1_000));
    const expiresAt = toInstant(new Date(Date.now() + 60_000));
    const pending = createPendingApproval({
      kind: "once",
      binding,
      policyRevision: "policy-1",
      requestedAt,
      expiresAt,
    });

    await withTransaction(pool, (client) =>
      persistPendingApproval(client, pending),
    );
    const approved = await withTransaction(pool, (client) =>
      settlePendingApproval(client, {
        tenantId,
        approvalId: pending.approvalId,
        decision: "approved",
        approverKey: "operator:test",
        decidedAt: toInstant(new Date()),
      }),
    );
    expect(approved.state).toBe("approved");

    const consumeAt = toInstant(new Date());
    const attempts = await Promise.allSettled([
      withTransaction(pool, (client) =>
        consumeOnceApproval(client, {
          tenantId,
          approvalId: pending.approvalId,
          binding,
          currentPolicyRevision: "policy-1",
          consumedAt: consumeAt,
        }),
      ),
      withTransaction(pool, (client) =>
        consumeOnceApproval(client, {
          tenantId,
          approvalId: pending.approvalId,
          binding,
          currentPolicyRevision: "policy-1",
          consumedAt: consumeAt,
        }),
      ),
    ]);
    expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter((result) => result.status === "rejected")).toHaveLength(1);

    const context = createAuthorityContext({
      tenantId,
      principal: { kind: "system", systemKind: "integration-test" },
      scopes: [],
      capabilities: ["tool.execute"],
      resourceScope: {},
      policyRevision: "policy-1",
      approvalIds: [pending.approvalId],
      delegationChain: [],
      expiresAt,
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });

    await withTransaction(pool, async (client) => {
      await assertCurrentAuthority(
        context,
        createPostgresCurrentAuthoritySource(client),
      );
      await revokeAuthorityContext(client, {
        tenantId,
        authorityContextId: context.authorityContextId,
        reasonCode: "test-revocation",
      });
      await expect(
        assertCurrentAuthority(
          context,
          createPostgresCurrentAuthoritySource(client),
        ),
      ).rejects.toMatchObject({ code: "authority.revoked" });
    });

    await withTransaction(pool, (client) =>
      setPolicyRevision(client, tenantId, "policy-2"),
    );
    await withTransaction(pool, async (client) => {
      await expect(
        assertCurrentAuthority(
          context,
          createPostgresCurrentAuthoritySource(client),
        ),
      ).rejects.toMatchObject({ code: "authority.stale_policy" });
    });
  });

  it("executes consequential Tools durably with replay, authority and reconciliation gates", async () => {
    const tenantId = createCanonicalId("tenant");
    const otherTenantId = createCanonicalId("tenant");
    const now = toInstant("2026-10-02T10:00:00Z");
    const capability = normalizeCapabilityKey("payments.charge");

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await createTenant(client, { tenantId: otherTenantId, createdAt: now });
      await setPolicyRevision(client, tenantId, "policy-1");
      await setPolicyRevision(client, otherTenantId, "policy-1");
    });

    const tools = createToolRegistry();
    tools.registerCapability({
      key: capability,
      description: "Create an externally observable payment charge.",
    });
    const toolVersionId = createCanonicalId("tool-version");
    tools.registerTool({
      toolId: createCanonicalId("tool"),
      toolVersionId,
      key: "payment-charge",
      version: "v1",
      displayName: "Payment charge",
      description: "Create one idempotent external charge.",
      capabilities: [capability],
      inputSchema: { type: "object" },
      outputSchema: { type: "object" },
      requiredAuthorityCapabilities: [capability],
      riskClass: "consequential",
      sideEffectClass: "external-consequential",
      sensitivity: "sensitive",
      timeoutMs: 30_000,
      rateLimit: null,
      costClass: "external",
      idempotencyMode: "operation-bound",
      reconciliationMode: "on-unknown",
      providerRequirement: { capability },
    });

    const providers = createProviderRegistry();
    const providerId = createCanonicalId("provider");
    providers.register({
      providerId,
      key: "payment-fixture",
      version: "v1",
      displayName: "Payment fixture",
      capabilities: [capability],
      selectionPriority: 1,
      credentialSlots: [
        {
          key: "api-key",
          required: true,
          description: "Opaque provider credential reference.",
        },
      ],
    });
    providers.setReadiness({
      providerId,
      state: "ready",
      reasonCode: null,
      checkedAt: now,
    });

    const credentialBindings = {
      "api-key": createCanonicalId("credential-ref"),
    };
    const operations = createPostgresToolOperationStore(pool);
    const authorityClient = await pool.connect();
    try {
      const authoritySource =
        createPostgresCurrentAuthoritySource(authorityClient);
      const authority = createAuthorityContext({
        tenantId,
        principal: {
          kind: "system",
          systemKind: "tool-execution-integration",
        },
        scopes: [],
        capabilities: [capability],
        resourceScope: {},
        policyRevision: "policy-1",
        approvalIds: [],
        delegationChain: [],
        expiresAt: toInstant("2099-01-01T00:00:00Z"),
        requestId: createCanonicalId("request"),
        correlationId: createCanonicalId("correlation"),
      });

      let dispatches = 0;
      const successfulDependencies = {
        tools,
        providers,
        authoritySource,
        operations,
        resolveAdapter: () => ({
          async dispatch() {
            dispatches += 1;
            return {
              status: "succeeded" as const,
              output: { providerReference: "charge-1" },
              receipt: {
                observationKey: "provider-response:charge-1",
                providerReference: "charge-1",
                normalizedStatus: "succeeded",
                payloadHash: "sha256:provider-response-charge-1",
                payloadRef: null,
                observedAt: now,
                verificationMethod: "provider-response",
              },
            };
          },
        }),
      };

      const invocation = {
        toolVersionId,
        authority,
        input: { amountMinor: 1000, currency: "NGN" },
        idempotencyKey: "postgres-charge-1",
        providerSelection: null,
      } as const;

      const first = await executeConsequentialTool(successfulDependencies, {
        invocation,
        credentialBindings,
        idempotencyExpiresAt: toInstant("2099-01-02T00:00:00Z"),
      });
      const replay = await executeConsequentialTool(successfulDependencies, {
        invocation,
        credentialBindings,
        idempotencyExpiresAt: toInstant("2099-01-02T00:00:00Z"),
      });

      expect(first.operation.state).toBe("succeeded");
      expect(replay.operation.operationId).toBe(first.operation.operationId);
      expect(replay.reused).toBe(true);
      expect(replay.dispatched).toBe(false);
      expect(first.receipts).toHaveLength(1);
      expect(replay.receipts).toEqual(first.receipts);
      expect(replay.receipts[0]).toMatchObject({
        provider: "payment-fixture",
        providerReference: "charge-1",
        normalizedStatus: "succeeded",
        verificationMethod: "provider-response",
      });
      expect(dispatches).toBe(1);

      await expect(
        operations.load(otherTenantId, first.operation.operationId),
      ).resolves.toBeNull();

      await withTransaction(pool, (client) =>
        revokeAuthorityContext(client, {
          tenantId,
          authorityContextId: authority.authorityContextId,
          reasonCode: "integration-revoked",
        }),
      );

      await expect(
        executeConsequentialTool(successfulDependencies, {
          invocation: {
            ...invocation,
            idempotencyKey: "postgres-charge-revoked",
          },
          credentialBindings,
          idempotencyExpiresAt: toInstant("2099-01-02T00:00:00Z"),
        }),
      ).rejects.toMatchObject({ code: "authority.revoked" });
      expect(dispatches).toBe(1);

      const staleAuthority = createAuthorityContext({
        tenantId,
        principal: {
          kind: "system",
          systemKind: "tool-execution-integration",
        },
        scopes: [],
        capabilities: [capability],
        resourceScope: {},
        policyRevision: "policy-1",
        approvalIds: [],
        delegationChain: [],
        expiresAt: toInstant("2099-01-01T00:00:00Z"),
        requestId: createCanonicalId("request"),
        correlationId: createCanonicalId("correlation"),
      });
      await withTransaction(pool, (client) =>
        setPolicyRevision(client, tenantId, "policy-2"),
      );

      await expect(
        executeConsequentialTool(successfulDependencies, {
          invocation: {
            ...invocation,
            authority: staleAuthority,
            idempotencyKey: "postgres-charge-stale",
          },
          credentialBindings,
          idempotencyExpiresAt: toInstant("2099-01-02T00:00:00Z"),
        }),
      ).rejects.toMatchObject({ code: "authority.stale_policy" });
      expect(dispatches).toBe(1);

      const currentAuthority = createAuthorityContext({
        tenantId,
        principal: {
          kind: "system",
          systemKind: "tool-execution-integration",
        },
        scopes: [],
        capabilities: [capability],
        resourceScope: {},
        policyRevision: "policy-2",
        approvalIds: [],
        delegationChain: [],
        expiresAt: toInstant("2099-01-01T00:00:00Z"),
        requestId: createCanonicalId("request"),
        correlationId: createCanonicalId("correlation"),
      });

      const ambiguous = await executeConsequentialTool(
        {
          tools,
          providers,
          authoritySource,
          operations,
          resolveAdapter: () => ({
            async dispatch() {
              throw new Error(
                "transport closed after the provider may have accepted the request",
              );
            },
          }),
        },
        {
          invocation: {
            ...invocation,
            authority: currentAuthority,
            idempotencyKey: "postgres-charge-ambiguous",
          },
          credentialBindings,
          idempotencyExpiresAt: toInstant("2099-01-02T00:00:00Z"),
        },
      );

      expect(ambiguous.operation.state).toBe("reconciling");
      const reconciliation = await pool.query<{
        status: string;
        safe_retry: boolean;
      }>(
        `SELECT status, safe_retry
           FROM events.reconciliation_cases
          WHERE tenant_id = $1 AND operation_id = $2`,
        [tenantId, ambiguous.operation.operationId],
      );
      expect(reconciliation.rows).toEqual([
        {
          status: "open",
          safe_retry: false,
        },
      ]);
    } finally {
      authorityClient.release();
    }
  });

  it("stores provider credentials encrypted, scoped, rotatable and revocable", async () => {
    const tenantId = createCanonicalId("tenant");
    const otherTenantId = createCanonicalId("tenant");
    const providerId = createCanonicalId("provider");
    const otherProviderId = createCanonicalId("provider");
    const credentialRefId = createCanonicalId("credential-ref");

    const cipher: CredentialEnvelopeCipher = {
      async seal(input) {
        return {
          algorithm: "integration-test-envelope",
          keyId: "test-key-v1",
          ciphertext: Buffer.from(
            `g${input.generation}:${input.plaintext}`,
            "utf8",
          ).toString("base64"),
          nonce: null,
        };
      },
      async open(input) {
        const decoded = Buffer.from(
          input.envelope.ciphertext,
          "base64",
        ).toString("utf8");
        const prefix = `g${input.generation}:`;
        if (!decoded.startsWith(prefix)) {
          throw new Error("credential generation mismatch");
        }
        return CredentialSecret.fromString(decoded.slice(prefix.length));
      },
    };

    await withTransaction(pool, async (client) => {
      await createTenant(client, {
        tenantId,
        createdAt: toInstant("2026-10-02T10:00:00Z"),
      });
      await createTenant(client, {
        tenantId: otherTenantId,
        createdAt: toInstant("2026-10-02T10:00:00Z"),
      });

      await createProviderCredentialRef(client, cipher, {
        tenantId,
        credentialRefId,
        providerId,
        slotKey: "api-key",
        plaintext: "first-secret",
      });
    });

    const preparedCredentialOperation = await withTransaction(
      pool,
      (client) =>
        prepareOperation(client, {
          tenantId,
          kind: "provider.credential-resolution-test",
          idempotencyKey: "credential-resolution-operation",
          authorityScopeHash: "credential-test-authority",
          requestFingerprint: "credential-test-request",
          expiresAt: toInstant("2099-01-01T00:00:00Z"),
        }),
    );
    const operationId = preparedCredentialOperation.operation.operationId;

    const persisted = await pool.query<{
      generation: number;
      ciphertext: string;
      active: boolean;
    }>(
      `SELECT generation, ciphertext, active
         FROM security.credential_refs
        WHERE tenant_id = $1 AND credential_ref_id = $2`,
      [tenantId, credentialRefId],
    );
    expect(persisted.rows[0]).toMatchObject({
      generation: 1,
      active: true,
    });
    expect(persisted.rows[0]?.ciphertext).not.toContain("first-secret");

    const resolve = async (
      requestTenantId = tenantId,
      requestProviderId = providerId,
      slotKey = "api-key",
    ) =>
      withTransaction(pool, (client) =>
        resolveCredentialSecret(
          createPostgresCredentialMaterialSource(client, cipher),
          {
            tenantId: requestTenantId,
            credentialRefId,
            providerId: requestProviderId,
            operationId,
            slotKey,
          },
        ),
      );

    await expect(
      resolve().then((secret) => secret.use((value) => value)),
    ).resolves.toBe("first-secret");

    await expect(resolve(otherTenantId)).rejects.toMatchObject({
      code: "credential.unavailable",
      category: "authorization",
    });
    await expect(resolve(tenantId, otherProviderId)).rejects.toMatchObject({
      code: "credential.unavailable",
      category: "authorization",
    });
    await expect(
      resolve(tenantId, providerId, "other-slot"),
    ).rejects.toMatchObject({
      code: "credential.unavailable",
      category: "authorization",
    });

    await expect(
      withTransaction(pool, (client) =>
        resolveCredentialSecret(
          createPostgresCredentialMaterialSource(client, cipher),
          {
            tenantId,
            credentialRefId,
            providerId,
            operationId: createCanonicalId("operation"),
            slotKey: "api-key",
          },
        ),
      ),
    ).rejects.toMatchObject({
      code: "credential.unavailable",
      category: "authorization",
    });

    const generation = await withTransaction(pool, (client) =>
      rotateProviderCredentialRef(client, cipher, {
        tenantId,
        credentialRefId,
        providerId,
        slotKey: "api-key",
        expectedGeneration: 1,
        plaintext: "second-secret",
      }),
    );
    expect(generation).toBe(2);
    await expect(
      resolve().then((secret) => secret.use((value) => value)),
    ).resolves.toBe("second-secret");

    await expect(
      withTransaction(pool, (client) =>
        rotateProviderCredentialRef(client, cipher, {
          tenantId,
          credentialRefId,
          providerId,
          slotKey: "api-key",
          expectedGeneration: 1,
          plaintext: "stale-secret",
        }),
      ),
    ).rejects.toMatchObject({
      code: "credential.rotation_conflict",
      category: "conflict",
    });

    const failingCipher: CredentialEnvelopeCipher = {
      ...cipher,
      async open() {
        throw new Error("kms secret diagnostic that must not escape");
      },
    };
    await withTransaction(pool, async (client) => {
      const source = createPostgresCredentialMaterialSource(
        client,
        failingCipher,
      );
      await expect(
        resolveCredentialSecret(source, {
          tenantId,
          credentialRefId,
          providerId,
          operationId,
          slotKey: "api-key",
        }),
      ).rejects.toMatchObject({
        code: "credential.unavailable",
        category: "authorization",
        message: "Credential reference is unavailable for requested scope",
      });
    });

    await expect(
      withTransaction(pool, (client) =>
        revokeProviderCredentialRef(client, {
          tenantId,
          credentialRefId,
          providerId,
          slotKey: "api-key",
        }),
      ),
    ).resolves.toBe(true);

    await expect(resolve()).rejects.toMatchObject({
      code: "credential.unavailable",
      category: "authorization",
    });
  });

  it("preserves one operation across restart-safe idempotent admission", async () => {
    const tenantId = createCanonicalId("tenant");
    const input = {
      tenantId,
      kind: "message.send",
      idempotencyKey: "send-123",
      authorityScopeHash: "authority-v1",
      requestFingerprint: "request-v1",
      expiresAt: toInstant(new Date(Date.now() + 86_400_000)),
    } as const;

    const first = await withTransaction(pool, (client) =>
      prepareOperation(client, input),
    );
    expect(first.reused).toBe(false);

    const faults = createFaultInjector({
      "after-operation-commit-before-response": 1,
    });
    expect(() =>
      faults.checkpoint("after-operation-commit-before-response"),
    ).toThrowError(InjectedCrash);

    const second = await withTransaction(pool, (client) =>
      prepareOperation(client, input),
    );
    expect(second.reused).toBe(true);
    expect(second.operation.operationId).toBe(first.operation.operationId);

    await expect(
      withTransaction(pool, (client) =>
        prepareOperation(client, {
          ...input,
          requestFingerprint: "request-changed",
        }),
      ),
    ).rejects.toMatchObject({
      code: "idempotency.fingerprint_conflict",
      category: "conflict",
      operationId: first.operation.operationId,
    });
  });

  it("rejects a stale persisted operation transition", async () => {
    const tenantId = createCanonicalId("tenant");
    const prepared = await withTransaction(pool, (client) =>
      prepareOperation(client, {
        tenantId,
        kind: "message.send",
        idempotencyKey: "transition-123",
        authorityScopeHash: "authority-v1",
        requestFingerprint: "transition-v1",
        expiresAt: toInstant(new Date(Date.now() + 86_400_000)),
      }),
    );

    const authorized = await withTransaction(pool, (client) =>
      transitionOperation(client, {
        operationId: prepared.operation.operationId,
        from: "prepared",
        to: "authorized",
      }),
    );
    expect(authorized.state).toBe("authorized");

    await expect(
      withTransaction(pool, (client) =>
        transitionOperation(client, {
          operationId: prepared.operation.operationId,
          from: "prepared",
          to: "authorized",
        }),
      ),
    ).rejects.toMatchObject({
      code: "operation.stale_transition",
      category: "conflict",
      operationId: prepared.operation.operationId,
    });
  });

  it("prevents a stale outbox worker fence from settling a newer claim", async () => {
    const tenantId = createCanonicalId("tenant");
    const eventId = createCanonicalId("event");

    const outboxEventId = await withTransaction(pool, (client) =>
      enqueueOutbox(client, {
        tenantId,
        eventId,
        eventType: "message.requested",
        schemaVersion: 1,
        aggregateType: "operation",
        aggregateId: createCanonicalId("operation") as OperationId,
        correlationId: createCanonicalId("correlation"),
        causationId: null,
        destination: "test-channel",
        availableAt: toInstant(new Date(Date.now() - 1_000)),
        payload: { message: "hello" },
      }),
    );

    const [claim] = await claimOutboxBatch(pool, {
      workerId: "worker-a",
      destination: "test-channel",
      limit: 10,
      leaseMs: 30_000,
    });
    expect(claim?.outboxEventId).toBe(outboxEventId);

    await expect(
      withTransaction(pool, (client) =>
        settleOutboxClaim(client, {
          outboxEventId,
          workerId: "worker-a",
          fence: (claim?.fence ?? 1) - 1,
          state: "acknowledged",
        }),
      ),
    ).rejects.toMatchObject({
      code: "outbox.stale_claim",
      category: "conflict",
    });

    await withTransaction(pool, (client) =>
      settleOutboxClaim(client, {
        outboxEventId,
        workerId: "worker-a",
        fence: claim!.fence,
        state: "acknowledged",
        terminalReceiptRef: "receipt:test",
      }),
    );

    const persisted = await pool.query<{
      state: string;
      terminal_receipt_ref: string | null;
    }>(
      `SELECT state, terminal_receipt_ref
         FROM events.outbox
        WHERE outbox_event_id = $1`,
      [outboxEventId],
    );

    expect(persisted.rows[0]).toEqual({
      state: "acknowledged",
      terminal_receipt_ref: "receipt:test",
    });
  });
  it("keeps canonical memory relationship-scoped with atomic immutable revisions", async () => {
    const tenantId = createCanonicalId("tenant");
    const firstUserId = createCanonicalId("user");
    const secondUserId = createCanonicalId("user");
    const characterId = createCanonicalId("character");
    const firstRelationshipId = createCanonicalId("relationship");
    const secondRelationshipId = createCanonicalId("relationship");
    const memoryRecordId = createCanonicalId("memory-record");
    const firstRevisionId = createCanonicalId("memory-revision");
    const secondRevisionId = createCanonicalId("memory-revision");
    const now = toInstant("2026-10-02T04:00:00Z");
    const later = toInstant("2026-10-02T04:01:00Z");
    const sourceHash = "b".repeat(64);

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await createUser(client, {
        tenantId,
        userId: firstUserId,
        createdAt: now,
      });
      await createUser(client, {
        tenantId,
        userId: secondUserId,
        createdAt: now,
      });
      await createCharacter(client, {
        tenantId,
        characterId,
        createdAt: now,
      });
      await getOrCreateRelationship(client, {
        tenantId,
        relationshipId: firstRelationshipId,
        userId: firstUserId,
        characterId,
        createdAt: now,
      });
      await getOrCreateRelationship(client, {
        tenantId,
        relationshipId: secondRelationshipId,
        userId: secondUserId,
        characterId,
        createdAt: now,
      });

      const created = await createMemoryRecord(client, {
        tenantId,
        memoryRecordId,
        memoryRevisionId: firstRevisionId,
        memoryType: "preference",
        scope: {
          kind: "relationship",
          relationshipId: firstRelationshipId,
        },
        content: "Prefers morning reminders.",
        confidence: 0.95,
        extractionMethod: "fixture",
        observedAt: now,
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "fixture:message:1",
            sourceContentHash: sourceHash,
            verbatimText: "  Please remind me in the morning.\n",
            observedAt: now,
          },
        ],
        createdAt: now,
      });

      expect(created.record.revision).toBe(1);
      expect(created.currentRevision.evidence[0]?.verbatimText).toBe(
        "  Please remind me in the morning.\n",
      );

      await expect(
        getMemoryRecordInScope(client, {
          tenantId,
          memoryRecordId,
          scope: {
            kind: "relationship",
            relationshipId: firstRelationshipId,
          },
        }),
      ).resolves.toMatchObject({
        record: { memoryRecordId, revision: 1 },
      });

      await expect(
        getMemoryRecordInScope(client, {
          tenantId,
          memoryRecordId,
          scope: {
            kind: "relationship",
            relationshipId: secondRelationshipId,
          },
        }),
      ).resolves.toBeNull();

      await expect(
        listMemoryRecordsByScopes(client, {
          tenantId,
          scopes: [
            {
              kind: "relationship",
              relationshipId: secondRelationshipId,
            },
          ],
        }),
      ).resolves.toHaveLength(0);

      await expect(
        listMemoryRecordsByScopes(client, {
          tenantId,
          scopes: [
            {
              kind: "relationship",
              relationshipId: firstRelationshipId,
            },
          ],
        }),
      ).resolves.toHaveLength(1);

      const appendInput = {
        tenantId,
        memoryRecordId,
        memoryRevisionId: secondRevisionId,
        expectedRevision: 1,
        content: "Prefers reminders early in the morning.",
        payload: { localTime: "07:00" },
        confidence: 0.98,
        extractionMethod: "fixture",
        observedAt: later,
        evidence: [
          {
            sourceKind: "message" as const,
            sourceReference: "fixture:message:2",
            sourceContentHash: sourceHash,
            verbatimText: "Make that seven in the morning.",
            observedAt: later,
          },
        ],
        updatedAt: later,
      } as const;

      const revised = await appendMemoryRevision(client, appendInput);
      expect(revised.record.revision).toBe(2);
      expect(revised.currentRevision.memoryRevisionId).toBe(secondRevisionId);
      expect(revised.currentRevision.payload).toEqual({ localTime: "07:00" });

      const replayed = await appendMemoryRevision(client, appendInput);
      expect(replayed.record.revision).toBe(2);
      expect(replayed.currentRevision.memoryRevisionId).toBe(secondRevisionId);

      await expect(
        appendMemoryRevision(client, {
          ...appendInput,
          memoryRevisionId: createCanonicalId("memory-revision"),
          content: "A conflicting stale write.",
        }),
      ).rejects.toMatchObject({
        code: "memory.revision_conflict",
      });
    });

    await expect(
      pool.query(
        `UPDATE memory.records
            SET scope_ref_id = $1
          WHERE tenant_id = $2 AND memory_record_id = $3`,
        [secondRelationshipId, tenantId, memoryRecordId],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      pool.query(
        `UPDATE memory.revisions
            SET content = 'silently rewritten'
          WHERE tenant_id = $1 AND memory_revision_id = $2`,
        [tenantId, secondRevisionId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });


  it("records same-scope memory supersession with lifecycle CAS and preserved evidence", async () => {
    const tenantId = createCanonicalId("tenant");
    const firstUserId = createCanonicalId("user");
    const secondUserId = createCanonicalId("user");
    const characterId = createCanonicalId("character");
    const firstRelationshipId = createCanonicalId("relationship");
    const secondRelationshipId = createCanonicalId("relationship");
    const sourceId = createCanonicalId("memory-record");
    const targetId = createCanonicalId("memory-record");
    const staleSourceId = createCanonicalId("memory-record");
    const crossTargetId = createCanonicalId("memory-record");
    const now = toInstant("2026-10-02T05:00:00Z");
    const later = toInstant("2026-10-02T05:01:00Z");
    const sourceHash = "d".repeat(64);

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await createUser(client, {
        tenantId,
        userId: firstUserId,
        createdAt: now,
      });
      await createUser(client, {
        tenantId,
        userId: secondUserId,
        createdAt: now,
      });
      await createCharacter(client, {
        tenantId,
        characterId,
        createdAt: now,
      });
      await getOrCreateRelationship(client, {
        tenantId,
        relationshipId: firstRelationshipId,
        userId: firstUserId,
        characterId,
        createdAt: now,
      });
      await getOrCreateRelationship(client, {
        tenantId,
        relationshipId: secondRelationshipId,
        userId: secondUserId,
        characterId,
        createdAt: now,
      });

      const createPreference = async (
        memoryRecordId: typeof sourceId,
        relationshipId: typeof firstRelationshipId,
        content: string,
        reference: string,
      ) =>
        createMemoryRecord(client, {
          tenantId,
          memoryRecordId,
          memoryRevisionId: createCanonicalId("memory-revision"),
          memoryType: "preference",
          scope: { kind: "relationship", relationshipId },
          content,
          extractionMethod: "fixture",
          observedAt: now,
          evidence: [
            {
              sourceKind: "message",
              sourceReference: reference,
              sourceContentHash: sourceHash,
              verbatimText: `verbatim:${reference}`,
              observedAt: now,
            },
          ],
          createdAt: now,
        });

      await createPreference(
        sourceId,
        firstRelationshipId,
        "Prefers a 7am reminder.",
        "fixture:lineage:source",
      );
      await createPreference(
        targetId,
        firstRelationshipId,
        "Prefers an 8am reminder.",
        "fixture:lineage:target",
      );
      await createPreference(
        staleSourceId,
        firstRelationshipId,
        "Temporary reminder preference.",
        "fixture:lineage:stale",
      );
      await createPreference(
        crossTargetId,
        secondRelationshipId,
        "A different user's preference.",
        "fixture:lineage:cross-target",
      );

      const linked = await linkMemoryRecords(client, {
        tenantId,
        sourceMemoryRecordId: sourceId,
        expectedSourceLifecycleRevision: 1,
        targetMemoryRecordId: targetId,
        kind: "supersedes",
        reason: "User explicitly corrected the reminder time.",
        transitionedAt: later,
      });

      expect(linked.reused).toBe(false);
      expect(linked.source.record.lifecycleState).toBe("superseded");
      expect(linked.source.record.lifecycleRevision).toBe(2);
      expect(linked.target.record.lifecycleState).toBe("active");
      expect(linked.link.sourceMemoryRevisionId).toBe(
        linked.source.currentRevision.memoryRevisionId,
      );
      expect(linked.link.targetMemoryRevisionId).toBe(
        linked.target.currentRevision.memoryRevisionId,
      );

      const replay = await linkMemoryRecords(client, {
        tenantId,
        sourceMemoryRecordId: sourceId,
        expectedSourceLifecycleRevision: 1,
        targetMemoryRecordId: targetId,
        kind: "supersedes",
        reason: "User explicitly corrected the reminder time.",
        transitionedAt: later,
      });
      expect(replay.reused).toBe(true);
      expect(replay.source.record.lifecycleRevision).toBe(2);

      await expect(
        linkMemoryRecords(client, {
          tenantId,
          sourceMemoryRecordId: staleSourceId,
          expectedSourceLifecycleRevision: 2,
          targetMemoryRecordId: targetId,
          kind: "supersedes",
          reason: "Stale writer must lose.",
          transitionedAt: later,
        }),
      ).rejects.toMatchObject({
        code: "memory.lifecycle_revision_conflict",
      });

      await expect(
        linkMemoryRecords(client, {
          tenantId,
          sourceMemoryRecordId: staleSourceId,
          expectedSourceLifecycleRevision: 1,
          targetMemoryRecordId: crossTargetId,
          kind: "supersedes",
          reason: "Must not cross relationship scope.",
          transitionedAt: later,
        }),
      ).rejects.toMatchObject({
        code: "memory.lineage_scope_mismatch",
      });

      const historical = await getMemoryRecordInScope(client, {
        tenantId,
        memoryRecordId: sourceId,
        scope: {
          kind: "relationship",
          relationshipId: firstRelationshipId,
        },
      });
      expect(historical?.record.lifecycleState).toBe("superseded");
      expect(historical?.currentRevision.content).toBe(
        "Prefers a 7am reminder.",
      );
      expect(historical?.currentRevision.evidence[0]?.verbatimText).toBe(
        "verbatim:fixture:lineage:source",
      );
    });

    await expect(
      pool.query(
        `UPDATE memory.record_links
            SET reason = 'rewritten lineage'
          WHERE tenant_id = $1
            AND source_memory_record_id = $2`,
        [tenantId, sourceId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });

  it("publishes private memory only through current scoped authority and one-time approval", async () => {
    const tenantId = createCanonicalId("tenant");
    const userId = createCanonicalId("user");
    const characterId = createCanonicalId("character");
    const relationshipId = createCanonicalId("relationship");
    const worldId = createCanonicalId("world");
    const sourceMemoryRecordId = createCanonicalId("memory-record");
    const sourceMemoryRevisionId = createCanonicalId("memory-revision");
    const targetMemoryRecordId = createCanonicalId("memory-record");
    const targetMemoryRevisionId = createCanonicalId("memory-revision");
    const replacementMemoryRecordId = createCanonicalId("memory-record");
    const replacementMemoryRevisionId = createCanonicalId("memory-revision");
    const now = toInstant("2026-10-02T06:00:00Z");
    const expiresAt = toInstant("2099-01-01T00:00:00Z");
    const sourceHash = "e".repeat(64);
    const privateVerbatim = "PRIVATE: user said seven, not eight.";

    await withTransaction(pool, async (client) => {
      await createTenant(client, { tenantId, createdAt: now });
      await createUser(client, { tenantId, userId, createdAt: now });
      await createCharacter(client, {
        tenantId,
        characterId,
        createdAt: now,
      });
      await getOrCreateRelationship(client, {
        tenantId,
        relationshipId,
        userId,
        characterId,
        createdAt: now,
      });
      await createWorld(client, {
        tenantId,
        worldId,
        initialGenerationId: createCanonicalId("world-generation"),
        policy: testWorldPolicy(),
        simulationTime: now,
        createdAt: now,
      });
      await setPolicyRevision(client, tenantId, "policy-1");
      await createMemoryRecord(client, {
        tenantId,
        memoryRecordId: sourceMemoryRecordId,
        memoryRevisionId: sourceMemoryRevisionId,
        memoryType: "fact",
        scope: { kind: "relationship", relationshipId },
        content: "The user's private preference may support a shared summary.",
        extractionMethod: "fixture",
        observedAt: now,
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "fixture:publication:private-source",
            sourceContentHash: sourceHash,
            verbatimText: privateVerbatim,
            observedAt: now,
          },
        ],
        createdAt: now,
      });
    });

    const principal = {
      kind: "system",
      systemKind: "memory-publication-test",
    } as const;
    const baseAuthority = createAuthorityContext({
      tenantId,
      principal,
      scopes: [],
      capabilities: ["memory.scope.publish"],
      resourceScope: {
        relationshipIds: [relationshipId],
        worldIds: [worldId],
      },
      policyRevision: "policy-1",
      approvalIds: [],
      delegationChain: [],
      expiresAt,
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });

    const target = {
      tenantId,
      sourceMemoryRecordId,
      sourceMemoryRevisionId,
      sourceScope: { kind: "relationship", relationshipId } as const,
      targetMemoryRecordId,
      targetMemoryRevisionId,
      targetMemoryType: "fact" as const,
      targetScope: { kind: "world", worldId } as const,
      targetRevision: {
        content: "A deliberately approved shared summary.",
        extractionMethod: "publication-fixture",
        observedAt: now,
      },
      reason: "Explicitly approved for shared world continuity.",
    } as const;

    const unscopedAuthority = createAuthorityContext({
      tenantId,
      principal,
      scopes: [],
      capabilities: ["memory.scope.publish"],
      resourceScope: { worldIds: [worldId] },
      policyRevision: "policy-1",
      approvalIds: [],
      delegationChain: [],
      expiresAt,
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });
    await expect(
      prepareMemoryScopePublication(pool, {
        ...target,
        authority: unscopedAuthority,
        idempotencyKey: "memory-publish-unscoped",
        expiresAt,
      }),
    ).rejects.toMatchObject({
      code: "memory.publication_source_scope_mismatch",
    });

    const prepared = await prepareMemoryScopePublication(pool, {
      ...target,
      authority: baseAuthority,
      idempotencyKey: "memory-publish-1",
      expiresAt,
    });
    expect(prepared.reused).toBe(false);

    const approval = createPendingApproval({
      kind: "once",
      binding: prepared.binding,
      policyRevision: "policy-1",
      requestedAt: now,
      expiresAt,
    });
    await withTransaction(pool, async (client) => {
      await persistPendingApproval(client, approval);
      await settlePendingApproval(client, {
        tenantId,
        approvalId: approval.approvalId,
        decision: "approved",
        approverKey: "operator:memory-publication-test",
        decidedAt: now,
      });
    });

    const executeAuthority = createAuthorityContext({
      tenantId,
      principal,
      scopes: [],
      capabilities: ["memory.scope.publish"],
      resourceScope: {
        relationshipIds: [relationshipId],
        worldIds: [worldId],
      },
      policyRevision: "policy-1",
      approvalIds: [approval.approvalId],
      delegationChain: [],
      expiresAt,
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });

    const published = await executeMemoryScopePublication(pool, {
      ...target,
      authority: executeAuthority,
      operationId: prepared.operation.operationId,
      approvalId: approval.approvalId,
      publishedAt: now,
    });
    expect(published.reused).toBe(false);
    expect(published.operation.state).toBe("succeeded");
    expect(published.target.record.scope).toEqual({
      kind: "world",
      worldId,
    });
    expect(published.target.currentRevision.content).toBe(
      "A deliberately approved shared summary.",
    );
    expect(published.target.currentRevision.evidence).toHaveLength(1);
    expect(published.target.currentRevision.evidence[0]).toMatchObject({
      sourceKind: "operator",
      sourceReference: `memory-publication:${prepared.operation.operationId}`,
      verbatimText: null,
    });
    expect(published.target.currentRevision.evidence[0]?.sourceContentHash).toHaveLength(64);

    await withTransaction(pool, async (client) => {
      const sourceImmediatelyAfterPublication = await getMemoryRecordInScope(client, {
        tenantId,
        memoryRecordId: sourceMemoryRecordId,
        scope: { kind: "relationship", relationshipId },
      });
      expect(sourceImmediatelyAfterPublication?.record.lifecycleState).toBe("active");
      expect(sourceImmediatelyAfterPublication?.record.scope).toEqual({
        kind: "relationship",
        relationshipId,
      });
      expect(
        sourceImmediatelyAfterPublication?.currentRevision.evidence[0]?.verbatimText,
      ).toBe(privateVerbatim);
    });

    const replay = await executeMemoryScopePublication(pool, {
      ...target,
      authority: executeAuthority,
      operationId: prepared.operation.operationId,
      approvalId: approval.approvalId,
      publishedAt: now,
    });
    expect(replay.reused).toBe(true);

    await withTransaction(pool, async (client) => {
      await createMemoryRecord(client, {
        tenantId,
        memoryRecordId: replacementMemoryRecordId,
        memoryRevisionId: replacementMemoryRevisionId,
        memoryType: "fact",
        scope: { kind: "relationship", relationshipId },
        content: "A later private correction supersedes the original source.",
        extractionMethod: "fixture",
        observedAt: now,
        evidence: [
          {
            sourceKind: "message",
            sourceReference: "fixture:publication:later-correction",
            sourceContentHash: "1".repeat(64),
            observedAt: now,
          },
        ],
        createdAt: now,
      });
      await linkMemoryRecords(client, {
        tenantId,
        sourceMemoryRecordId,
        expectedSourceLifecycleRevision: 1,
        targetMemoryRecordId: replacementMemoryRecordId,
        kind: "supersedes",
        reason: "Later private evidence superseded the publication source.",
        transitionedAt: now,
      });
    });

    // The already-succeeded publication is a receipt, not a fresh mutation. It must
    // remain replayable after the private source lifecycle advances.
    const replayAfterSupersession = await executeMemoryScopePublication(pool, {
      ...target,
      authority: executeAuthority,
      operationId: prepared.operation.operationId,
      approvalId: approval.approvalId,
      publishedAt: now,
    });
    expect(replayAfterSupersession.reused).toBe(true);
    expect(replayAfterSupersession.target.record.memoryRecordId).toBe(
      targetMemoryRecordId,
    );

    await withTransaction(pool, async (client) => {
      const source = await getMemoryRecordInScope(client, {
        tenantId,
        memoryRecordId: sourceMemoryRecordId,
        scope: { kind: "relationship", relationshipId },
      });
      expect(source?.record.lifecycleState).toBe("superseded");
      expect(source?.record.scope).toEqual({
        kind: "relationship",
        relationshipId,
      });
      expect(source?.currentRevision.evidence[0]?.verbatimText).toBe(
        privateVerbatim,
      );

      await expect(
        getMemoryRecordInScope(client, {
          tenantId,
          memoryRecordId: targetMemoryRecordId,
          scope: { kind: "relationship", relationshipId },
        }),
      ).resolves.toBeNull();
    });

    const audit = await pool.query<Record<string, unknown>>(
      `SELECT to_jsonb(publication) AS publication
         FROM memory.scope_publications publication
        WHERE tenant_id = $1
          AND operation_id = $2`,
      [tenantId, prepared.operation.operationId],
    );
    expect(audit.rowCount).toBe(1);
    expect(JSON.stringify(audit.rows[0])).not.toContain(privateVerbatim);

    const approvalState = await pool.query<{ state: string }>(
      `SELECT state
         FROM security.approvals
        WHERE tenant_id = $1
          AND approval_id = $2`,
      [tenantId, approval.approvalId],
    );
    expect(approvalState.rows[0]?.state).toBe("consumed");

    await expect(
      pool.query(
        `UPDATE memory.scope_publications
            SET reason = 'rewritten publication'
          WHERE tenant_id = $1
            AND operation_id = $2`,
        [tenantId, prepared.operation.operationId],
      ),
    ).rejects.toMatchObject({ code: "23514" });

    await expect(
      pool.query(
        `UPDATE memory.records
            SET scope_kind = 'world',
                scope_ref_id = $1
          WHERE tenant_id = $2
            AND memory_record_id = $3`,
        [worldId, tenantId, sourceMemoryRecordId],
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });


  it("admits memory extraction idempotently and binds the key to exact scoped source evidence", async () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipId = createCanonicalId("relationship");
    const now = toInstant("2026-10-01T00:00:00Z");
    const input = {
      tenantId,
      idempotencyKey: "turn:memory-extraction:1",
      scope: { kind: "relationship", relationshipId } as const,
      source: {
        kind: "message" as const,
        reference: "message:memory-extraction:1",
        contentHash: "2".repeat(64),
      },
      extractor: {
        key: "default-facts",
        version: "1",
      },
      maxAttempts: 3,
      availableAt: now,
    } as const;

    const first = await withTransaction(pool, (client) =>
      enqueueMemoryExtraction(client, input),
    );
    expect(first.reused).toBe(false);
    expect(first.job.state).toBe("queued");
    expect(first.job.scope).toEqual(input.scope);
    expect(first.job.source).toEqual(input.source);
    expect(first.job.requestFingerprint).toHaveLength(64);

    const replay = await withTransaction(pool, (client) =>
      enqueueMemoryExtraction(client, {
        ...input,
        availableAt: toInstant("2026-10-01T00:10:00Z"),
      }),
    );
    expect(replay.reused).toBe(true);
    expect(replay.job.memoryExtractionId).toBe(first.job.memoryExtractionId);

    await expect(
      withTransaction(pool, (client) =>
        enqueueMemoryExtraction(client, {
          ...input,
          source: {
            ...input.source,
            contentHash: "3".repeat(64),
          },
        }),
      ),
    ).rejects.toMatchObject({
      code: "memory.extraction_idempotency_conflict",
    });
  });

  it("dead-letters poison extraction without blocking later eligible jobs", async () => {
    const tenantId = createCanonicalId("tenant");
    const relationshipId = createCanonicalId("relationship");
    const now = toInstant("2026-10-01T00:00:00Z");

    const enqueue = async (
      key: string,
      sourceHash: string,
      maxAttempts: number,
    ) =>
      withTransaction(pool, (client) =>
        enqueueMemoryExtraction(client, {
          tenantId,
          idempotencyKey: key,
          scope: { kind: "relationship", relationshipId },
          source: {
            kind: "message",
            reference: `message:${key}`,
            contentHash: sourceHash,
          },
          extractor: { key: "default-facts", version: "1" },
          maxAttempts,
          availableAt: now,
        }),
      );

    const poison = await enqueue(
      "extract:poison",
      "4".repeat(64),
      2,
    );
    const healthy = await enqueue(
      "extract:healthy",
      "5".repeat(64),
      3,
    );

    const [firstClaim] = await claimMemoryExtractionBatch(pool, {
      tenantId,
      workerId: "memory-worker-a",
      limit: 1,
      leaseMs: 60_000,
    });
    expect(firstClaim?.memoryExtractionId).toBe(
      poison.job.memoryExtractionId,
    );
    expect(firstClaim?.attempt).toBe(1);

    const firstFailure = await settleMemoryExtractionClaim(pool, {
      tenantId,
      memoryExtractionId: poison.job.memoryExtractionId,
      workerId: "memory-worker-a",
      fence: firstClaim!.fence,
      settlement: {
        outcome: "retryable-failure",
        safeErrorCode: "extractor.malformed_output",
        retryAt: now,
      },
    });
    expect(firstFailure.state).toBe("retry-scheduled");

    const secondClaims = await claimMemoryExtractionBatch(pool, {
      tenantId,
      workerId: "memory-worker-b",
      limit: 2,
      leaseMs: 60_000,
    });
    expect(secondClaims).toHaveLength(2);

    const poisonClaim = secondClaims.find(
      (claim) =>
        claim.memoryExtractionId === poison.job.memoryExtractionId,
    );
    const healthyClaim = secondClaims.find(
      (claim) =>
        claim.memoryExtractionId === healthy.job.memoryExtractionId,
    );
    expect(poisonClaim?.attempt).toBe(2);
    expect(healthyClaim?.attempt).toBe(1);

    const poisonTerminal = await settleMemoryExtractionClaim(pool, {
      tenantId,
      memoryExtractionId: poison.job.memoryExtractionId,
      workerId: "memory-worker-b",
      fence: poisonClaim!.fence,
      settlement: {
        outcome: "retryable-failure",
        safeErrorCode: "extractor.malformed_output",
        retryAt: now,
      },
    });
    expect(poisonTerminal.state).toBe("dead-letter");
    expect(poisonTerminal.safeErrorCode).toBe(
      "extractor.malformed_output",
    );

    const healthyTerminal = await settleMemoryExtractionClaim(pool, {
      tenantId,
      memoryExtractionId: healthy.job.memoryExtractionId,
      workerId: "memory-worker-b",
      fence: healthyClaim!.fence,
      settlement: { outcome: "completed" },
    });
    expect(healthyTerminal.state).toBe("completed");

    const later = await enqueue(
      "extract:later",
      "6".repeat(64),
      2,
    );
    const [laterClaim] = await claimMemoryExtractionBatch(pool, {
      tenantId,
      workerId: "memory-worker-c",
      limit: 1,
      leaseMs: 60_000,
    });
    expect(laterClaim?.memoryExtractionId).toBe(
      later.job.memoryExtractionId,
    );
    await settleMemoryExtractionClaim(pool, {
      tenantId,
      memoryExtractionId: later.job.memoryExtractionId,
      workerId: "memory-worker-c",
      fence: laterClaim!.fence,
      settlement: { outcome: "no-facts" },
    });

    await withTransaction(pool, async (client) => {
      const poisonJob = await getMemoryExtractionJob(
        client,
        tenantId,
        poison.job.memoryExtractionId,
      );
      expect(poisonJob?.state).toBe("dead-letter");

      const poisonAttempts = await listMemoryExtractionAttempts(
        client,
        tenantId,
        poison.job.memoryExtractionId,
      );
      expect(poisonAttempts.map((attempt) => attempt.outcome)).toEqual([
        "retry-scheduled",
        "dead-letter",
      ]);

      const laterJob = await getMemoryExtractionJob(
        client,
        tenantId,
        later.job.memoryExtractionId,
      );
      expect(laterJob?.state).toBe("no-facts");
    });
  });

  it("reclaims an expired extraction lease and fences the stale worker", async () => {
    const tenantId = createCanonicalId("tenant");
    const now = toInstant("2026-10-01T00:00:00Z");
    const admitted = await withTransaction(pool, (client) =>
      enqueueMemoryExtraction(client, {
        tenantId,
        idempotencyKey: "extract:lease-recovery",
        scope: { kind: "organization" },
        source: {
          kind: "platform-event",
          reference: "event:lease-recovery",
          contentHash: "7".repeat(64),
        },
        extractor: { key: "default-facts", version: "1" },
        maxAttempts: 2,
        availableAt: now,
      }),
    );

    const [first] = await claimMemoryExtractionBatch(pool, {
      tenantId,
      workerId: "memory-worker-stale",
      limit: 1,
      leaseMs: 60_000,
    });
    expect(first?.attempt).toBe(1);

    const renewed = await renewMemoryExtractionClaim(pool, {
      tenantId,
      memoryExtractionId: admitted.job.memoryExtractionId,
      workerId: "memory-worker-stale",
      fence: first!.fence,
      leaseMs: 120_000,
    });
    expect(renewed.fence).toBe(first!.fence);

    await withTransaction(pool, async (client) => {
      await client.query(
        `UPDATE memory.extraction_jobs
            SET lease_expires_at = clock_timestamp() - interval '1 second'
          WHERE tenant_id = $1
            AND memory_extraction_id = $2`,
        [tenantId, admitted.job.memoryExtractionId],
      );
      await client.query(
        `UPDATE memory.extraction_attempts
            SET lease_expires_at = clock_timestamp() - interval '1 second'
          WHERE tenant_id = $1
            AND memory_extraction_id = $2
            AND attempt = 1`,
        [tenantId, admitted.job.memoryExtractionId],
      );
    });

    const [reclaimed] = await claimMemoryExtractionBatch(pool, {
      tenantId,
      workerId: "memory-worker-recovery",
      limit: 1,
      leaseMs: 60_000,
    });
    expect(reclaimed?.memoryExtractionId).toBe(
      admitted.job.memoryExtractionId,
    );
    expect(reclaimed?.attempt).toBe(2);
    expect(reclaimed!.fence).toBeGreaterThan(first!.fence);

    await expect(
      settleMemoryExtractionClaim(pool, {
        tenantId,
        memoryExtractionId: admitted.job.memoryExtractionId,
        workerId: "memory-worker-stale",
        fence: first!.fence,
        settlement: { outcome: "completed" },
      }),
    ).rejects.toMatchObject({
      code: "memory.extraction_stale_claim",
    });

    await settleMemoryExtractionClaim(pool, {
      tenantId,
      memoryExtractionId: admitted.job.memoryExtractionId,
      workerId: "memory-worker-recovery",
      fence: reclaimed!.fence,
      settlement: { outcome: "completed" },
    });

    await withTransaction(pool, async (client) => {
      const attempts = await listMemoryExtractionAttempts(
        client,
        tenantId,
        admitted.job.memoryExtractionId,
      );
      expect(attempts.map((attempt) => attempt.outcome)).toEqual([
        "lease-expired",
        "completed",
      ]);
    });
  });

  it("dead-letters a final crashed extraction attempt instead of reclaiming forever", async () => {
    const tenantId = createCanonicalId("tenant");
    const now = toInstant("2026-10-01T00:00:00Z");
    const admitted = await withTransaction(pool, (client) =>
      enqueueMemoryExtraction(client, {
        tenantId,
        idempotencyKey: "extract:final-expired",
        scope: { kind: "organization" },
        source: {
          kind: "platform-event",
          reference: "event:final-expired",
          contentHash: "8".repeat(64),
        },
        extractor: { key: "default-facts", version: "1" },
        maxAttempts: 1,
        availableAt: now,
      }),
    );

    await claimMemoryExtractionBatch(pool, {
      tenantId,
      workerId: "memory-worker-final",
      limit: 1,
      leaseMs: 60_000,
    });

    await withTransaction(pool, async (client) => {
      await client.query(
        `UPDATE memory.extraction_jobs
            SET lease_expires_at = clock_timestamp() - interval '1 second'
          WHERE tenant_id = $1
            AND memory_extraction_id = $2`,
        [tenantId, admitted.job.memoryExtractionId],
      );
      await client.query(
        `UPDATE memory.extraction_attempts
            SET lease_expires_at = clock_timestamp() - interval '1 second'
          WHERE tenant_id = $1
            AND memory_extraction_id = $2
            AND attempt = 1`,
        [tenantId, admitted.job.memoryExtractionId],
      );
    });

    await expect(
      claimMemoryExtractionBatch(pool, {
        tenantId,
        workerId: "memory-worker-should-not-reclaim",
        limit: 1,
        leaseMs: 60_000,
      }),
    ).resolves.toEqual([]);

    await withTransaction(pool, async (client) => {
      const job = await getMemoryExtractionJob(
        client,
        tenantId,
        admitted.job.memoryExtractionId,
      );
      expect(job).toMatchObject({
        state: "dead-letter",
        attempt: 1,
        safeErrorCode: "memory.extraction.lease_expired",
      });
      expect(job?.terminalAt).not.toBeNull();

      const attempts = await listMemoryExtractionAttempts(
        client,
        tenantId,
        admitted.job.memoryExtractionId,
      );
      expect(attempts).toHaveLength(1);
      expect(attempts[0]).toMatchObject({
        outcome: "lease-expired",
        safeErrorCode: "memory.extraction.lease_expired",
      });
    });
  });

});
