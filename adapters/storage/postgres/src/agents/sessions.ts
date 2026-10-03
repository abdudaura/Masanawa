import { PlatformError, parseCanonicalId, toInstant, type Instant } from "@masanawa/contracts";
import {
  assertCharacterSessionAccess, assertCharacterSessionDuration, assertCharacterSessionRevision,
  emptyCharacterSessionBindings, isCharacterSessionOpen, normalizeCharacterSession,
  normalizeCharacterSessionBindings, normalizeCharacterSessionScope,
  type CharacterSession, type CharacterSessionAction, type CharacterSessionBindings,
  type CharacterSessionRepository, type CharacterSessionRequest, type CreateCharacterSessionInput,
  type ChangeCharacterSessionInput, type ResetCharacterSessionInput,
} from "@masanawa/agents";
import { assertInteractionIdentity } from "@masanawa/identity";
import { assertCurrentAuthority, createAuthorityContext, canonicalJson, fingerprintCanonicalJson } from "@masanawa/security";
import type { Pool, PoolClient } from "pg";
import { withTransaction } from "../transaction.js";
import { createPostgresCurrentAuthoritySource } from "../security/approvals.js";
import { createPostgresInteractionIdentityReader } from "../identity/interaction.js";
import { createPostgresSkillVersionReferenceReader } from "../skills/references.js";

interface SessionRow {
  tenant_id: CharacterSession["tenantId"]; character_session_id: CharacterSession["characterSessionId"];
  user_id: CharacterSession["userId"]; character_id: CharacterSession["characterId"];
  relationship_id: CharacterSession["relationshipId"]; character_version_id: CharacterSession["characterVersionId"];
  schema_version: 1; bindings: CharacterSessionBindings; admission_hash: string;
  state: CharacterSession["state"]; revision: string; created_at: Date; updated_at: Date;
  expires_at: Date; closed_at: Date | null; close_reason: CharacterSession["closeReason"];
  successor_session_id: CharacterSession["successorSessionId"];
}
function session(row: SessionRow): CharacterSession {
  return normalizeCharacterSession({ schemaVersion: row.schema_version,
    tenantId: row.tenant_id, characterSessionId: row.character_session_id, userId: row.user_id,
    characterId: row.character_id, relationshipId: row.relationship_id, characterVersionId: row.character_version_id,
    bindings: row.bindings, state: row.state, revision: Number(row.revision), createdAt: toInstant(row.created_at),
    updatedAt: toInstant(row.updated_at), expiresAt: toInstant(row.expires_at),
    closedAt: row.closed_at === null ? null : toInstant(row.closed_at), closeReason: row.close_reason,
    successorSessionId: row.successor_session_id });
}
function conflict(): PlatformError {
  return new PlatformError({ code: "agents.session_conflict", category: "conflict",
    message: "Session changed or cannot accept this transition", retryable: false });
}
function capture(input: CharacterSessionRequest): CharacterSessionRequest {
  // Copy admitted authority before any wait; preserve its revocation identity.
  const authority = Object.freeze({ ...createAuthorityContext(input.authority),
    authorityContextId: parseCanonicalId("authority-context", input.authority.authorityContextId),
    principal: Object.freeze({ ...input.authority.principal }) });
  return Object.freeze({ authority, scope: normalizeCharacterSessionScope(input.scope),
    characterSessionId: parseCanonicalId("character-session", input.characterSessionId) });
}
async function clock(client: PoolClient): Promise<Instant> {
  const result = await client.query<{ at: Date }>("SELECT clock_timestamp() AS at");
  return toInstant(result.rows[0]!.at);
}
async function admit(client: PoolClient, request: CharacterSessionRequest, action: CharacterSessionAction): Promise<void> {
  const at = await clock(client);
  assertCharacterSessionAccess(request.authority, request.scope, action, emptyCharacterSessionBindings, at);
  // Security's transaction-local policy share lock serializes policy changes and revocations.
  await assertCurrentAuthority(request.authority, createPostgresCurrentAuthoritySource(client), at);
}
async function identity(client: PoolClient, request: CharacterSessionRequest,
  characterVersionId: CharacterSession["characterVersionId"], active: boolean, published: boolean): Promise<void> {
  const key = { ...request.scope, characterVersionId };
  assertInteractionIdentity(key, await createPostgresInteractionIdentityReader(client).readInteraction(key),
    { requireActiveVersion: active, requirePublishedVersion: published });
}
async function find(client: PoolClient, request: CharacterSessionRequest, write: boolean): Promise<SessionRow | null> {
  const s = request.scope;
  const result = await client.query<SessionRow>(
    `SELECT * FROM agents.character_sessions WHERE tenant_id = $1 AND character_session_id = $2
       AND user_id = $3 AND character_id = $4 AND relationship_id = $5 ${write ? "FOR UPDATE" : "FOR SHARE"}`,
    [s.tenantId, request.characterSessionId, s.userId, s.characterId, s.relationshipId],
  );
  return result.rows[0] ?? null;
}
async function load(client: PoolClient, request: CharacterSessionRequest, write: boolean): Promise<SessionRow> {
  const row = await find(client, request, write);
  if (!row) throw new PlatformError({ code: "agents.session_not_found", category: "not-found",
    message: "Session was not found in the authorized relationship", retryable: false });
  return row;
}
function fingerprint(input: CreateCharacterSessionInput): string {
  return fingerprintCanonicalJson({ scope: input.scope, characterSessionId: input.characterSessionId,
    characterVersionId: input.characterVersionId, durationMs: input.durationMs, bindings: input.bindings });
}
async function insert(client: PoolClient, input: CreateCharacterSessionInput, at: Instant, replay: boolean): Promise<CharacterSession> {
  const s = input.scope, hash = fingerprint(input);
  const expiresAt = toInstant(new Date(Date.parse(at) + input.durationMs));
  const result = await client.query<SessionRow>(
    `INSERT INTO agents.character_sessions(tenant_id, character_session_id, user_id, character_id,
       relationship_id, character_version_id, bindings, admission_hash, created_at, updated_at, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$9,$10)
     ON CONFLICT (tenant_id, character_session_id) DO NOTHING RETURNING *`,
    [s.tenantId, input.characterSessionId, s.userId, s.characterId, s.relationshipId, input.characterVersionId,
      canonicalJson(input.bindings), hash, at, expiresAt],
  );
  if (result.rows[0]) return session(result.rows[0]);
  if (replay) {
    const row = await load(client, input, false);
    if (row.admission_hash === hash) return session(row);
  }
  throw conflict();
}
async function finish(client: PoolClient, request: ChangeCharacterSessionInput,
  action: "close" | "reset", at: Instant, successor: CharacterSession["successorSessionId"]): Promise<CharacterSession> {
  assertCharacterSessionAccess(request.authority, request.scope, action, emptyCharacterSessionBindings, at);
  const result = await client.query<SessionRow>(
    `UPDATE agents.character_sessions SET state = 'closed', revision = revision + 1,
       updated_at = $4, closed_at = $4, close_reason = $5, successor_session_id = $6
     WHERE tenant_id = $1 AND character_session_id = $2 AND revision = $3 AND state = 'active' RETURNING *`,
    [request.scope.tenantId, request.characterSessionId, request.expectedRevision, at,
      action === "reset" ? "reset" : "ended", successor],
  );
  if (!result.rows[0]) throw conflict();
  assertCharacterSessionAccess(request.authority, request.scope, action, emptyCharacterSessionBindings, await clock(client));
  return session(result.rows[0]);
}

/** Pool-scoped factory owns transaction admission, identity locks and Security revalidation. */
export function createPostgresCharacterSessionRepository(pool: Pool,
  options: { readonly maxDurationMs: number }): CharacterSessionRepository {
  const maxDurationMs = options.maxDurationMs;
  assertCharacterSessionDuration(1, maxDurationMs);
  return Object.freeze({
    async create(raw: CreateCharacterSessionInput) {
      const request = capture(raw), characterVersionId = parseCanonicalId("character-version", raw.characterVersionId);
      const durationMs = raw.durationMs, bindings = normalizeCharacterSessionBindings(raw.bindings);
      assertCharacterSessionDuration(durationMs, maxDurationMs);
      const input = { ...request, characterVersionId, durationMs, bindings };
      return withTransaction(pool, async client => {
        await admit(client, request, "create");
        const previous = await find(client, request, false);
        if (previous) {
          if (previous.admission_hash !== fingerprint(input)) throw conflict();
          // Replay reports current stored continuity; it never re-admits a stale authored version.
          await identity(client, request, previous.character_version_id, false, false);
          assertCharacterSessionAccess(request.authority, request.scope, "create", bindings, await clock(client));
          return session(previous);
        }
        await identity(client, request, characterVersionId, true, true);
        await createPostgresSkillVersionReferenceReader(client).assertVersionsExist(bindings.skillVersionIds);
        const at = await clock(client);
        assertCharacterSessionAccess(request.authority, request.scope, "create", bindings, at);
        const created = await insert(client, input, at, true);
        assertCharacterSessionAccess(request.authority, request.scope, "create", bindings, await clock(client));
        return created;
      });
    },
    async read(raw: CharacterSessionRequest) {
      const request = capture(raw);
      return withTransaction(pool, async client => {
        await admit(client, request, "read");
        const row = await load(client, request, false);
        await identity(client, request, row.character_version_id, false, false);
        assertCharacterSessionAccess(request.authority, request.scope, "read", emptyCharacterSessionBindings, await clock(client));
        return session(row);
      });
    },
    async updateBindings(raw: ChangeCharacterSessionInput & { readonly bindings: CharacterSessionBindings }) {
      const request = capture(raw), expectedRevision = raw.expectedRevision;
      assertCharacterSessionRevision(expectedRevision);
      const bindings = normalizeCharacterSessionBindings(raw.bindings);
      return withTransaction(pool, async client => {
        await admit(client, request, "update");
        const current = session(await load(client, request, true));
        await identity(client, request, current.characterVersionId, false, true);
        await createPostgresSkillVersionReferenceReader(client).assertVersionsExist(bindings.skillVersionIds);
        const at = await clock(client);
        assertCharacterSessionAccess(request.authority, request.scope, "update", bindings, at);
        if (current.revision !== expectedRevision || !isCharacterSessionOpen(current, at)) throw conflict();
        const result = await client.query<SessionRow>(
          `UPDATE agents.character_sessions SET bindings = $4::jsonb, revision = revision + 1, updated_at = $5
           WHERE tenant_id = $1 AND character_session_id = $2 AND revision = $3 AND state = 'active'
             AND expires_at > $5::timestamptz RETURNING *`,
          [request.scope.tenantId, request.characterSessionId, expectedRevision, canonicalJson(bindings), at],
        );
        if (!result.rows[0]) throw conflict();
        assertCharacterSessionAccess(request.authority, request.scope, "update", bindings, await clock(client));
        return session(result.rows[0]);
      });
    },
    async close(raw: ChangeCharacterSessionInput) {
      const request = { ...capture(raw), expectedRevision: raw.expectedRevision };
      assertCharacterSessionRevision(request.expectedRevision);
      return withTransaction(pool, async client => {
        await admit(client, request, "close");
        const row = await load(client, request, true);
        await identity(client, request, row.character_version_id, false, false);
        return finish(client, request, "close", await clock(client), null);
      });
    },
    async reset(raw: ResetCharacterSessionInput) {
      const request = { ...capture(raw), expectedRevision: raw.expectedRevision };
      assertCharacterSessionRevision(request.expectedRevision);
      const successorSessionId = parseCanonicalId("character-session", raw.successorSessionId);
      const characterVersionId = parseCanonicalId("character-version", raw.characterVersionId), durationMs = raw.durationMs;
      assertCharacterSessionDuration(durationMs, maxDurationMs);
      if (successorSessionId === request.characterSessionId) throw conflict();
      return withTransaction(pool, async client => {
        await admit(client, request, "reset");
        const old = session(await load(client, request, true));
        if (old.revision !== request.expectedRevision || old.state !== "active") throw conflict();
        await identity(client, request, characterVersionId, true, true);
        const bindings = normalizeCharacterSessionBindings({ ...old.bindings, channelSessionId: null, presenceSessionId: null });
        await createPostgresSkillVersionReferenceReader(client).assertVersionsExist(bindings.skillVersionIds);
        const at = await clock(client);
        assertCharacterSessionAccess(request.authority, request.scope, "reset", bindings, at);
        const previous = await finish(client, request, "reset", at, successorSessionId);
        const current = await insert(client, { ...request, characterSessionId: successorSessionId,
          characterVersionId, durationMs, bindings }, at, false);
        assertCharacterSessionAccess(request.authority, request.scope, "reset", bindings, await clock(client));
        return Object.freeze({ previous, current });
      });
    },
  });
}
