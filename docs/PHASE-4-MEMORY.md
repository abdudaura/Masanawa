# Phase 4 — Memory

Status: ACTIVE  
Started: 2026-10-02  
Active branch: `phase4-memory-acceptance-closure`

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

## Third canonical slice — implementation gate passed

Goal: idempotent asynchronous extraction custody with bounded retry, durable leases,
attempt history, poison-input dead-letter and forward progress.

Implemented:
- canonical `memory-extraction` identity and typed extraction custody contracts;
- normalized scope/source/extractor inputs with SHA-256 source evidence;
- queue state stores source kind/reference/hash, never raw source text;
- semantic idempotency fingerprint binds tenant, key, scope, source, extractor and
  retry policy while operational `availableAt` remains outside request identity;
- PostgreSQL `memory.extraction_jobs` and immutable/auditable attempt history;
- database-enforced queue state machine, terminal immutability and monotonic
  attempt/fence progression;
- `FOR UPDATE SKIP LOCKED` claims with durable worker leases and fences;
- claim renewal uses PostgreSQL clock, not worker process clock;
- expired lease recovery records `lease-expired`, requeues bounded work and
  dead-letters the final expired attempt;
- retryable failures requeue only below `maxAttempts`;
- permanent/repeated failures dead-letter with bounded safe error codes only;
- settled attempts are immutable while active attempts may only renew lease or settle;
- stale workers cannot settle a reclaimed job;
- poison-input PostgreSQL fixture proves a dead-lettered extraction does not block
  healthy or later eligible jobs;
- idempotent enqueue fixture proves harmless schedule drift reuses the original
  admitted job while changed source evidence conflicts;
- the canonical MemoryScope storage codec is shared by records and extraction custody,
  eliminating duplicate privacy-sensitive scope decoding logic.

Validation evidence:
- Foundation CI run 271 passed frozen install, strict TypeScript, unit tests,
  PostgreSQL 18 migrations/recovery/concurrency fixtures and production builds on
  implementation head `2a423ac1480b9c094b602e0d0e846bf882ff1992`;
- final documentation head `a4a9872763b94aa4b9473c5ca19c1d8b72c82559` passed
  Foundation CI run 273;
- PR #31 merged as `f0f516b9ebf10ee40d3e27474e98085efaf8b913`.

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

## Fourth canonical slice — implementation gate passed

Goal: rebuildable projection generations plus authorization-first lexical retrieval.

Implemented:
- canonical projection-generation contracts for lexical/vector/entity/temporal signals;
- immutable generation compatibility identity plus building/current/retired lifecycle;
- vector compatibility metadata binds provider key, model key and dimension before any
  vector signal is enabled;
- non-empty explicit authorized MemoryScope predicates with adapter capability
  fail-closed checks;
- PostgreSQL lexical projections bound to exact canonical record/revision/type/scope,
  canonical document text and a deterministic source-content hash;
- database trigger rejects projection rows whose text/type/scope/revision diverges from
  current active canonical memory;
- generation activation refuses incomplete or stale builds and atomically retires the
  previous current generation;
- PostgreSQL lexical search applies exact authorized scopes before ranking, reads only
  the current generation, revalidates canonical current revision/lifecycle/scope and
  excludes expired revisions;
- stale projections stop returning results immediately after canonical revision drift;
- rebuild fixture proves a replacement generation reproduces the same authorized
  Relationship result set before the old retired generation is deleted;
- conformance fixture proves identical query text in two Relationship scopes never
  crosses the explicit authorization predicate;
- direct SQL forged projection text is rejected by PostgreSQL;
- future vector-generation compatibility can be persisted, but vector activation/search
  remains deliberately unsupported until its own tested slice.

Validation evidence:
- PR #32 implementation head `a3d4c1edf7df7e485381ac431ba867833f3a7383`
  passed Foundation CI run 275;
- the complete `check` job passed frozen install, strict TypeScript, unit tests,
  PostgreSQL 18 migrations/integration fixtures and production builds;
- final documentation/status head `608e7c86ea36d0a524cb434f5732f90206702406` passed Foundation CI run 279;
- PR #32 merged as `a0b8092d78e6e87647020b729fe2e02b27e455cf`.

Rules:
- canonical MemoryRecord/MemoryRevision remains the only retrieval truth;
- every projection row points to an exact canonical revision and source-content hash;
- every query supplies explicit authorized MemoryScopes before any retrieval signal is
  evaluated;
- an adapter that cannot enforce the requested scope predicate fails closed;
- lexical retrieval is implemented first in PostgreSQL and serves as the baseline
  retrieval signal;
- vector compatibility metadata includes provider/model identity, dimension and
  generation; incompatible vector spaces can never be mixed;
- projection generations are immutable once sealed and can be rebuilt/superseded
  without changing canonical memory identity;
- stale/superseded/expired/tombstoned canonical records are excluded from ordinary
  retrieval even if a stale projection row exists;
- deletion of a projection and rebuild from canonical records must reproduce the same
  authorized lexical result set.

After this slice:
1. add vector/entity/temporal signals behind the same projection/generation and scope
   contract;
2. add multi-signal fusion/reranking and held-out evaluation;
3. then bounded context compilation/reflection/consolidation/deletion propagation.

## Fifth canonical slice — implementation gate passed

Goal: authorization-first vector/entity/temporal retrieval behind the same rebuildable
projection contract, followed by deterministic multi-signal fusion and held-out
evaluation.

Implemented:
- PostgreSQL 18 CI now uses pinned `pgvector/pgvector:0.8.6-pg18`;
- vector/entity/temporal projection tables remain disposable and bind exact tenant,
  generation, MemoryRecord, MemoryRevision, memory type, MemoryScope and source-content
  hash;
- vector rows additionally enforce non-zero vectors and generation-bound
  provider/model/dimension compatibility before indexing and query ranking;
- entity rows normalize/deduplicate/sort bounded entity keys and use GIN-backed overlap
  lookup;
- temporal rows preserve canonical event/observed/validity/expiry fields and expose a
  deterministic temporal anchor;
- all signal projection rows are immutable and can only enter a matching building
  generation from a current active canonical revision;
- generation completeness/activation now works uniformly across lexical, vector,
  entity and temporal projections;
- vector/entity/temporal queries apply explicit authorized MemoryScopes before signal
  ranking and revalidate canonical current revision/lifecycle/type/scope/expiry;
- incompatible vector provider/model/dimension queries fail before distance ranking;
- stale projections stop returning results immediately after a canonical revision
  change even before rebuild;
- reciprocal-rank fusion independently rechecks tenant/scope and rejects conflicting
  canonical revisions for the same MemoryRecord;
- hybrid retrieval executes selected lexical/vector/entity/temporal signals inside one
  read-only REPEATABLE READ transaction;
- held-out evaluation reports recall, precision and MRR separately from forbidden-record
  leakage and exposes a hard zero-leakage assertion;
- PostgreSQL fixtures prove Relationship A/B non-disclosure independently across vector,
  entity, temporal and fused hybrid retrieval, wrong vector dimensions are rejected,
  model mismatch fails closed and stale revisions vanish from all signals.

Validation evidence:
- implementation/fusion head `c938e23e576c98a8eb0efd61fea10e91c0fcd737`
  passed Foundation CI run 293;
- the complete `check` job passed frozen install, strict TypeScript, unit tests,
  PostgreSQL 18 + pgvector migrations/integration fixtures and production builds;
- PR #33 has no review threads or comments;
- final documentation head `0b61670a5a9512ff4532c270619a45604019aeb3` passed Foundation CI run 294;
- PR #33 merged as `69ed518df450415ae30fc66a800e2ee674da4cee`.

Rules:
- no signal may query outside the caller's explicit authorized MemoryScope predicate;
- vector query compatibility must exactly match the current vector generation's
  provider/model/dimension contract before any distance calculation;
- entity/temporal projections are derived indexes tied to exact canonical
  MemoryRecord/MemoryRevision/source-content hash;
- current canonical lifecycle/revision/scope/expiry is revalidated at query time, so
  stale projection rows cannot resurrect old truth;
- each signal must pass cross-Relationship non-disclosure fixtures independently before
  fusion is allowed;
- fusion may improve ranking but can never broaden authorization or compensate for a
  failed privacy check;
- held-out evaluation reports leakage independently from retrieval-quality metrics.

After this slice:
1. implement explicit tombstone/deletion propagation and prove searchable projections
   stop surfacing deleted canonical memory;
2. implement bounded context compilation with token/item budgets and provenance mapping;
3. then reflection/consolidation with scope-preserving evidence and compaction-flush
   rules.

## Sixth canonical slice — implementation gate passed

Goal: explicit tombstone/deletion propagation plus bounded provenance-preserving context
compilation.

Implemented:
- canonical `memory.record.tombstone` consequential action with exact tenant/scope
  authority, request fingerprint, Operation binding and one-time Approval binding;
- tombstone prepare/execute rechecks current AuthorityContext and locks the exact
  MemoryRecord before current revision/lifecycle validation;
- execution rejects a record whose revision or lifecycle changed after preparation
  before approval consumption, leaving the approval reusable for a newly prepared
  request;
- PostgreSQL `memory.record_tombstones` stores immutable operation/authority/approval/
  policy/principal/revision/lifecycle/reason/time evidence;
- database triggers require a matching tombstone audit for lifecycle transition, require
  exact lifecycle +1, reject orphan tombstone audit commits and prevent reactivation;
- stale/unapproved raw lifecycle mutation cannot silently tombstone a record;
- all lexical/vector/entity/temporal/hybrid retrieval stops surfacing a tombstoned
  record immediately even while its old projection rows remain;
- projection cleanup is an explicit tombstone-only reconciliation step that deletes
  lexical/vector/entity/temporal rows but preserves canonical MemoryRecord,
  MemoryRevision, evidence and verbatim source text;
- exact replay of a succeeded tombstone reuses the canonical audit/state instead of
  consuming approval again;
- shared MemoryScope authority checks preserve established publication-specific error
  semantics while avoiding duplicate privacy-sensitive authorization logic;
- pure context compiler rechecks tenant/scope, deterministically orders by fused score
  and MemoryRecord ID, rejects conflicting duplicate canonical revisions and retains
  record/revision/type/scope/content-hash provenance per rendered item;
- item and token budgets are explicit; one oversized memory is skipped without blocking
  later eligible memories;
- the canonical PostgreSQL hybrid→context path performs retrieval and compilation inside
  one read-only REPEATABLE READ snapshot so normal callers do not compile an arbitrary
  stale result list;
- integration coverage proves context includes exact record/revision provenance before
  tombstone and excludes the record immediately after tombstone, before projection
  cleanup;
- stale prepared tombstone coverage proves revision drift blocks execution, preserves
  active lifecycle and does not consume the approved one-time authorization.

Validation evidence:
- hardened implementation head `7994de231a27f510cff09ad2db8fe3b71cc307b4`
  passed Foundation CI run 305;
- the complete `check` job passed frozen install, strict TypeScript, all unit tests,
  PostgreSQL 18 + pgvector migrations/integration fixtures and production builds;
- PR #34 has no review threads or comments;
- final documentation head `dad3f5fe36a3fcda5c036e21035c26458e3446c9` passed Foundation CI run 306;
- PR #34 merged as `09cb24218720040cc8e7ccbe59896c5380272b0e`.

Rules:
- tombstone is a canonical lifecycle transition, not physical purge;
- lifecycle mutation uses compare-and-set and immutable audit evidence;
- canonical revisions/evidence remain intact after tombstone until a separately governed
  purge exists;
- all retrieval signals must exclude tombstoned records immediately even when stale
  projection rows remain;
- projection cleanup is reconciliation/space recovery, not the privacy enforcement
  boundary;
- context compilation consumes only already-authorized current retrieval results;
- every compiled item retains MemoryRecord/MemoryRevision/scope provenance;
- item/token budgets are deterministic and cannot be bypassed by one oversized memory;
- compilation cannot promote private memory into a broader scope.

After this slice:
1. implement evidence-backed, retry-idempotent reflection/consolidation candidates in the
   same MemoryScope;
2. preserve exact source MemoryRecord/MemoryRevision provenance through reflection and
   absorption;
3. implement compaction-flush admission so context/session loss cannot occur before
   durable scoped memory work is admitted;
4. prove reflection/consolidation/flush retries cannot widen scope or duplicate durable
   memories.

## Seventh canonical slice — implementation gate passed

Goal: evidence-backed retry-idempotent reflection/consolidation plus safe compaction
flush admission.

Implemented:
- deterministic reflection identity binds tenant, exact MemoryScope, purpose, reflector
  key/version and a sorted set of exact source MemoryRecord/MemoryRevision/content hashes;
- generated reflection wording and caller-supplied target IDs are deliberately outside
  retry identity, so model phrasing drift cannot create duplicate durable reflections;
- current source snapshots can be converted into immutable replay descriptors only while
  active and current;
- reflection output is persisted as an ordinary canonical MemoryRecord of type
  `reflection` with generated provenance tied to the reflection fingerprint;
- PostgreSQL `memory.reflections` and `memory.reflection_sources` are immutable
  derivation/audit tables bound to the canonical reflection record/revision;
- first commit locks the exact sorted source set, revalidates current revision/content
  hash and exact scope, then atomically creates the reflection record plus derivation
  audit;
- competing first commits serialize on source records and recheck the derivation audit,
  preventing duplicate target records;
- exact retries reuse the already-committed reflection before current-source validation,
  so later source supersession/absorption does not invalidate immutable historical
  provenance;
- cross-Relationship first commit fails closed and source revision drift fails before
  any reflection record/audit persists;
- reflection→reflection consolidation uses the existing same-scope/type `absorbs`
  lineage transition, preserving both source reflection revision/evidence and immutable
  derivation audit;
- reflection header/source audit rows reject update/delete mutation;
- compaction flush admission is a thin wrapper over existing durable extraction custody,
  preserving the same idempotency fingerprint, retry, lease and fence semantics;
- `safeToCompact: true` is returned only after the PostgreSQL transaction that admitted
  or reused exact-scope extraction custody has committed;
- a repeated flush with harmless scheduling drift reuses the same extraction job, while
  scope drift under the same flush key conflicts instead of widening authorization;
- invalid source hashes fail before admission, so failed flush preparation never grants
  permission to discard context.

Validation evidence:
- hardened implementation head `4b21258b6d3ea37d296157468952c2d9be8c22d2`
  passed Foundation CI run 309;
- the complete `check` job passed frozen install, strict TypeScript, all unit tests,
  PostgreSQL 18 + pgvector migrations/integration fixtures and production builds;
- PR #35 has no review threads or comments;
- final documentation head `aeec21641f6881e32f4aa62b5d3069f8ab15948b` passed Foundation CI run 311;
- PR #35 merged as `5ff2cc4f3b79d725d898ecfe0e92a3600f510a88`.

Rules:
- reflection is a canonical MemoryRecord of type `reflection`, not a second storage
  layer;
- reflection identity is bound to exact source MemoryRecord/MemoryRevision evidence,
  purpose and reflector identity so retry cannot create duplicate durable memory;
- every reflection source must share the exact output MemoryScope; cross-scope
  reflection fails closed and broader publication still requires the existing governed
  scope-publication action;
- reflection provenance remains queryable even after source lifecycle later changes;
- consolidation/absorption uses existing canonical lifecycle lineage and never deletes
  source revisions/evidence;
- compaction flush reuses durable extraction custody and never invents a parallel
  cognition queue;
- compaction may proceed only after exact-scope durable memory work is successfully
  admitted/reused;
- retry/recovery cannot widen scope or silently change source evidence.

After this slice:
1. perform the Phase 4 acceptance closure audit against every canonical target and donor
   boundary;
2. close any remaining contradiction/temporal held-out or compaction acceptance gaps
   found by that audit;
3. if all targets are evidenced, close Phase 4 rather than inventing additional memory
   features.

## Phase 4 closure audit — implementation gate passed

Primary closure record: `docs/PHASE-4-MEMORY-ACCEPTANCE.md`.

The audit found one evidence gap rather than an architecture gap: entity and temporal
retrieval were already held-out evaluated, and lifecycle supersession was already
tested, but the acceptance wording required a dedicated held-out contradiction/current
view fixture.

Implemented closure proof:
- two contradictory same-scope preference records are indexed while both are active;
- canonical `supersedes` transitions the predecessor without deleting its revision or
  verbatim evidence;
- entity, temporal and fused hybrid retrieval each return only the corrected active
  record even though stale predecessor projection rows remain;
- each result is evaluated as a held-out set with the predecessor explicitly forbidden;
- recall, precision and MRR are all 1 and forbidden leakage is zero;
- implementation/acceptance head `d48b17ff9c4bcb91d51d88bf78da7a1e6c9f597a`
  passed Foundation CI run 313;
- PR #36 has no review threads or comments.

Every Phase 4 acceptance target now has repository evidence. Final closure documentation
must pass the same gate before merge; no new Memory subsystem is authorized by this
audit.

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
