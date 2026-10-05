import { PlatformError, parseCanonicalId, toInstant } from "@masanawa/contracts";
import {
  assertMemoryScopeAuthority, createMemoryScopePredicate, compileMemoryContext,
  fuseMemorySignalHits, memoryContextReadCapability,
  normalizeMemoryLexicalSearchInput,
  type RelationshipMemoryContextReader,
} from "@masanawa/memory";
import { assertCurrentAuthority, createAuthorityContext } from "@masanawa/security";
import type { PoolClient } from "pg";
import { createPostgresCurrentAuthoritySource } from "../security/approvals.js";
import { searchMemoryLexical } from "./projection.js";

/** Runs inside the caller's admission transaction, using Memory-owned retrieval. */
export function createPostgresRelationshipMemoryContextReader(client: PoolClient): RelationshipMemoryContextReader {
  return Object.freeze({
    async readContext(input: Parameters<RelationshipMemoryContextReader["readContext"]>[0]) {
      const tenantId = parseCanonicalId("tenant", input.tenantId), relationshipId = parseCanonicalId("relationship", input.relationshipId);
      const at = toInstant(input.at);
      const authority = Object.freeze({ ...createAuthorityContext(input.authority),
        authorityContextId: parseCanonicalId("authority-context", input.authority.authorityContextId),
        principal: Object.freeze({ ...input.authority.principal }), issuedAt: toInstant(input.authority.issuedAt),
        ...(input.authority.expiresAt ? { expiresAt: toInstant(input.authority.expiresAt) } : {}) });
      if (!authority.capabilities.includes(memoryContextReadCapability)) {
        throw new PlatformError({ code: "memory.context_capability_missing", category: "authorization",
          message: "Memory context read capability is required.", retryable: false });
      }
      const scope = Object.freeze({ kind: "relationship" as const, relationshipId });
      assertMemoryScopeAuthority(authority, tenantId, scope);
      const predicate = createMemoryScopePredicate([scope]);
      const retrieval = normalizeMemoryLexicalSearchInput({ tenantId, scopePredicate: predicate, query: input.query, limit: 20 });
      await assertCurrentAuthority(authority, createPostgresCurrentAuthoritySource(client), at);
      const hits = await searchMemoryLexical(client, retrieval);
      const fused = fuseMemorySignalHits({ tenantId, scopePredicate: predicate,
        signalResults: [{ signal: "lexical", hits }], limit: 12 });
      // Conservative character count, not a vendor tokenizer or run billing budget.
      return compileMemoryContext({ tenantId, scopePredicate: predicate,
        hits: fused, maxItems: 8, maxTokens: 8000 }, { count: text => text.length });
    },
  });
}

