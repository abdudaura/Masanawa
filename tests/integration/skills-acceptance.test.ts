import { randomUUID } from "node:crypto";
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createCanonicalId, normalizeCapabilityKey, toInstant, type SkillId, type SkillVersionId } from "@masanawa/contracts";
import { canonicalJson, fingerprintCanonicalJson, createAuthorityContext } from "@masanawa/security";
import { createProviderRegistry, ProviderExecutionError } from "@masanawa/providers";
import { createToolRegistry, executeConsequentialTool, type ConsequentialToolExecutionDependencies } from "@masanawa/tools";
import { restoreSkillRegistry, createSkillRevisionPin, resolveSkillRevisionPin, composeSkillExecutionPlan, bindSkillToolInvocation, type SkillVersion, type SkillReadiness } from "@masanawa/skills";
import { createPostgresPool, runMigrations, foundationMigrationRoots, checkPostgresReadiness, createPostgresToolOperationStore, createPostgresSkillRepository } from "@masanawa/postgres";

function skillVersion(
  options: {
    skillId?: SkillId;
    skillVersionId?: SkillVersionId;
    key?: string;
    version?: string;
    dependencies?: readonly SkillVersionId[];
    displayName?: string;
  } = {},
): SkillVersion {
  const skillVersionId =
    options.skillVersionId ?? createCanonicalId("skill-version");
  return {
    skillId: options.skillId ?? createCanonicalId("skill"),
    skillVersionId,
    key: options.key ?? "research.web",
    version: options.version ?? "1.0.0",
    displayName: options.displayName ?? "Web research",
    description: "Researches public sources through canonical Skills and Tools.",
    activationExamples: ["Research this topic"],
    negativeActivationExamples: ["Do not browse"],
    capabilities: [normalizeCapabilityKey("research.web")],
    requiredToolCapabilities: [],
    toolReferences: [],
    requiredAuthorityCapabilities: [],
    dependencies: options.dependencies ?? [],
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    visibility: "model-visible",
    riskClass: "read-only",
    sideEffectClass: "none",
    sensitivity: "public",
    costClass: "free",
    billingMode: "none",
    confirmationPolicy: "not-required",
    idempotencyMode: "not-required",
    reconciliationMode: "none",
    timeoutMs: 30_000,
    provenance: {
      sourceKind: "authored",
      sourceSystem: "masanawa",
      sourceReference: `skills/${options.key ?? "research.web"}`,
      sourceRevision: options.version ?? "1.0.0",
      sourceContentHash: `sha256:${"c".repeat(64)}`,
      publisher: {
        publisherKey: "masanawa",
        displayName: "Masanawa",
        kind: "first-party",
        reference: null,
      },
      trust: {
        tier: "first-party",
        evaluatorKey: "masanawa.skill-admission",
        evaluatedAt: toInstant("2026-10-02T00:00:00.000Z"),
        reasonCodes: ["publisher.first-party"],
      },
    },
    certification: {
      subjectSkillVersionId: skillVersionId,
      profile: "foundation",
      suiteKey: "skills.foundation",
      suiteRevision: "2026.10.03",
      suiteContentHash: `sha256:${"6".repeat(64)}`,
      certifiedAt: toInstant("2026-10-02T00:00:00.000Z"),
      certifierKey: "masanawa.foundation",
      cases: [
        {
          caseKey: "activation.basic",
          kind: "activation",
          outcome: "passed",
          observedAt: toInstant("2026-10-02T00:00:00.000Z"),
          evidenceRef: "rehearsal://foundation/activation.basic",
          evidenceHash: `sha256:${"1".repeat(64)}`,
        },
        {
          caseKey: "negative.basic",
          kind: "negative-activation",
          outcome: "passed",
          observedAt: toInstant("2026-10-02T00:00:00.000Z"),
          evidenceRef: "rehearsal://foundation/negative.basic",
          evidenceHash: `sha256:${"2".repeat(64)}`,
        },
      ],
      testCaseCount: 2,
      passedTestCaseCount: 2,
    },
  };
}

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
const describePostgres = connectionString ? describe : describe.skip;
const checkedAt = toInstant("2026-10-03T00:00:00.000Z");

function observation(version: SkillVersion, state: SkillReadiness["state"] = "ready"): SkillReadiness {
  return { skillVersionId: version.skillVersionId, state, advertised: state === "ready",
    reasonCode: state === "ready" ? null : `skill.${state}`, checkedAt };
}

describePostgres("Skills PostgreSQL 18 acceptance", () => {
  // Isolated database: parallel foundation suites cannot reset this catalog or
  // the canonical Tool operation ledger underneath restart/replay assertions.
  const databaseName = `masanawa_skills_${randomUUID().replaceAll("-", "")}`;
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let databaseUrl: string;
  let created = false;
  beforeAll(async () => {
    admin = createPostgresPool({ connectionString: connectionString!, applicationName: "skills-acceptance-admin", max: 1 });
    const result = await admin.query<{ server_version_num: string }>("SHOW server_version_num");
    expect(Number(result.rows[0]!.server_version_num)).toBeGreaterThanOrEqual(180000);
    expect(Number(result.rows[0]!.server_version_num)).toBeLessThan(190000);
    await admin.query(`CREATE DATABASE ${databaseName} TEMPLATE template0`);
    created = true;
    const url = new URL(connectionString!);
    url.pathname = `/${databaseName}`;
    databaseUrl = url.toString();
    pool = createPostgresPool({ connectionString: databaseUrl, applicationName: "skills-acceptance", max: 4 });
  });
  beforeEach(async () => {
    await pool.query("DROP SCHEMA IF EXISTS skills CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS security CASCADE");
    await pool.query("DROP SCHEMA IF EXISTS events CASCADE");
    await pool.query("DROP TABLE IF EXISTS public.masanawa_schema_migrations");
    await runMigrations(pool, foundationMigrationRoots());
  });
  afterAll(async () => {
    await pool?.end();
    if (created) await admin.query(`DROP DATABASE ${databaseName} WITH (FORCE)`);
    await admin?.end();
  });

  it("reconstructs identities, certification, exact dependencies and pins after reconnect", async () => {
    const repository = createPostgresSkillRepository(pool);
    const child = skillVersion({ key: "catalog.child" });
    const root = skillVersion({ key: "catalog.root", dependencies: [child.skillVersionId] });
    expect((await repository.registerBatch([root, child])).map(r => r.reused)).toEqual([false, false]);
    expect((await repository.registerBatch([child, root])).every(r => r.reused)).toBe(true);
    const emptyReadiness = restoreSkillRegistry(await repository.readSnapshot());
    expect(emptyReadiness.listAdvertised()).toEqual([]);
    expect(() => emptyReadiness.resolveExecutionPlan(root.skillVersionId)).toThrow();
    for (const version of [root, child]) await repository.putReadiness({ readiness: observation(version), expectedRevision: null });
    const before = await repository.readSnapshot();
    const pin = createSkillRevisionPin(restoreSkillRegistry(before), root.skillVersionId);
    const newer = skillVersion({ skillId: child.skillId, key: child.key, version: "2.0.0" });
    await repository.registerBatch([newer]);
    await pool.end();
    pool = createPostgresPool({ connectionString: databaseUrl, applicationName: "skills-restarted", max: 4 });
    const restarted = createPostgresSkillRepository(pool);
    const after = await restarted.readSnapshot();
    expect(after.skills).toEqual(before.skills);
    const registry = restoreSkillRegistry(after);
    expect(registry.getVersion(root.skillVersionId)?.certification).toEqual(root.certification);
    expect(resolveSkillRevisionPin(registry, pin).steps.map(step => step.skillVersionId)).toEqual([child.skillVersionId, root.skillVersionId]);
    expect(registry.getVersion(newer.skillVersionId)).not.toBeNull();
    await restarted.putReadiness({ readiness: observation(child, "blocked"), expectedRevision: 1 });
    const blocked = restoreSkillRegistry(await restarted.readSnapshot());
    expect(blocked.listAdvertised()).toEqual([]);
    expect(() => resolveSkillRevisionPin(blocked, pin)).toThrow();
  });

  it("rolls back invalid batches and refuses changed exact definitions or logical identities", async () => {
    const repository = createPostgresSkillRepository(pool);
    const original = skillVersion();
    await repository.registerBatch([original]);
    const fresh = skillVersion({ key: "catalog.fresh" });
    await expect(repository.registerBatch([fresh, { ...original, description: "Changed immutable content" }])).rejects.toMatchObject({ code: "skill.registration_version_conflict" });
    await expect(repository.registerBatch([skillVersion({ skillId: original.skillId, key: "catalog.other" })])).rejects.toMatchObject({ code: "skill.registration_skill_id_conflict" });
    await expect(repository.registerBatch([skillVersion({ key: original.key, version: "2.0.0" })])).rejects.toMatchObject({ code: "skill.registration_skill_key_conflict" });
    await expect(repository.registerBatch([fresh, skillVersion({ key: "catalog.missing", dependencies: [createCanonicalId("skill-version")] })])).rejects.toMatchObject({ code: "skill.dependency_missing" });
    const a = skillVersion({ key: "cycle.a" });
    const b = skillVersion({ key: "cycle.b", dependencies: [a.skillVersionId] });
    await expect(repository.registerBatch([{ ...a, dependencies: [b.skillVersionId] }, b])).rejects.toMatchObject({ code: "skill.dependency_cycle" });
    expect((await repository.readSnapshot()).versions).toHaveLength(1);
  });

  it("serializes conflicting admissions and compare-and-swap readiness writers", async () => {
    const repository = createPostgresSkillRepository(pool);
    const version = skillVersion();
    const competing = skillVersion({ key: version.key });
    const results = await Promise.allSettled([repository.registerBatch([version]), repository.registerBatch([competing])]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    const winner = (await repository.readSnapshot()).versions[0]!;
    await repository.putReadiness({ readiness: observation(winner), expectedRevision: null });
    const updates = await Promise.allSettled([
      repository.putReadiness({ readiness: observation(winner, "blocked"), expectedRevision: 1 }),
      repository.putReadiness({ readiness: observation(winner, "disabled"), expectedRevision: 1 }),
    ]);
    expect(updates.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(updates.find(r => r.status === "rejected")).toMatchObject({ reason: { code: "skill.readiness_revision_conflict" } });
    const current = (await repository.readSnapshot()).readiness[0]!;
    expect(current.revision).toBe(2);
    await expect(repository.putReadiness({ readiness: { ...observation(winner), checkedAt: toInstant("2026-10-02T00:00:00Z") }, expectedRevision: 2 })).rejects.toMatchObject({ code: "skill.readiness_stale" });
    await expect(repository.putReadiness({ readiness: observation(winner), expectedRevision: null })).rejects.toMatchObject({ code: "skill.readiness_revision_conflict" });
  });

  it("enforces immutable versions, missing dependencies, readiness identity and hidden visibility in SQL", async () => {
    const repository = createPostgresSkillRepository(pool);
    const version = { ...skillVersion(), visibility: "model-hidden" as const };
    await repository.registerBatch([version]);
    await expect(pool.query("UPDATE skills.versions SET version = '2.0.0' WHERE skill_version_id = $1", [version.skillVersionId])).rejects.toMatchObject({ code: "23514" });
    await expect(pool.query("DELETE FROM skills.versions WHERE skill_version_id = $1", [version.skillVersionId])).rejects.toMatchObject({ code: "23514" });
    await expect(repository.putReadiness({ readiness: observation(version), expectedRevision: null })).rejects.toMatchObject({ code: "skill.hidden_cannot_advertise" });
    await expect(pool.query("INSERT INTO skills.readiness VALUES ($1, 'ready', true, NULL, $2, 1)", [version.skillVersionId, checkedAt])).rejects.toMatchObject({ code: "23514" });
    await repository.putReadiness({ readiness: { ...observation(version), advertised: false }, expectedRevision: null });
    await expect(pool.query("UPDATE skills.readiness SET state = 'disabled' WHERE skill_version_id = $1", [version.skillVersionId])).rejects.toMatchObject({ code: "23514" });
    await expect(pool.query("DELETE FROM skills.readiness WHERE skill_version_id = $1", [version.skillVersionId])).rejects.toMatchObject({ code: "23514" });
    const broken = { ...version, skillVersionId: createCanonicalId("skill-version"), version: "2.0.0", dependencies: [createCanonicalId("skill-version")] };
    await expect(pool.query(`INSERT INTO skills.versions VALUES ($1, $2, $3, $4, $5::jsonb, $6)`, [broken.skillVersionId, broken.skillId, broken.key, broken.version, canonicalJson(broken), fingerprintCanonicalJson(broken)])).rejects.toMatchObject({ code: "23514" });
    expect((await repository.readSnapshot()).versions).toHaveLength(1);
  });

  it("fails closed on stored content tampering and exposes Skills migration drift to readiness", async () => {
    const repository = createPostgresSkillRepository(pool);
    const version = skillVersion();
    await repository.registerBatch([version]);
    expect(await checkPostgresReadiness(pool)).toEqual({ ready: true });
    await pool.query("UPDATE public.masanawa_schema_migrations SET sha256 = 'drift' WHERE owner = 'skills'");
    expect(await checkPostgresReadiness(pool)).toEqual({ ready: false, reason: "schema-drift" });
    // A privileged maintenance mistake is detected when rebuilding the projection.
    await pool.query("ALTER TABLE skills.versions DISABLE TRIGGER versions_immutable");
    await pool.query("UPDATE skills.versions SET definition = jsonb_set(definition, '{description}', '\"Tampered content\"')");
    await pool.query("ALTER TABLE skills.versions ENABLE TRIGGER versions_immutable");
    await expect(repository.readSnapshot()).rejects.toMatchObject({ code: "skill.snapshot_definition_invalid" });
  });

  it("rejects direct SQL cyclic and over-depth batches at transaction commit", async () => {
    const repository = createPostgresSkillRepository(pool);
    const original = skillVersion();
    await repository.registerBatch([original]);
    const aId = createCanonicalId("skill-version"), bId = createCanonicalId("skill-version");
    const a = { ...original, skillVersionId: aId, version: "2.0.0", dependencies: [bId] };
    const b = { ...original, skillVersionId: bId, version: "2.0.1", dependencies: [aId] };
    async function insertRawBatch(versions: readonly SkillVersion[]) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const version of versions) await client.query(
          "INSERT INTO skills.versions VALUES ($1, $2, $3, $4, $5::jsonb, $6)",
          [version.skillVersionId, version.skillId, version.key, version.version, canonicalJson(version), fingerprintCanonicalJson(version)],
        );
        await client.query("COMMIT");
      } finally {
        await client.query("ROLLBACK");
        client.release();
      }
    }
    await expect(insertRawBatch([a, b])).rejects.toMatchObject({ code: "23514" });
    const ids = Array.from({ length: 17 }, () => createCanonicalId("skill-version"));
    const deep = ids.map((id, index) => ({ ...original, skillVersionId: id, version: `3.0.${index}`, dependencies: index === 16 ? [] : [ids[index + 1]!] }));
    await expect(insertRawBatch(deep)).rejects.toMatchObject({ code: "23514" });
    expect((await repository.readSnapshot()).versions).toHaveLength(1);
  });

  async function executionFixture() {
    const capability = normalizeCapabilityKey("messages.send");
    const tools = createToolRegistry();
    tools.registerCapability({ key: capability, description: "Send a message through a Provider." });
    const toolVersionId = createCanonicalId("tool-version");
    tools.registerTool({ toolId: createCanonicalId("tool"), toolVersionId, key: "messages.send", version: "1.0.0", displayName: "Send message", description: "Send one external message", capabilities: [capability], inputSchema: { type: "object" }, outputSchema: { type: "object" }, requiredAuthorityCapabilities: [capability], riskClass: "consequential", sideEffectClass: "external-consequential", sensitivity: "private", timeoutMs: 30000, rateLimit: null, costClass: "free", idempotencyMode: "operation-bound", reconciliationMode: "on-unknown", providerRequirement: { capability } });
    const providers = createProviderRegistry();
    const cloud = createCanonicalId("provider"), device = createCanonicalId("provider");
    for (const [providerId, key, selectionPriority] of [[cloud, "cloud-messages", 1], [device, "simulated-device-messages", 2]] as const) {
      providers.register({ providerId, key, version: "1.0.0", displayName: key, capabilities: [capability], selectionPriority, credentialSlots: [] });
      providers.setReadiness({ providerId, state: "ready", reasonCode: null, checkedAt });
    }
    const authority = createAuthorityContext({ tenantId: createCanonicalId("tenant"), principal: { kind: "system", systemKind: "skills-acceptance" }, scopes: [], capabilities: [capability], resourceScope: {}, policyRevision: "policy-1", approvalIds: [], delegationChain: [], requestId: createCanonicalId("request"), correlationId: createCanonicalId("correlation") });
    const version: SkillVersion = { ...skillVersion({ key: "messages.send" }), capabilities: [capability], requiredToolCapabilities: [capability], toolReferences: [{ referenceKey: "send", capability, toolVersionId }], requiredAuthorityCapabilities: [capability], riskClass: "consequential", sideEffectClass: "external-consequential", sensitivity: "private", idempotencyMode: "operation-bound", reconciliationMode: "on-unknown" };
    const repository = createPostgresSkillRepository(pool);
    await repository.registerBatch([version]);
    await repository.putReadiness({ readiness: observation(version), expectedRevision: null });
    const plan = composeSkillExecutionPlan(restoreSkillRegistry(await repository.readSnapshot()), version.skillVersionId);
    const invocation = (idempotencyKey: string, context = authority) => bindSkillToolInvocation(plan, tools, { stepOrdinal: 0, referenceKey: "send", authority: context, input: { message: "Acceptance rehearsal" }, idempotencyKey });
    const operations = createPostgresToolOperationStore(pool);
    return { capability, tools, providers, cloud, device, authority, version, plan, invocation, operations };
  }

  it("uses one restored Skill and Tool for cloud and simulated Device Providers with durable replay", async () => {
    const f = await executionFixture();
    const dispatched: string[] = [];
    const dependencies: ConsequentialToolExecutionDependencies = { tools: f.tools, providers: f.providers, operations: f.operations, authoritySource: { getPolicyRevision: () => "policy-1" }, resolveAdapter: (_tool, provider) => ({ async dispatch(context) {
      const key = provider!.provider.key;
      dispatched.push(key);
      expect(context.invocation.authority).toEqual(f.authority);
      return { status: "succeeded", output: { messageId: "message-1" }, receipt: { observationKey: `observed-${key}`, providerReference: `${key}-message-1`, normalizedStatus: "succeeded", payloadHash: null, payloadRef: null, observedAt: checkedAt, verificationMethod: "acceptance-simulated-response" } };
    } }) };
    const invoke = (key: string) => ({ invocation: f.invocation(key), credentialBindings: {}, idempotencyExpiresAt: toInstant("2099-01-01T00:00:00Z") });
    expect(f.invocation("cloud-1").providerSelection).toBeNull();
    const cloud = await executeConsequentialTool(dependencies, invoke("cloud-1"));
    f.providers.setReadiness({ providerId: f.cloud, state: "unavailable", reasonCode: "provider.offline", checkedAt });
    const device = await executeConsequentialTool(dependencies, invoke("device-1"));
    const replay = await executeConsequentialTool({ ...dependencies, operations: createPostgresToolOperationStore(pool) }, invoke("device-1"));
    expect([cloud.operation.state, device.operation.state, replay.operation.state]).toEqual(["succeeded", "succeeded", "succeeded"]);
    expect(dispatched).toEqual(["cloud-messages", "simulated-device-messages"]);
    expect(replay).toMatchObject({ reused: true, dispatched: false });
    expect(replay.receipts).toEqual(device.receipts);
    expect((await createPostgresSkillRepository(pool).readSnapshot()).versions[0]?.toolReferences).toEqual(f.version.toolReferences);
    f.providers.setReadiness({ providerId: f.device, state: "unavailable", reasonCode: "device.offline", checkedAt });
    await expect(executeConsequentialTool(dependencies, invoke("offline-1"))).rejects.toMatchObject({ code: "provider.capability_unavailable" });
    expect((await pool.query("SELECT count(*)::int AS count FROM events.operations")).rows[0]?.count).toBe(2);
    expect(dispatched).toHaveLength(2);
  });

  it("denies missing or stale authority before side effects", async () => {
    const f = await executionFixture();
    let dispatched = 0;
    const dependencies: ConsequentialToolExecutionDependencies = { tools: f.tools, providers: f.providers, operations: f.operations, authoritySource: { getPolicyRevision: () => "policy-new" }, resolveAdapter: () => ({ async dispatch() { dispatched++; return { status: "not-dispatched", errorCode: "unexpected" }; } }) };
    const input = { invocation: f.invocation("stale-authority"), credentialBindings: {}, idempotencyExpiresAt: toInstant("2099-01-01T00:00:00Z") };
    await expect(executeConsequentialTool(dependencies, input)).rejects.toMatchObject({ category: "authorization" });
    const denied = createAuthorityContext({ ...f.authority, capabilities: [] });
    await expect(executeConsequentialTool(dependencies, { ...input, invocation: f.invocation("missing-authority", denied) })).rejects.toMatchObject({ code: "tool.authority_capability_missing" });
    expect(dispatched).toBe(0);
  });

  it("reconciles ambiguous device dispatch after restart without retrying or switching its external effect", async () => {
    const f = await executionFixture();
    f.providers.setReadiness({ providerId: f.cloud, state: "unavailable", reasonCode: "provider.offline", checkedAt });
    let dispatches = 0;
    const dependencies: ConsequentialToolExecutionDependencies = { tools: f.tools, providers: f.providers, operations: f.operations, authoritySource: { getPolicyRevision: () => "policy-1" }, resolveAdapter: () => ({ async dispatch() {
      dispatches++;
      throw new ProviderExecutionError({ kind: "transport", code: "device-disconnected", phase: "post-dispatch", dispatchCertainty: "unknown", retryable: true, timeoutMs: null, retryAfterMs: null });
    } }) };
    const input = { invocation: f.invocation("ambiguous-device"), credentialBindings: {}, idempotencyExpiresAt: toInstant("2099-01-01T00:00:00Z") };
    const first = await executeConsequentialTool(dependencies, input);
    expect(first.operation.state).toBe("reconciling");
    const replay = await executeConsequentialTool({ ...dependencies, operations: createPostgresToolOperationStore(pool) }, input);
    expect(replay).toMatchObject({ reused: true, dispatched: false, operation: { operationId: first.operation.operationId, state: "reconciling" } });
    const cases = await pool.query("SELECT safe_retry FROM events.reconciliation_cases WHERE operation_id = $1", [first.operation.operationId]);
    expect(cases.rows).toEqual([{ safe_retry: false }]);
    f.providers.setReadiness({ providerId: f.cloud, state: "ready", reasonCode: null, checkedAt });
    await expect(executeConsequentialTool(dependencies, input)).rejects.toThrow();
    expect(dispatches).toBe(1);
    expect(await f.operations.load(f.authority.tenantId, first.operation.operationId)).toMatchObject({ state: "reconciling" });
  });
});
