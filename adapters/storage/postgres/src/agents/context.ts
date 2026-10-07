import { PlatformError, parseCanonicalId, toInstant } from "@masanawa/contracts";
import {
  compileCharacterContext, normalizeAgentRun, normalizeCharacterSession,
  type CharacterContextCompiler,
} from "@masanawa/agents";
import { canonicalJson, createAuthorityContext, assertCurrentAuthority } from "@masanawa/security";
import type { Pool } from "pg";
import { withTransaction } from "../transaction.js";
import { createPostgresCharacterVersionReader } from "../identity/repository.js";
import { createPostgresCurrentAuthoritySource } from "../security/approvals.js";
import { readPostgresCharacterSessionForContext } from "./sessions.js";
import { readPostgresAgentRunForContext } from "./runs.js";
import { createPostgresRelationshipMemoryContextReader } from "../memory/context.js";
import { createPostgresPublicWorldContextReader } from "../world/repository.js";

/** Owner-backed Identity, private Relationship Memory and admitted public World evidence. */
export function createPostgresCharacterContextCompiler(pool: Pool): CharacterContextCompiler {
  return Object.freeze({
    async compile(raw: Parameters<CharacterContextCompiler["compile"]>[0]) {
      // Capture before the first wait, preserving the admitted revocation identity.
      const session = normalizeCharacterSession(raw.session), run = normalizeAgentRun(raw.run);
      if (raw.recallQuery !== undefined && (typeof raw.recallQuery !== "string" || raw.recallQuery.length > 2000)) {
        throw new RangeError("Character recall query exceeds its bound");
      }
      const recallQuery = raw.recallQuery?.trim();
      const authority = Object.freeze({ ...createAuthorityContext(raw.authority),
        authorityContextId: parseCanonicalId("authority-context", raw.authority.authorityContextId),
        principal: Object.freeze({ ...raw.authority.principal }),
        issuedAt: toInstant(raw.authority.issuedAt),
        ...(raw.authority.expiresAt ? { expiresAt: toInstant(raw.authority.expiresAt) } : {}) });
      const scope = { tenantId: session.tenantId, userId: session.userId,
        characterId: session.characterId, relationshipId: session.relationshipId };
      return withTransaction(pool, async client => {
        const currentSession = await readPostgresCharacterSessionForContext(client,
          { authority, scope, characterSessionId: session.characterSessionId });
        const currentRun = await readPostgresAgentRunForContext(client,
          { authority, scope, agentRunId: run.agentRunId });
        if (canonicalJson(currentSession) !== canonicalJson(session) || canonicalJson(currentRun) !== canonicalJson(run)) {
          throw new PlatformError({ code: "agents.context_snapshot_changed", category: "conflict",
            message: "Character interaction changed before context admission.", retryable: false });
        }
        const identity = await createPostgresCharacterVersionReader(client).readCharacterVersion({
          tenantId: session.tenantId, characterId: session.characterId, characterVersionId: session.characterVersionId,
        });
        if (!identity) throw new PlatformError({ code: "identity.interaction_unavailable", category: "authorization",
          message: "Identity does not admit this interaction", retryable: false });
        const clock = await client.query<{ at: Date }>("SELECT clock_timestamp() AS at");
        const at = toInstant(clock.rows[0]!.at);
        await assertCurrentAuthority(authority, createPostgresCurrentAuthoritySource(client), at);
        const memoryItems = recallQuery ? (await createPostgresRelationshipMemoryContextReader(client).readContext({
          authority, tenantId: session.tenantId, relationshipId: session.relationshipId, query: recallQuery, at,
        })).items : [];
        const worldIds = authority.resourceScope.worldIds ?? [];
        const worldEvents = worldIds.length ? await createPostgresPublicWorldContextReader(client).readEvents({
          authority, tenantId: session.tenantId, characterId: session.characterId,
          characterVersionId: session.characterVersionId, worldIds, at,
        }) : [];
        const finalClock = await client.query<{ at: Date }>("SELECT clock_timestamp() AS at");
        const finalAt = toInstant(finalClock.rows[0]!.at);
        await assertCurrentAuthority(authority, createPostgresCurrentAuthoritySource(client), finalAt);
        return compileCharacterContext({ authority, session: currentSession, run: currentRun, identity,
          at: finalAt, memoryItems, worldEvents, worldIds, maxCharacters: 32000, maxEvidenceItems: 16 });
      }, { isolation: "repeatable read" });
    },
  });
}

