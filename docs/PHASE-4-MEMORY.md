# Phase 4 — Memory

Status: ACTIVE  
Started: 2026-10-02  
Active branch: `phase4-memory-candidate-assessment`

Phase 3 non-spatial Identity/World acceptance is closed by PR #28, merge
`02c2c99153e904b4f9d2f403328a1e3b6effc3f1`. Optional spatial simulation remains
a separately gated World slice and does not block canonical Memory work.

## Canonical ownership

`packages/memory` is the sole canonical memory authority.

PostgreSQL owns durable MemoryRecord/MemoryRevision/evidence state. Semantic, lexical,
entity, temporal, vector and graph structures are rebuildable projections and can never
broaden canonical authorization.

Relationship-private memory cannot become Character-shared, World or Organization
truth through retrieval relevance or model confidence.

## Post-freeze candidate assessment

`docs/migration/POST-FREEZE-MEMPALACE-PAPERCLIP.md` records the requested review.

Decision:
- MemPalace is a strong Phase 4 behavior donor for verbatim evidence preservation,
  backend isolation/compatibility discipline, hybrid retrieval and evaluation;
- it is **not** a canonical store/runtime dependency;
- Paperclip is a strong later workflows/agents/Ops behavior donor for atomic checkout,
  heartbeat execution and operator visibility;
- it is not a Phase 4 dependency and must not replace Masanawa security/approval,
  Tenant/Character identity or workflow truth.

## First canonical slice — implemented, awaiting full CI

Implemented:
- real `@masanawa/memory` TypeScript package and production build wiring;
- MemoryType and lifecycle contracts from ADR-0007;
- explicit MemoryScope union:
  - relationship;
  - character-private;
  - character-shared;
  - world;
  - session;
  - task;
  - organization;
- canonical MemoryRecord plus append-only MemoryRevision;
- every revision requires provenance evidence;
- optional verbatim evidence preserves original source text exactly instead of
  normalizing it into extracted memory;
- exact-scope direct reads; there is intentionally no unscoped
  `getMemoryRecord(tenant, id)` repository method;
- authorized-scope list primitive that queries only explicitly supplied scopes;
- PostgreSQL `memory.records`, `memory.revisions`, and `memory.evidence`;
- record identity/type/scope immutability;
- revision/evidence update immutability;
- atomic revision append under expected revision;
- exact revision replay returns the already-committed result;
- stale changed replay fails with `memory.revision_conflict`;
- PostgreSQL integration fixture proves Relationship A memory is absent when queried
  by exact ID or list under Relationship B;
- PostgreSQL fixture proves raw SQL cannot silently rewrite scope or revision content.

## MemPalace-derived improvements deliberately included

The first slice incorporates only behaviors that strengthen the canonical architecture:
1. verbatim evidence can coexist with normalized/extracted memory, preventing
   extraction from destroying the source context;
2. retrieval APIs are shaped for strict partition filtering rather than global search
   followed by model filtering;
3. upcoming projection work must record embedding identity/dimension/source revision
   and fail closed/rebuild on incompatible vector spaces;
4. upcoming retrieval adapters require cross-scope conformance tests;
5. benchmark metrics will distinguish retrieval recall from end-to-end answer quality.

No Palace/Wing/Room/Drawer concept is canonical.

## Immediate acceptance work

1. open a PR and run the complete Foundation CI gate on PostgreSQL 18;
2. fix every real type/test/build/migration failure;
3. after green CI, close any first-slice audit gaps;
4. merge the slice;
5. continue Phase 4 with governed correction/supersession/lifecycle plus extraction
   queue/idempotency/dead-letter before adding retrieval projections;
6. then implement projection compatibility metadata and authorized lexical/vector/
   entity/temporal retrieval with rebuild/evaluation fixtures.

## Phase 4 acceptance targets

Before Phase 4 closes, repository evidence must prove:
- cross-user/cross-relationship leakage returns zero records;
- scope authorization precedes every retrieval path;
- private→shared/world/organization promotion requires explicit governed evidence;
- correction/supersession preserves prior evidence and current-view semantics;
- extraction retries are idempotent;
- poison inputs dead-letter without blocking later memory;
- index deletion/rebuild reproduces the same authorized result set;
- explicit deletion/tombstone propagates to searchable projections;
- compaction flush cannot widen scope;
- temporal/entity/contradiction retrieval has held-out fixtures;
- context compiler respects budget and maps every rendered item to provenance;
- embedding model/dimension changes cannot silently mix incompatible projections.
