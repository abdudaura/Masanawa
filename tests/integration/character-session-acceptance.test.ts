import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import { createAuthorityContext, type AuthorityContext } from "@masanawa/security";
import { emptyCharacterSessionBindings, isCharacterSessionOpen, type CharacterSessionScope } from "@masanawa/agents";
import {
  createPostgresPool, runMigrations, characterSessionMigrationRoots, checkPostgresReadiness,
  createPostgresCharacterSessionRepository, createPostgresIdentityRepository,
  createPostgresSkillRepository, setPolicyRevision, revokeAuthorityContext, withTransaction,
} from "@masanawa/postgres";
import { skillVersion } from "../support/skill-version.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;
const maxDurationMs = 3_600_000;

describePostgres("CharacterSession PostgreSQL 18 acceptance", () => {
  const databaseName = `masanawa_sessions_${randomUUID().replaceAll("-", "")}`;
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let databaseUrl: string;
  let created = false;
  const repository = () => createPostgresCharacterSessionRepository(pool, { maxDurationMs });
  beforeAll(async () => {
    admin = createPostgresPool({ connectionString: connectionString!, applicationName: "sessions-acceptance-admin", max: 1 });
    const version = await admin.query<{ server_version_num: string }>("SHOW server_version_num");
    expect(Number(version.rows[0]!.server_version_num)).toBeGreaterThanOrEqual(180000);
    expect(Number(version.rows[0]!.server_version_num)).toBeLessThan(190000);
    await admin.query(`CREATE DATABASE ${databaseName} TEMPLATE template0`);
    created = true;
    const url = new URL(connectionString!); url.pathname = `/${databaseName}`; databaseUrl = url.toString();
    pool = createPostgresPool({ connectionString: databaseUrl, applicationName: "sessions-acceptance", max: 5 });
  });
  beforeEach(async () => {
    for (const schema of ["agents", "identity", "skills", "security", "events"]) await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await pool.query("DROP TABLE IF EXISTS public.masanawa_schema_migrations");
    await runMigrations(pool, characterSessionMigrationRoots());
  });
  afterAll(async () => {
    try {
      await pool?.end();
      if (created) {
        const deadline = Date.now() + 5000;
        for (;;) {
          const active = await admin.query<{ count: number }>(
            "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = $1", [databaseName]);
          if (active.rows[0]!.count === 0) break;
          if (Date.now() >= deadline) throw new Error("Session acceptance database connections did not close");
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        await admin.query(`DROP DATABASE ${databaseName}`);
      }
    } finally { await admin?.end(); }
  });

  async function fixture() {
    const scope: CharacterSessionScope = { tenantId: createCanonicalId("tenant"), userId: createCanonicalId("user"),
      characterId: createCanonicalId("character"), relationshipId: createCanonicalId("relationship") };
    const characterVersionId = createCanonicalId("character-version"), taskId = createCanonicalId("task"), workflowRunId = createCanonicalId("workflow-run");
    const constitution = { schemaVersion: 1, displayName: "Amina", biography: "", personality: [], boundaries: [],
      disclosurePolicy: {}, languages: ["ha"], voiceReferences: [], appearanceReferences: [], expertise: [] } as const;
    await withTransaction(pool, async client => {
      const identity = createPostgresIdentityRepository(client), at = toInstant(new Date());
      await identity.createTenant({ tenantId: scope.tenantId, createdAt: at });
      await identity.createUser({ tenantId: scope.tenantId, userId: scope.userId, createdAt: at });
      await identity.createCharacter({ tenantId: scope.tenantId, characterId: scope.characterId, createdAt: at });
      await identity.createCharacterVersion({ tenantId: scope.tenantId, characterId: scope.characterId, characterVersionId,
        versionNumber: 1, constitution, createdAt: at });
      await identity.publishCharacterVersion({ tenantId: scope.tenantId, characterVersionId, publishedAt: at });
      await identity.activateCharacterVersion({ tenantId: scope.tenantId, characterId: scope.characterId,
        characterVersionId, expectedCharacterRevision: 1, activatedAt: at });
      await identity.getOrCreateRelationship({ ...scope, createdAt: at });
      await setPolicyRevision(client, scope.tenantId, "policy-1");
    });
    const authority = createAuthorityContext({ tenantId: scope.tenantId, principal: { kind: "user", userId: scope.userId },
      capabilities: ["create", "read", "update", "close", "reset"].map(action => `agents.session.${action}`),
      scopes: [], resourceScope: { relationshipIds: [scope.relationshipId], taskIds: [taskId], workflowRunIds: [workflowRunId] },
      policyRevision: "policy-1", approvalIds: [], delegationChain: [],
      requestId: createCanonicalId("request"), correlationId: createCanonicalId("correlation") });
    const input = { scope, authority, characterSessionId: createCanonicalId("character-session"), characterVersionId,
      durationMs: maxDurationMs, bindings: { ...emptyCharacterSessionBindings, taskIds: [taskId], workflowRunIds: [workflowRunId] } };
    return { scope, authority, input, constitution, characterVersionId };
  }

  it("persists exact scoped identity, replays creation and rejects changed admissions and private access", async () => {
    const f = await fixture(), store = repository();
    const simultaneous = await Promise.all([store.create(f.input), store.create(f.input)]);
    const first = simultaneous[0]!;
    expect(simultaneous[1]).toEqual(first);
    expect(await store.create(f.input)).toEqual(first);
    expect(await store.read(f.input)).toEqual(first);
    await expect(store.create({ ...f.input, durationMs: 1000 })).rejects.toMatchObject({ code: "agents.session_conflict" });
    await expect(store.read({ ...f.input, scope: { ...f.scope, tenantId: createCanonicalId("tenant") } })).rejects.toMatchObject({ code: "agents.session_access_denied" });
    const other = await fixture();
    await expect(store.read({ ...other.input, characterSessionId: first.characterSessionId })).rejects.toMatchObject({ code: "agents.session_not_found" });
    await expect(store.read({ ...f.input, authority: { ...f.authority, principal: { kind: "user", userId: other.scope.userId } } })).rejects.toMatchObject({ code: "agents.session_access_denied" });
    await expect(store.read({ ...f.input, authority: { ...f.authority, principal: { kind: "service", serviceId: createCanonicalId("service") } } })).rejects.toMatchObject({ code: "agents.session_access_denied" });
    await expect(store.read({ ...f.input, scope: { ...f.scope, relationshipId: other.scope.relationshipId } })).rejects.toMatchObject({ code: "agents.session_access_denied" });
    const privateScope = { ...f.scope, userId: createCanonicalId("user"), relationshipId: createCanonicalId("relationship") };
    await withTransaction(pool, async client => {
      const identity = createPostgresIdentityRepository(client), at = toInstant(new Date());
      await identity.createUser({ tenantId: privateScope.tenantId, userId: privateScope.userId, createdAt: at });
      await identity.getOrCreateRelationship({ ...privateScope, createdAt: at });
    });
    const privateAuthority = createAuthorityContext({ ...f.authority,
      principal: { kind: "user", userId: privateScope.userId }, resourceScope: { relationshipIds: [privateScope.relationshipId] } });
    await expect(store.read({ ...f.input, scope: privateScope, authority: privateAuthority })).rejects.toMatchObject({ code: "agents.session_not_found" });
  });

  it("rejects mismatched relationships, draft versions and inactive identities at the owning read port", async () => {
    const f = await fixture(), store = repository(), other = await fixture();
    await expect(store.create({ ...f.input, scope: { ...f.scope, userId: other.scope.userId },
      authority: { ...f.authority, principal: { kind: "user", userId: other.scope.userId } } })).rejects.toMatchObject({ code: "identity.interaction_unavailable" });
    const draftId = createCanonicalId("character-version");
    await withTransaction(pool, client => createPostgresIdentityRepository(client).createCharacterVersion({
      tenantId: f.scope.tenantId, characterId: f.scope.characterId, characterVersionId: draftId,
      versionNumber: 2, constitution: f.constitution, createdAt: toInstant(new Date()) }));
    await expect(store.create({ ...f.input, characterVersionId: draftId })).rejects.toMatchObject({ code: "identity.interaction_unavailable" });
    const current = await store.create(f.input);
    await pool.query("UPDATE identity.relationships SET state = 'archived' WHERE relationship_id = $1", [f.scope.relationshipId]);
    await expect(store.read(f.input)).rejects.toMatchObject({ code: "identity.interaction_unavailable" });
    await expect(store.updateBindings({ ...f.input, expectedRevision: current.revision })).rejects.toMatchObject({ code: "identity.interaction_unavailable" });
    expect((await pool.query("SELECT revision FROM agents.character_sessions WHERE character_session_id = $1", [current.characterSessionId])).rows[0]?.revision).toBe("1");
    await pool.query("UPDATE identity.relationships SET state = 'active' WHERE relationship_id = $1", [f.scope.relationshipId]);
    for (const [table, column, id] of [["tenants", "tenant_id", f.scope.tenantId], ["users", "user_id", f.scope.userId], ["characters", "character_id", f.scope.characterId]] as const) {
      await pool.query(`UPDATE identity.${table} SET state = 'disabled' WHERE ${column} = $1`, [id]);
      await expect(store.read(f.input)).rejects.toMatchObject({ code: "identity.interaction_unavailable" });
      await pool.query(`UPDATE identity.${table} SET state = 'active' WHERE ${column} = $1`, [id]);
    }
  });

  it("replaces channel/presence bindings without changing continuity and admits only one stale writer", async () => {
    const f = await fixture(), store = repository(), first = await store.create(f.input);
    const one = { ...first.bindings, channelSessionId: createCanonicalId("channel-session"), presenceSessionId: createCanonicalId("presence-session") };
    const two = { ...first.bindings, channelSessionId: createCanonicalId("channel-session"), presenceSessionId: null };
    const results = await Promise.allSettled([
      store.updateBindings({ ...f.input, expectedRevision: 1, bindings: one }),
      store.updateBindings({ ...f.input, expectedRevision: 1, bindings: two }),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find(result => result.status === "rejected")).toMatchObject({ reason: { code: "agents.session_conflict" } });
    const current = await store.read(f.input);
    expect(current).toMatchObject({ characterSessionId: first.characterSessionId, relationshipId: first.relationshipId,
      characterVersionId: first.characterVersionId, revision: 2, createdAt: first.createdAt, expiresAt: first.expiresAt });
    expect(current.bindings.taskIds).toEqual(first.bindings.taskIds);
    await expect(store.updateBindings({ ...f.input, expectedRevision: 2,
      bindings: { ...current.bindings, taskIds: [createCanonicalId("task")] } })).rejects.toMatchObject({ code: "agents.session_access_denied" });
  });

  it("keeps exact version pins across restart, new publication and changing readiness", async () => {
    const f = await fixture(), skills = createPostgresSkillRepository(pool), original = skillVersion();
    await skills.registerBatch([original]);
    const first = await repository().create({ ...f.input, bindings: { ...f.input.bindings, skillVersionIds: [original.skillVersionId] } });
    const newer = skillVersion({ skillId: original.skillId, key: original.key, version: "2.0.0" });
    await skills.registerBatch([newer]);
    await skills.putReadiness({ readiness: { skillVersionId: original.skillVersionId, state: "blocked", advertised: false,
      reasonCode: "skill.disabled", checkedAt: toInstant(new Date()) }, expectedRevision: null });
    const newCharacterVersionId = createCanonicalId("character-version");
    await withTransaction(pool, async client => {
      const identity = createPostgresIdentityRepository(client), at = toInstant(new Date());
      await identity.createCharacterVersion({ tenantId: f.scope.tenantId, characterId: f.scope.characterId,
        characterVersionId: newCharacterVersionId, versionNumber: 2, constitution: f.constitution, createdAt: at });
      await identity.publishCharacterVersion({ tenantId: f.scope.tenantId, characterVersionId: newCharacterVersionId, publishedAt: at });
      await identity.activateCharacterVersion({ tenantId: f.scope.tenantId, characterId: f.scope.characterId,
        characterVersionId: newCharacterVersionId, expectedCharacterRevision: 2, activatedAt: at });
    });
    await pool.end();
    pool = createPostgresPool({ connectionString: databaseUrl, applicationName: "sessions-restarted", max: 5 });
    expect(await repository().read(f.input)).toEqual(first);
    expect(await repository().create({ ...f.input, bindings: first.bindings })).toEqual(first);
    const updated = await repository().updateBindings({ ...f.input, expectedRevision: 1,
      bindings: { ...first.bindings, skillVersionIds: [newer.skillVersionId] } });
    expect(updated.characterVersionId).toBe(f.characterVersionId);
    expect(updated.bindings.skillVersionIds).toEqual([newer.skillVersionId]);
    await expect(repository().updateBindings({ ...f.input, expectedRevision: 2,
      bindings: { ...first.bindings, skillVersionIds: [createCanonicalId("skill-version")] } })).rejects.toMatchObject({ code: "skill.reference_unavailable" });
    await pool.query("UPDATE identity.character_versions SET state = 'retired', retired_at = clock_timestamp() WHERE character_version_id = $1", [f.characterVersionId]);
    await expect(repository().updateBindings({ ...f.input, expectedRevision: 2 })).rejects.toMatchObject({ code: "identity.interaction_unavailable" });
    expect((await repository().read(f.input)).characterVersionId).toBe(f.characterVersionId);
  });

  it("resets atomically to a new session while preserving relationship state and task/workflow/skill references", async () => {
    const f = await fixture(), store = repository(), version = skillVersion();
    await createPostgresSkillRepository(pool).registerBatch([version]);
    const original = await store.create({ ...f.input, bindings: { ...f.input.bindings, channelSessionId: createCanonicalId("channel-session"),
      presenceSessionId: createCanonicalId("presence-session"), skillVersionIds: [version.skillVersionId] } });
    const before = await pool.query("SELECT * FROM identity.relationships WHERE relationship_id = $1", [f.scope.relationshipId]);
    const nextId = createCanonicalId("character-session");
    const reset = await store.reset({ ...f.input, expectedRevision: 1, successorSessionId: nextId });
    expect(reset.previous).toMatchObject({ state: "closed", revision: 2, closeReason: "reset", successorSessionId: nextId });
    expect(reset.current).toMatchObject({ ...f.scope, characterSessionId: nextId, state: "active", revision: 1,
      bindings: { ...original.bindings, channelSessionId: null, presenceSessionId: null } });
    expect(reset.current.createdAt).toBe(reset.previous.closedAt);
    expect((await pool.query("SELECT * FROM identity.relationships WHERE relationship_id = $1", [f.scope.relationshipId])).rows).toEqual(before.rows);
    await expect(store.updateBindings({ ...f.input, expectedRevision: 2 })).rejects.toMatchObject({ code: "agents.session_conflict" });
    await expect(store.reset({ ...f.input, expectedRevision: 1, successorSessionId: createCanonicalId("character-session") })).rejects.toMatchObject({ code: "agents.session_conflict" });
    expect(await store.read({ ...f.input, characterSessionId: nextId })).toEqual(reset.current);
  });

  it("rolls back closure if successor admission fails and serializes competing resets", async () => {
    const f = await fixture(), store = repository(), original = await store.create(f.input);
    const existing = await store.create({ ...f.input, characterSessionId: createCanonicalId("character-session") });
    await expect(store.reset({ ...f.input, expectedRevision: 1, successorSessionId: existing.characterSessionId })).rejects.toMatchObject({ code: "agents.session_conflict" });
    expect(await store.read(f.input)).toEqual(original);
    const results = await Promise.allSettled([1, 2].map(() => store.reset({ ...f.input, expectedRevision: 1, successorSessionId: createCanonicalId("character-session") })));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find(result => result.status === "rejected")).toMatchObject({ reason: { code: "agents.session_conflict" } });
    expect((await pool.query("SELECT count(*)::int AS count FROM agents.character_sessions")).rows[0]?.count).toBe(3);
  });

  it("treats expired continuity as history, rejects updates and permits explicit replacement without reopening", async () => {
    const f = await fixture(), store = repository();
    const original = await store.create({ ...f.input, durationMs: 10 });
    await pool.query("SELECT pg_sleep(0.025)");
    const expired = await store.read(f.input);
    expect(isCharacterSessionOpen(expired, toInstant(new Date()))).toBe(false);
    expect(expired).toEqual(original);
    await expect(store.updateBindings({ ...f.input, expectedRevision: 1 })).rejects.toMatchObject({ code: "agents.session_conflict" });
    const reset = await store.reset({ ...f.input, expectedRevision: 1, successorSessionId: createCanonicalId("character-session") });
    expect(reset.current.expiresAt > original.expiresAt).toBe(true);
    expect(isCharacterSessionOpen(reset.current, reset.current.createdAt)).toBe(true);
    const closed = await store.close({ ...f.input, characterSessionId: reset.current.characterSessionId, expectedRevision: 1 });
    expect(closed).toMatchObject({ state: "closed", closeReason: "ended", successorSessionId: null, revision: 2 });
    await expect(store.close({ ...f.input, characterSessionId: closed.characterSessionId, expectedRevision: 2 })).rejects.toMatchObject({ code: "agents.session_conflict" });
  });

  it("denies stale/revoked policy and revalidates authority after waiting on a policy lock", async () => {
    const f = await fixture(), store = repository();
    await store.create(f.input);
    await withTransaction(pool, client => revokeAuthorityContext(client, { tenantId: f.scope.tenantId,
      authorityContextId: f.authority.authorityContextId, reasonCode: "test.revoke" }));
    await expect(store.read(f.input)).rejects.toMatchObject({ code: "authority.revoked" });
    const fresh = createAuthorityContext(f.authority);
    const locker = await pool.connect();
    try {
      await locker.query("BEGIN");
      await locker.query("SELECT revision FROM security.policy_state WHERE tenant_id = $1 FOR UPDATE", [f.scope.tenantId]);
      const pending = store.updateBindings({ ...f.input, authority: fresh, expectedRevision: 1 }).then(
        value => ({ value }), error => ({ error: error as { code: string } }));
      const deadline = Date.now() + 5000;
      for (;;) {
        const waiting = await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%security.policy_state%'");
        if (waiting.rows.length > 0) break;
        if (Date.now() > deadline) throw new Error("Policy wait was not observed");
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      await setPolicyRevision(locker, f.scope.tenantId, "policy-2");
      await locker.query("COMMIT");
      expect(await pending).toMatchObject({ error: { code: "authority.stale_policy" } });
      expect((await pool.query("SELECT revision FROM agents.character_sessions")).rows[0]?.revision).toBe("1");
    } finally { await locker.query("ROLLBACK"); locker.release(); }
  });

  it("rechecks authority expiry after a blocked session mutation rather than trusting its earlier admission", async () => {
    const f = await fixture(), store = repository();
    await store.create(f.input);
    const locker = await pool.connect();
    try {
      await locker.query("BEGIN");
      await locker.query("SELECT 1 FROM agents.character_sessions WHERE character_session_id = $1 FOR UPDATE", [f.input.characterSessionId]);
      const expiresAt = toInstant(new Date(Date.now() + 1500));
      const authority: AuthorityContext = createAuthorityContext({ ...f.authority, expiresAt });
      const pending = store.updateBindings({ ...f.input, authority, expectedRevision: 1 }).then(
        value => ({ value }), error => ({ error: error as { code: string } }));
      const deadline = Date.now() + 5000;
      for (;;) {
        const waiting = await pool.query("SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE '%agents.character_sessions%'");
        if (waiting.rows.length > 0) break;
        if (Date.now() > deadline) throw new Error("Session wait was not observed");
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      await pool.query("SELECT pg_sleep($1)", [Math.max(0, (Date.parse(expiresAt) - Date.now()) / 1000) + 0.025]);
      await locker.query("COMMIT");
      expect(await pending).toMatchObject({ error: { code: "agents.session_access_denied" } });
      expect((await pool.query("SELECT revision FROM agents.character_sessions")).rows[0]?.revision).toBe("1");
    } finally { await locker.query("ROLLBACK"); locker.release(); }
  });

  it("enforces immutable binding/lifetime and terminal history in SQL and detects migration drift", async () => {
    const f = await fixture(), store = repository();
    await store.create(f.input);
    await expect(pool.query("UPDATE agents.character_sessions SET relationship_id = $1, revision = revision + 1", [createCanonicalId("relationship")])).rejects.toMatchObject({ code: "23514" });
    await expect(pool.query("UPDATE agents.character_sessions SET expires_at = expires_at + interval '1 hour', revision = revision + 1")).rejects.toMatchObject({ code: "23514" });
    await expect(pool.query("UPDATE agents.character_sessions SET bindings = '{}'::jsonb")).rejects.toMatchObject({ code: "23514" });
    await store.close({ ...f.input, expectedRevision: 1 });
    await expect(pool.query("UPDATE agents.character_sessions SET state = 'active', closed_at = NULL, close_reason = NULL, revision = revision + 1")).rejects.toMatchObject({ code: "23514" });
    await expect(pool.query("DELETE FROM agents.character_sessions")).rejects.toMatchObject({ code: "23514" });
    expect(await checkPostgresReadiness(pool, characterSessionMigrationRoots())).toEqual({ ready: true });
    await pool.query("UPDATE public.masanawa_schema_migrations SET sha256 = 'drift' WHERE owner = 'agents'");
    expect(await checkPostgresReadiness(pool, characterSessionMigrationRoots())).toEqual({ ready: false, reason: "schema-drift" });
  });
});
