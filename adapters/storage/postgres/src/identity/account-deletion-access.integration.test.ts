import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createCanonicalId } from "@masanawa/contracts";
import { runMigrations } from "../migrations.js";
import { createPostgresPlatformSessionRepository } from "../security/platform-session.js";
import { createPostgresAccountDeletionRepository, createPostgresAccountDeletionChallengeRepository } from "./account-deletion.js";
import { createPostgresAccountDeletionAccessRevoker } from "./account-deletion-access.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describeDatabase = connectionString ? describe : describe.skip;

describeDatabase("R12 identity-privacy access revocation", () => {
  let pool: Pool;
  const tenantId = createCanonicalId("tenant");
  let userId = createCanonicalId("user");
  let requestId: string = randomUUID();
  let accessHash = "a".repeat(64);
  const createdAt = new Date().toISOString();

  const clearFinancials = {
    async check() {
      return {
        clear: true,
        checkedAt: createdAt,
        reference: "test-reconciliation-evidence",
      };
    },
  };

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    const root = (path: string) =>
      fileURLToPath(new URL(`../../../../../packages/${path}/migrations`, import.meta.url));
    await runMigrations(pool, [
      { owner: "events", directory: root("events") },
      { owner: "security", directory: root("security") },
      { owner: "identity", directory: root("identity") },
      { owner: "agents", directory: root("agents") },
    ]);
    const security = createPostgresPlatformSessionRepository(pool);
    const profile = await security.createProfile({
      tenantId, channel: "email", identifier: `r12-revoke-${randomUUID()}@example.com`,
      name: "Revocation Customer", locale: "en", createdAt,
    });
    userId = profile.userId;
    const identity = { tenantId, userId, profile };
    accessHash = randomUUID().replace(/-/gu, "").padEnd(64, "a");
    await security.issueSession({
      identity, accessHash, refreshHash: randomUUID().replace(/-/gu, "").padEnd(64, "b"),
      accessExpiresAt: new Date(Date.parse(createdAt) + 3600_000).toISOString(),
      refreshExpiresAt: new Date(Date.parse(createdAt) + 86400_000).toISOString(),
      issuedAt: createdAt,
    });

    const characterId = createCanonicalId("character");
    await pool.query(
      `INSERT INTO identity.characters(tenant_id,character_id,created_at,updated_at)
       VALUES ($1,$2,$3,$3)`,
      [tenantId,characterId,createdAt],
    );
    await pool.query(
      `INSERT INTO identity.character_ownership
         (tenant_id,character_id,kind,owner_user_id,created_at)
       VALUES ($1,$2,'personal-clone',$3,$4)`,
      [tenantId,characterId,userId,createdAt],
    );
    await pool.query(
      `INSERT INTO identity.twin_profiles
         (tenant_id,character_id,owner_user_id,public_id,display_name,bio,
          interests,languages,avatar_url,discoverable,revision,created_at,updated_at)
       VALUES ($1,$2,$3,$4,'Test Twin','','[]'::jsonb,'["en"]'::jsonb,
               NULL,true,1,$5,$5)`,
      [tenantId,characterId,userId,`r12-${randomUUID().replace(/-/gu, "").slice(0,15)}`,createdAt],
    );
    await pool.query(
      `INSERT INTO security.customer_channel_links
         (channel,external_user_id,chat_id,tenant_id,user_id,character_id,updated_at)
       VALUES ('telegram',$1,$2,$3,$4,$5,$6)`,
      [`r12-${randomUUID()}`,`chat-${randomUUID()}`,tenantId,userId,characterId,createdAt],
    );
    await pool.query(
      `INSERT INTO agents.mobile_push_registrations
         (tenant_id,user_id,installation_id,platform,token)
       VALUES ($1,$2,$3,'android',$4)`,
      [tenantId,userId,`install-${randomUUID()}`,`fcm-${randomUUID()}`],
    );
    await pool.query(
      `INSERT INTO agents.mobile_presence
         (tenant_id,user_id,character_id,relationship_id,state,expires_at)
       VALUES ($1,$2,$3,$4,'available',$5)`,
      [tenantId,userId,characterId,createCanonicalId("relationship"),
       new Date(Date.parse(createdAt) + 100000).toISOString()],
    );
    const requests = createPostgresAccountDeletionRepository(pool);
    const opened = await requests.open({ tenantId,userId,requestId,now:createdAt });
    requestId = opened.requestId;
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("refuses to revoke before financial clearance and authorized processing", async () => {
    const revoker = createPostgresAccountDeletionAccessRevoker(pool,clearFinancials);
    await expect(revoker.revoke({
      tenantId,userId,requestId,expectedRevision:1,now:createdAt,
    })).rejects.toThrow("account_deletion.access_not_authorized");
    const session = await createPostgresPlatformSessionRepository(pool).resolveAccess({
      accessHash,at:createdAt,
    });
    expect(session?.userId).toBe(userId);
  });

  it("revokes access atomically with immutable idempotent receipt but never declares erasure", async () => {
    const requests = createPostgresAccountDeletionRepository(pool);
    const challenges = createPostgresAccountDeletionChallengeRepository(pool);
    const digest = "c".repeat(64);
    await challenges.put({
      tenantId,userId,requestId,codeHash:digest,channel:"email",now:createdAt,
      expiresAt:new Date(Date.parse(createdAt) + 600000).toISOString(),
      resendAfter:new Date(Date.parse(createdAt) + 60000).toISOString(),
    });
    const verified = await challenges.verify({
      tenantId,userId,requestId,codeHash:digest,expectedRevision:1,now:createdAt,
    });
    expect(verified.result).toBe("accepted");
    const processing = await requests.transition({
      tenantId,userId,target:"processing",expectedRevision:2,now:createdAt,
    });
    expect(processing.phase).toBe("processing");

    const revoker = createPostgresAccountDeletionAccessRevoker(pool,clearFinancials);
    await expect(revoker.revoke({
      tenantId,userId,requestId,expectedRevision:123,now:createdAt,
    })).rejects.toThrow("account_deletion.access_not_authorized");
    // An unavailable/negative finance guard must not revoke access.
    const rejected = createPostgresAccountDeletionAccessRevoker(pool, {
      async check() {
        return { clear: false, checkedAt: createdAt, reference: "blocked-financials" };
      },
    });
    await expect(rejected.revoke({
      tenantId,userId,requestId,expectedRevision:3,now:createdAt,
    })).rejects.toThrow("account_deletion.financial_clearance_required");
    expect((await createPostgresPlatformSessionRepository(pool).resolveAccess({
      accessHash,at:createdAt,
    }))?.userId).toBe(userId);

    const receipt = await revoker.revoke({
      tenantId,userId,requestId,expectedRevision:3,now:createdAt,
    });
    expect(receipt.alreadyRevoked).toBe(false);
    expect(receipt.clearanceReference).toBe("test-reconciliation-evidence");
    expect((await revoker.revoke({
      tenantId,userId,requestId,expectedRevision:3,now:createdAt,
    })).alreadyRevoked).toBe(true);

    const state = await pool.query<{ state: string }>(
      `SELECT state FROM identity.users WHERE tenant_id=$1 AND user_id=$2`,
      [tenantId,userId],
    );
    expect(state.rows[0]?.state).toBe("disabled");
    expect(await createPostgresPlatformSessionRepository(pool).resolveAccess({
      accessHash, at: createdAt,
    })).toBeNull();

    const resources = await pool.query<{
      channels: string; tokens: string; presence: string;
      discoverable_twins: string; enabled_characters: string;
    }>(
      `SELECT
       (SELECT count(*)::text FROM security.customer_channel_links WHERE tenant_id=$1 AND user_id=$2) AS channels,
       (SELECT count(*)::text FROM agents.mobile_push_registrations WHERE tenant_id=$1 AND user_id=$2) AS tokens,
       (SELECT count(*)::text FROM agents.mobile_presence WHERE tenant_id=$1 AND user_id=$2) AS presence,
       (SELECT count(*)::text FROM identity.twin_profiles WHERE tenant_id=$1 AND owner_user_id=$2 AND discoverable) AS discoverable_twins,
       (SELECT count(*)::text FROM identity.characters c JOIN identity.character_ownership o
           ON o.tenant_id=c.tenant_id AND o.character_id=c.character_id
         WHERE o.tenant_id=$1 AND o.owner_user_id=$2 AND o.kind='personal-clone' AND c.state='active') AS enabled_characters`,
      [tenantId,userId],
    );
    expect(resources.rows[0]).toEqual({
      channels:"0",tokens:"0",presence:"0",
      discoverable_twins:"0",enabled_characters:"0",
    });
    const saved = await requests.read({ tenantId,userId });
    expect(saved?.phase).toBe("processing");
    await expect(pool.query(
      `DELETE FROM identity.account_deletion_access_revocations WHERE request_id=$1::uuid`,
      [requestId],
    )).rejects.toThrow(/immutable/);
  });
});
