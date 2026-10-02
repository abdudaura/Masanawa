# Phase 4 — Memory

Status: ACTIVE  
Started: 2026-10-02  
Active branch: `phase4-memory-extraction-liveness`

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

## First canonical slice — implementation gate passed

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

Validation evidence:
- Foundation CI run 250 passed the complete `check` step on implementation head
  `fd8e20bf7d589393d017338af89502fa4ca3ae6b`;
- frozen install, strict typecheck, unit tests, PostgreSQL 18 integration tests and
  production builds all passed;
- final documentation head `08d7685048ee27145937dbe204b4a8ea6deae09e` passed
  Foundation CI run 251;
- PR #29 merged as `f99c42157401728a5ca3b4f91d5732382f57c865`.

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

## Second canonical slice — implementation gate passed

Goal: governed correction/supersession/lifecycle and explicit scope publication.

Implemented:
- independent `lifecycleRevision` CAS so lifecycle mutation does not corrupt the
  current immutable MemoryRevision pointer;
- `memory.record_links` for immutable same-scope/type `supersedes` / `absorbs`
  lineage;
- atomic deterministic row locking for source/target lineage transitions;
- exact replay of an already-committed lineage operation is idempotent;
- stale lifecycle writers lose;
- cross-scope and cross-memory-type lineage is rejected in repository code and by
  PostgreSQL trigger invariants;
- old source revisions/evidence remain intact and retrievable under the original
  authorized scope after supersession;
- `memory.scope_publications` immutable audit;
- publication source restricted to Relationship, Character-private, Session or Task;
- publication target restricted to Character-shared, World or Organization;
- explicit `memory.scope.publish` capability plus exact source/target resource scope;
- prepare/execute publication uses current authority, idempotent Operation binding,
  exact one-time Approval consumption and transactionally creates the target record;
- publication never mutates source scope/lifecycle and never copies private verbatim
  source text into its audit row;
- callers cannot inject target evidence during cross-scope publication; the target
  revision gets generated provenance bound to the governed publication Operation and
  contains no private verbatim text;
- execution locks the exact source MemoryRecord before current-revision/lifecycle
  validation, fencing concurrent correction or supersession;
- a succeeded publication remains replayable after the private source is later
  superseded, without consuming approval or executing the mutation again;
- unit governance tests and PostgreSQL lifecycle/publication fixtures.

Validation evidence:
- Foundation CI run 261 passed the complete frozen-install, strict TypeScript, unit,
  PostgreSQL 18 integration and production-build gate on hardened implementation head
  `f5777a0d32fdc57b84d8fd415bb4ddb5de57a972`;
- final documentation head `061ab25d85b5100120c73d1442984cff8cf922e8`
  passed Foundation CI run 262;
- PR #30 merged as `b3cc9e75fe32ded30dc51dc2b116a38b454b46a9`.

Rules:
- correction inside the same semantic MemoryRecord appends a new immutable revision;
- contradiction/replacement across records creates explicit lineage and transitions the
  predecessor to `superseded` or `absorbed`;
- lifecycle transitions are compare-and-set and preserve prior revision/evidence;
- scope never mutates in place;
- publication from Relationship/Character-private/Session/Task into Character-shared,
  World or Organization creates a new target MemoryRecord plus immutable publication
  evidence;
- publication requires explicit current authority/resource scope and, when policy
  demands it, a bound approval at the service/security boundary;
- the private source remains private and is referenced only by canonical IDs in the
  publication audit row, never copied wholesale into a public/shared event.

## Third canonical slice — active

Goal: idempotent asynchronous extraction custody with bounded retry, durable leases,
attempt history, poison-input dead-letter and forward progress.

Rules:
- foreground/source persistence is independent of extraction success;
- enqueue stores only canonical scope + source reference/hash, never raw source text;
- idempotency keys bind to an exact normalized extraction request;
- claims use durable leases + monotonically increasing fences;
- expired leases are recoverable and stale workers cannot settle newer work;
- retryable failures are bounded by `maxAttempts`;
- a final expired or failed attempt dead-letters deterministically;
- permanent failures may dead-letter immediately with a safe error code;
- dead-lettered work is terminal and cannot stall later eligible extraction jobs;
- every attempt remains auditable without storing raw provider/model errors.

After this slice:
1. implement projection compatibility metadata and authorized lexical/vector/entity/
   temporal retrieval with rebuild/evaluation fixtures;
2. then bounded context compilation/reflection/consolidation/deletion propagation.

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
