import type { TenantId } from "@masanawa/contracts";
import {
  createPostgresAgentPresentationRepository,
  createPostgresCharacterSkillAssignmentRepository,
  createPostgresIdentityRepository,
  createPostgresPlatformAgentProfileRepository,
  createPostgresServiceDependency,
  createPostgresSkillDistributionRepository,
  withTransaction,
} from "@masanawa/postgres";

import {
  ensureDefaultPlatformAgents,
  type PlatformAgentBootstrapResult,
  type PlatformAgentIdentityProvisioner,
} from "./platform_agent_bootstrap.js";

type PostgresPool = ReturnType<typeof createPostgresServiceDependency>["pool"];

/**
 * Must be executed *inside* a PostgreSQL transaction. The advisory xact lock
 * serializes every gateway replica bootstrapping a particular tenant, while
 * all identity, presentation, skill and profile writes use the SAME client.
 * Unlike a pooled session lock this releases automatically on commit,
 * rollback or connection loss and never leaves partial seed data committed.
 */
export async function lockPlatformAgentSeedTransaction(
  client: { query(sql: string, values?: unknown[]): Promise<unknown> },
  tenantId: TenantId,
): Promise<void> {
  await client.query("SET LOCAL lock_timeout = '15s'");
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))",
    ["masanawa:platform-agents:bootstrap:v1:" + tenantId],
  );
}

/**
 * Atomic tenant-scoped, restart-safe canonical support-agent provisioning.
 * This is NOT the remaining fifteen-persona catalog or LiveKit/voice
 * qualification. Identity FKs and policy already exist in canonical schema:
 * this operation intentionally adds no duplicate migration or shadow table.
 */
export async function bootstrapDefaultPlatformAgentsFromPostgres(input: Readonly<{
  pool: PostgresPool;
  tenantId: TenantId;
}>): Promise<PlatformAgentBootstrapResult> {
  return withTransaction(input.pool, async (client) => {
    // Acquire BEFORE any read of the current profile/presentation roster.
    await lockPlatformAgentSeedTransaction(client, input.tenantId);

    const identities = createPostgresIdentityRepository(client);
    const identity: PlatformAgentIdentityProvisioner = Object.freeze<PlatformAgentIdentityProvisioner>({
      async provision(item) {
        if (item.tenantId !== input.tenantId) {
          throw new Error("Bootstrap tenant mismatch");
        }
        await identities.createCharacter({
          tenantId: item.tenantId,
          characterId: item.characterId,
          createdAt: item.createdAt,
        });
        await identities.assignCharacterOwnership({
          tenantId: item.tenantId,
          characterId: item.characterId,
          kind: "platform",
          ownerUserId: null,
          createdAt: item.createdAt,
        });
        await identities.createCharacterVersion({
          tenantId: item.tenantId,
          characterVersionId: item.characterVersionId,
          characterId: item.characterId,
          versionNumber: 1,
          constitution: item.constitution,
          createdAt: item.createdAt,
        });
        await identities.publishCharacterVersion({
          tenantId: item.tenantId,
          characterVersionId: item.characterVersionId,
          publishedAt: item.createdAt,
        });
        await identities.activateCharacterVersion({
          tenantId: item.tenantId,
          characterId: item.characterId,
          characterVersionId: item.characterVersionId,
          expectedCharacterRevision: 1,
          activatedAt: item.createdAt,
        });
      },
    });

    const result = await ensureDefaultPlatformAgents({
      tenantId: input.tenantId,
      identity,
      presentations: createPostgresAgentPresentationRepository(client),
      profiles: createPostgresPlatformAgentProfileRepository(client),
      skillAssignments: createPostgresCharacterSkillAssignmentRepository(client),
      skillDistribution: createPostgresSkillDistributionRepository(client),
    });
    // withTransaction commits only AFTER the authoritative profile readback.
    return result;
  });
}
