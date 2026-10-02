# @masanawa/memory — canonical memory authority

Status: Phase 4 implementation active.

This package is the **only canonical Masanawa memory boundary**.

Implemented in the first Phase 4 slice:
- explicit MemoryScope variants for relationship, character-private,
  character-shared, world, session, task and organization memory;
- canonical MemoryRecord plus append-only MemoryRevision;
- immutable provenance evidence with optional verbatim source text;
- memory type/lifecycle contracts;
- exact-scope repository reads rather than unscoped record lookup;
- PostgreSQL canonical persistence;
- immutable record type/scope identity at the database layer;
- immutable revisions/evidence;
- atomic expected-revision append and exact replay handling;
- independent lifecycle CAS revision;
- immutable same-scope supersedes/absorbs lineage;
- governed private/bounded → Character-shared/World/Organization publication;
- publication through current AuthorityContext, exact Operation binding and consumed
  one-time Approval;
- immutable publication audit that references private source IDs without widening or
  rewriting the source scope.

Still to implement behind this same boundary:
- expiration/tombstone lifecycle commands and physical-purge governance;
- extraction queues, retry/dead-letter and idempotent candidate admission;
- projection generations for vector/lexical/entity/temporal retrieval;
- embedding identity/dimension/source-hash compatibility metadata;
- authorization-aware hybrid retrieval/reranking;
- bounded working-context compilation;
- reflection/consolidation/promotion;
- retention/expiration/tombstone/purge propagation;
- evaluation and rebuild fixtures.

PostgreSQL remains canonical. Vector/search/graph stores are projections only.

MemPalace, Letta, Mem0, N.E.K.O and OpenClaw are behavioral/algorithm donors; none
owns Masanawa memory state or privacy scope.

See:
- `docs/adr/0007-memory-architecture-adoption-boundary.md`
- `docs/migration/MEMORY-ADOPTION-BOUNDARY.md`
- `docs/migration/POST-FREEZE-MEMPALACE-PAPERCLIP.md`
- `docs/SOURCE-OWNERSHIP.md`
