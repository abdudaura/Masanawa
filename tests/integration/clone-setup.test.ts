import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, afterAll, describe, expect, it } from "vitest";
import { createCanonicalId, nowInstant } from "@masanawa/contracts";
import { completeCloneSetup, confirmCloneSetup, previewCloneSetup, reviseCloneSetup, type CloneSetupScope } from "@masanawa/identity";
import { createPostgresCloneSetupRepository, createPostgresPersonalCloneProvisioningRepository, createPostgresPool, runMigrations } from "@masanawa/postgres";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const databaseName = `masanawa_clone_setup_${randomUUID().replaceAll("-", "")}`;
describe.skipIf(!connectionString)("clone setup PostgreSQL 18 acceptance", () => {
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let databaseUrl: string;
  let created = false;
  beforeAll(async () => {
    admin = createPostgresPool({ connectionString: connectionString!, applicationName: "clone-setup-test-admin", max: 1 });
    const version = await admin.query("SHOW server_version_num");
    expect(Number(version.rows[0].server_version_num)).toBeGreaterThanOrEqual(180000);
    expect(Number(version.rows[0].server_version_num)).toBeLessThan(190000);
    await admin.query(`CREATE DATABASE ${databaseName} TEMPLATE template0`);
    created = true;
    const url = new URL(connectionString!); url.pathname = `/${databaseName}`; databaseUrl = url.toString();
    pool = createPostgresPool({ connectionString: databaseUrl, applicationName: "clone-setup-test", max: 4 });
  });
  beforeEach(async () => {
    await pool.query("DROP SCHEMA IF EXISTS identity CASCADE");
    await pool.query("DROP TABLE IF EXISTS public.masanawa_schema_migrations");
    await runMigrations(pool, [{ owner: "identity", directory: fileURLToPath(new URL("../../packages/identity/migrations", import.meta.url)) }]);
  });
  afterAll(async () => {
    try { await pool?.end(); if (created) await admin.query(`DROP DATABASE ${databaseName}`); }
    finally { await admin?.end(); }
  });
  async function fixture() {
    const scope: CloneSetupScope = { tenantId: createCanonicalId("tenant"), userId: createCanonicalId("user") };
    await pool.query("INSERT INTO identity.tenants(tenant_id,created_at,updated_at) VALUES($1,now(),now())", [scope.tenantId]);
    await pool.query("INSERT INTO identity.users(tenant_id,user_id,created_at,updated_at) VALUES($1,$2,now(),now())", [scope.tenantId, scope.userId]);
    const repository = createPostgresCloneSetupRepository(pool);
    const profile = { displayName: "Nasir", languages: ["Hausa", "English"] };
    await repository.mutate(scope, current => reviseCloneSetup(scope, current, null, profile));
    return { scope, repository, profile, requestId: createCanonicalId("request") };
  }
  async function confirm(f: Awaited<ReturnType<typeof fixture>>) {
    await f.repository.mutate(f.scope, current => previewCloneSetup(f.scope, current, 1));
    return f.repository.mutate(f.scope, current => confirmCloneSetup(f.scope, current, 2, f.requestId));
  }
  async function provision(scope: CloneSetupScope) {
    const p = await createPostgresPersonalCloneProvisioningRepository(pool).getOrCreatePersonalClone({
      ...scope, characterId: createCanonicalId("character"), characterVersionId: createCanonicalId("character-version"), relationshipId: createCanonicalId("relationship"), createdAt: nowInstant(),
      constitution: { schemaVersion: 1, displayName: "Nasir", biography: "Personal clone", languages: ["Hausa"], personality: [], boundaries: [], disclosurePolicy: {}, voiceReferences: [], appearanceReferences: [], expertise: [] },
    });
    return { characterId: p.character.characterId, characterVersionId: p.version.characterVersionId, relationshipId: p.relationship.relationshipId, displayName: "Nasir", created: p.created };
  }
  it("recovers private drafts after pool recreation and preserves confirmation replay", async () => {
    const f = await fixture(); await confirm(f);
    const replacement = createPostgresPool({ connectionString: databaseUrl, applicationName: "clone-setup-restarted", max: 1 });
    try {
      const recovered = createPostgresCloneSetupRepository(replacement);
      const saved = await recovered.read(f.scope);
      expect(saved?.state).toBe("confirmed");
      expect(saved?.profile).toMatchObject(f.profile);
      expect(await recovered.mutate(f.scope, current => confirmCloneSetup(f.scope, current, 2, f.requestId))).toEqual(saved);
    } finally { await replacement.end(); }
  });
  it("isolates another active user and refuses disabled user/tenant access", async () => {
    const f = await fixture(); const other = await fixture();
    expect((await f.repository.read(other.scope))?.userId).toBe(other.scope.userId);
    await pool.query("UPDATE identity.users SET state='disabled' WHERE tenant_id=$1 AND user_id=$2", [f.scope.tenantId, f.scope.userId]);
    await expect(f.repository.read(f.scope)).rejects.toThrow();
    await pool.query("UPDATE identity.tenants SET state='disabled' WHERE tenant_id=$1", [other.scope.tenantId]);
    await expect(other.repository.mutate(other.scope, current => previewCloneSetup(other.scope, current, 1))).rejects.toThrow();
  });
  it("serializes competing profile edits across independent connections with one winner", async () => {
    const f = await fixture();
    const otherPool = createPostgresPool({ connectionString: databaseUrl, applicationName: "clone-setup-race", max: 1 });
    try {
      const other = createPostgresCloneSetupRepository(otherPool);
      const results = await Promise.allSettled([
        f.repository.mutate(f.scope, current => reviseCloneSetup(f.scope, current, 1, { displayName: "First" })),
        other.mutate(f.scope, current => reviseCloneSetup(f.scope, current, 1, { displayName: "Second" })),
      ]);
      expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter(r => r.status === "rejected")).toHaveLength(1);
      expect((await other.read(f.scope))?.revision).toBe(2);
    } finally { await otherPool.end(); }
  });
  it("converges simultaneous exact confirmations without rebinding the request", async () => {
    const f = await fixture();
    await f.repository.mutate(f.scope, current => previewCloneSetup(f.scope, current, 1));
    const confirmations = await Promise.all([
      f.repository.mutate(f.scope, current => confirmCloneSetup(f.scope, current, 2, f.requestId)),
      createPostgresCloneSetupRepository(pool).mutate(f.scope, current => confirmCloneSetup(f.scope, current, 2, f.requestId)),
    ]);
    expect(confirmations[0]).toEqual(confirmations[1]);
    await expect(f.repository.mutate(f.scope, current => confirmCloneSetup(f.scope, current, 2, createCanonicalId("request")))).rejects.toThrow();
  });
  it("binds completion to the exact canonical owner/CharacterVersion/Relationship", async () => {
    const f = await fixture(); await confirm(f);
    const other = await fixture(); const otherResult = await provision(other.scope);
    await expect(f.repository.mutate(f.scope, current => completeCloneSetup(f.scope, current, f.requestId, otherResult))).rejects.toThrow();
    expect((await f.repository.read(f.scope))?.state).toBe("confirmed");
    const result = await provision(f.scope);
    const ready = await f.repository.mutate(f.scope, current => completeCloneSetup(f.scope, current, f.requestId, result));
    expect(ready.state).toBe("ready");
    expect((await f.repository.read(f.scope))?.result).toEqual(result);
    expect((await provision(f.scope)).characterId).toBe(result.characterId);
  });
  it("rejects direct mutation/deletion of confirmed custody and direct unconfirmed completion", async () => {
    const f = await fixture(); await confirm(f);
    await expect(pool.query("UPDATE identity.clone_setups SET profile=jsonb_set(profile,'{displayName}','\"Forged\"'),revision=revision+1 WHERE tenant_id=$1 AND user_id=$2", [f.scope.tenantId, f.scope.userId])).rejects.toThrow();
    await expect(pool.query("DELETE FROM identity.clone_setups WHERE tenant_id=$1 AND user_id=$2", [f.scope.tenantId, f.scope.userId])).rejects.toThrow();
    expect((await f.repository.read(f.scope))?.profile.displayName).toBe("Nasir");
    const unconfirmed = await fixture(); const result = await provision(unconfirmed.scope);
    await expect(pool.query(`UPDATE identity.clone_setups SET state='ready',revision=revision+1,
      confirmation_request_id=$3,confirmation_preview_revision=1,result=$4::jsonb
      WHERE tenant_id=$1 AND user_id=$2`, [unconfirmed.scope.tenantId, unconfirmed.scope.userId, unconfirmed.requestId, JSON.stringify(result)])).rejects.toThrow();
    expect((await unconfirmed.repository.read(unconfirmed.scope))?.state).toBe("editing");
  });
  it("rolls back failed transitions and rejects forged scope from a repository callback", async () => {
    const f = await fixture();
    await expect(f.repository.mutate(f.scope, () => { throw new Error("injected failure"); })).rejects.toThrow();
    expect((await f.repository.read(f.scope))?.revision).toBe(1);
    await expect(f.repository.mutate(f.scope, current => ({ ...current!, userId: createCanonicalId("user"), revision: 2 }))).rejects.toThrow();
    expect((await f.repository.read(f.scope))?.revision).toBe(1);
  });
  it("rejects SQL NULL preview revisions and noncanonical confirmation identities", async () => {
    const f = await fixture();
    await f.repository.mutate(f.scope, current => previewCloneSetup(f.scope, current, 1));
    await expect(pool.query(`UPDATE identity.clone_setups SET state='confirmed',revision=revision+1,
      confirmation_request_id=$3,confirmation_preview_revision=NULL WHERE tenant_id=$1 AND user_id=$2`,
      [f.scope.tenantId, f.scope.userId, f.requestId])).rejects.toThrow();
    await expect(pool.query(`UPDATE identity.clone_setups SET state='confirmed',revision=revision+1,
      confirmation_request_id='not-a-request',confirmation_preview_revision=revision WHERE tenant_id=$1 AND user_id=$2`,
      [f.scope.tenantId, f.scope.userId])).rejects.toThrow();
    expect((await f.repository.read(f.scope))?.state).toBe("preview");
  });
});
