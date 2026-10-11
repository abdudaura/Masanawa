import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createCanonicalId, nowInstant, toInstant } from "@masanawa/contracts";
import { createAuthorityContext } from "@masanawa/security";
import { emptyCharacterSessionBindings, type CharacterSessionScope } from "@masanawa/agents";
import { createPostgresPool, createPostgresMobileShellRepository } from "@masanawa/postgres";
import { createAgentConversationService } from "./agent_conversation.js";

const connectionString = process.env.MASANAWA_TEST_DATABASE_URL;
describe.skipIf(!connectionString)("durable PostgreSQL agent receipt recovery", () => {
  const databaseName = `masanawa_receipts_${randomUUID().replaceAll("-", "")}`;
  let admin: ReturnType<typeof createPostgresPool>;
  let pool: ReturnType<typeof createPostgresPool>;
  let created = false;
  beforeAll(async () => {
    admin = createPostgresPool({ connectionString: connectionString!, applicationName: "receipt-test-admin", max: 1 });
    const version = await admin.query("SHOW server_version_num");
    expect(Number(version.rows[0].server_version_num)).toBeGreaterThanOrEqual(180000);
    await admin.query(`CREATE DATABASE ${databaseName} TEMPLATE template0`);
    created = true;
    const url = new URL(connectionString!); url.pathname = `/${databaseName}`;
    pool = createPostgresPool({ connectionString: url.toString(), applicationName: "receipt-test", max: 4 });
    await pool.query(await readFile(new URL("../../../packages/agents/migrations/0006_mobile_shell.sql", import.meta.url), "utf8"));
  });
  afterAll(async () => {
    await pool?.end();
    try { if (created) await admin.query(`DROP DATABASE ${databaseName}`); }
    finally { await admin?.end(); }
  });

  function fixture() {
    const scope: CharacterSessionScope = {
      tenantId: createCanonicalId("tenant"), userId: createCanonicalId("user"),
      characterId: createCanonicalId("character"), relationshipId: createCanonicalId("relationship"),
    };
    const sessionId = createCanonicalId("character-session");
    const characterVersionId = createCanonicalId("character-version");
    const at = nowInstant();
    const authority = createAuthorityContext({
      tenantId: scope.tenantId, principal: { kind: "user", userId: scope.userId },
      scopes: [], capabilities: ["agents.session.read", "agents.run.create", "agents.run.finish"],
      resourceScope: { relationshipIds: [scope.relationshipId] },
      policyRevision: "receipt-test", approvalIds: [], delegationChain: [],
      requestId: createCanonicalId("request"), correlationId: createCanonicalId("correlation"), issuedAt: at,
    });
    const session = {
      schemaVersion: 1 as const, ...scope, characterSessionId: sessionId, characterVersionId,
      bindings: emptyCharacterSessionBindings, state: "active" as const, revision: 1,
      createdAt: at, updatedAt: at, expiresAt: toInstant(new Date(Date.now() + 60_000)),
      closedAt: null, closeReason: null, successorSessionId: null,
    };
    const request = { authorizationHeader: "Bearer local-test", characterId: scope.characterId,
      characterSessionId: sessionId, requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"), text: "A durable local test" };
    function service(execute: () => Promise<{ reply: string; parts: readonly unknown[] }>) {
      return createAgentConversationService({
        sessions: {
          async create() { return session; }, async read() { return session; },
          async updateBindings() { throw new Error("unused"); }, async close() { return session; },
          async reset() { throw new Error("unused"); },
        },
        runs: { async create() { return {} as never; }, async read() { throw new Error("unused"); }, async finish() { return {} as never; } },
        authorizer: { async authorize() { return { scope, characterVersionId, authority,
          bindings: emptyCharacterSessionBindings, presentation: { displayName: "Test", roleLabel: "Test", about: "" } }; } },
        strategy: { execute }, mobileShell: createPostgresMobileShellRepository(pool),
        sessionDurationMs: 60_000, onTurnTiming() {},
      });
    }
    return { scope, request, service };
  }

  it("acceptance is readable from another connection before inference, then survives service reconstruction", async () => {
    const f = fixture();
    let release!: () => void;
    let started = false;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const receipts: unknown[] = [];
    const first = f.service(async () => { started = true; await gate; return { reply: "Durable result", parts: [] }; });
    const pending = first.turn({ ...f.request, onAccepted(receipt) { receipts.push(receipt); } });
    try {
      await vi.waitFor(() => expect(started).toBe(true));
      expect(receipts).toEqual([{ requestId: f.request.requestId, state: "pending" }]);
      const independent = createPostgresMobileShellRepository(pool);
      expect(await independent.readTurn({ scope: f.scope, requestId: f.request.requestId }))
        .toMatchObject({ state: "pending", reply: null });
      await expect(first.turn(f.request)).rejects.toMatchObject({ code: "agents.turn_pending" });
    } finally { release(); }
    await pending;
    const reconstructed = f.service(async () => { throw new Error("must not repeat execution"); });
    expect(await reconstructed.turn(f.request)).toMatchObject({ reply: "Durable result" });
    const history = await createPostgresMobileShellRepository(pool).listHistory({ scope: f.scope, limit: 10 });
    expect(history.map(message => message.key)).toEqual([`user:${f.request.requestId}`, `assistant:${f.request.requestId}`]);
    expect(history[0]).not.toHaveProperty("replyToKey");
    expect(history[1]).toMatchObject({ replyToKey: `user:${f.request.requestId}` });
  });

  it("a reused request key cannot expose another account or conversation", async () => {
    const f = fixture();
    await f.service(async () => ({ reply: "Private reply", parts: [] })).turn(f.request);
    const repository = createPostgresMobileShellRepository(pool);
    for (const scope of [
      { ...f.scope, userId: createCanonicalId("user") },
      { ...f.scope, relationshipId: createCanonicalId("relationship") },
      { ...f.scope, characterId: createCanonicalId("character") },
    ]) {
      expect(await repository.readTurn({ scope, requestId: f.request.requestId })).toBeNull();
      expect(await repository.listHistory({ scope, limit: 10 })).toEqual([]);
      await expect(repository.claimTurn({ scope, characterSessionId: f.request.characterSessionId,
        requestId: f.request.requestId, kind: "text", userText: f.request.text, payloadHash: "a".repeat(64) }))
        .rejects.toThrow("mobile turn request conflict");
    }
  });
});
