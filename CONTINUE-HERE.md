# Continue Here

This is the mandatory handoff entry point for every new Masanawa implementation session.

## Mission

Build Masanawa as one clean canonical platform from the strongest validated capabilities
found across the reference vault and explicitly assessed post-freeze candidates.

Do not recreate donor project boundaries. The repository is the source of truth.

## Mandatory read order

1. `README.md`
2. `docs/VISION.md`
3. `docs/ARCHITECTURE.md`
4. `docs/TECHNOLOGY.md`
5. `docs/SOURCE-OWNERSHIP.md`
6. `docs/REWRITE-PLAN.md`
7. `docs/migration/LANDSCAPE-EXPANSION.md`
8. `docs/migration/SOURCE-LOCK.md`
9. `references/README.md`
10. `references/SOURCES.md`
11. `docs/migration/FORENSICS-METHOD.md`
12. `docs/migration/FEATURE-LEDGER.md`
13. `docs/migration/BEHAVIOUR-LEDGER.md`
14. `docs/migration/DATA-LEDGER.md`
15. `docs/migration/INTEGRATION-LEDGER.md`
16. relevant files under `docs/migration/sources/`
17. the active phase implementation record named below.

`docs/migration/LICENSE-LEDGER.md` is compliance/provenance metadata and is **not** part
of architectural feature selection.

## Current phase

**Phase 5 — Tools and Providers.**

Current implementation branch: `phase5-tool-receipts-replay`.

Phase 0A/0B, Phase 1 and Phase 2 are closed.

The non-spatial Phase 3 Identity/World boundary is closed:
- PR #28 merged as `02c2c99153e904b4f9d2f403328a1e3b6effc3f1`;
- implementation head `b56039533bdb4e45a2b27a19621d160394f3b56c` passed Foundation CI run 245;
- final closure/documentation head `46dffb5d7eb8950ba3de0da9f8d6aab2862e2fa0` passed Foundation CI run 246;
- `docs/PHASE-3-NONSPATIAL-CLOSURE-AUDIT.md` is PASS.

Optional WorldSpace/location/pathing is deferred behind
`WorldPolicy.spatialEnabled`. Do not reopen canonical Identity/World ownership merely
because spatial mechanics remain optional.

## Phase 3 merged history

- canonical identity: PR #17, merge `75549800445842f8ff1db54e06529c075ed34ea4`;
- world generation/input foundation: PR #18, merge `871022d03f4b3fb2a81af5c6253dd38bd5b7a27f`;
- governed CharacterLifeState + canon events: PR #19, merge `729ab3e64eb0539ea249ceb6a39cf79afab20cb2`;
- canon policy/time hardening: PR #21, merge `ce89ce091e05508dd4d0614a9127a2256bda13e4`;
- reconciled routines/story arcs: PR #23, merge `4bd9a3a8b2504617291d7e18e992d5f56856886d`;
- authority-bound WorldEvent governance: PR #24, merge `9f2574b9d3932079a834c5c2976ee89e2fdcf2cc`;
- WorldInteraction evidence: PR #25, merge `ed186608248659654cdcf23ab8b793dd426fa7ef`;
- pause/restart/catch-up recovery: PR #26, merge `bcfe597bd8aa7cb6191bb34fb5c626bbe5884ee0`;
- World evidence→events/outbox: PR #27, merge `426a6689f0839aad3077754a9f947f2abe0ba8d6`;
- non-spatial privacy/acceptance closure: PR #28, merge `02c2c99153e904b4f9d2f403328a1e3b6effc3f1`.

## Post-freeze candidate review — completed

Requested candidates:
- `mempalace/mempalace`, inspected at
  `5ea40d30caf0ed2ff6e49623e386a0863b28edaa`;
- `paperclipai/paperclip`, refreshed against current `master` at
  `c83df091b1a5207375eaf23466bb5c62e4e1518e`.

Evidence and decision:
`docs/migration/POST-FREEZE-MEMPALACE-PAPERCLIP.md`.

Decision:
- MemPalace is a strong Phase 4 behavior donor for verbatim evidence retention,
  retrieval isolation/compatibility, hybrid retrieval and evaluation;
- it does **not** become a canonical store, Python runtime dependency, Chroma/SQLite
  authority or second memory service;
- Paperclip is a strong later workflows/agents/Ops behavior donor for atomic task
  checkout, stale-run adoption, heartbeat execution, cost/run visibility and
  operator control;
- Paperclip Company/Agent/Issue/Approval state does **not** replace Tenant/Character,
  canonical workflows or Masanawa Authority/Approval/Operation semantics;
- neither candidate is currently admitted as a pinned source-vault submodule.

## Phase 4 first slice — implementation gate passed

Primary record: `docs/PHASE-4-MEMORY.md`.

Implemented on the current branch:
- real `@masanawa/memory` package;
- explicit relationship / character-private / character-shared / world / session /
  task / organization scopes;
- canonical MemoryRecord and append-only MemoryRevision;
- mandatory immutable provenance evidence;
- optional verbatim evidence preserving exact source text;
- exact-scope direct read API; there is no unscoped record-by-ID retrieval port;
- explicit allowed-scope list query;
- PostgreSQL `memory.records`, `memory.revisions`, `memory.evidence`;
- immutable record type/scope identity;
- immutable revision/evidence content;
- atomic expected-revision append;
- exact replay idempotency and stale changed replay conflict;
- workspace/build/lockfile/PostgreSQL adapter wiring;
- unit tests for scope/evidence/temporal invariants;
- PostgreSQL fixture for cross-Relationship non-disclosure, revision CAS/replay and
  database immutability;
- Foundation CI run 250 passed the complete check gate on implementation head
  `fd8e20bf7d589393d017338af89502fa4ca3ae6b`;
- final documentation head `08d7685048ee27145937dbe204b4a8ea6deae09e`
  passed Foundation CI run 251;
- PR #29 merged as `f99c42157401728a5ca3b4f91d5732382f57c865`.

The MemPalace-inspired behavior used here is deliberately structural: extracted
MemoryRecords never replace their immutable/verbatim source evidence.

## Immediate work

Phase 5 — Tools and Providers is active on
`phase5-tool-receipts-replay`.

The registry foundation is merged to `main` as PR #37 at
`b3f2e8ce33aeb4ed125bd40af78f10a454174bbd`.

PR #38 merged to `main` as `21141266ab15e2111b8f78c6df365100a60a017a`.
Its execution/reconciliation slice established:
- provider credential bindings accept only canonical `CredentialRefId` values and
  fail closed on unknown/missing slots;
- consequential Tool execution is pinned to the registered ToolVersion;
- required authority capabilities are checked and current authority is revalidated
  immediately before dispatch;
- deterministic authority-scope/request fingerprints bind operation idempotency;
- exact replay of a settled or in-flight operation does not redispatch;
- explicit provider selection continues to use the canonical no-fallback registry;
- dispatch exceptions/unknown outcomes become `unknown` and immediately enter
  reconciliation with `safeRetry=false`;
- known-not-dispatched failures may fail without claiming an external side effect;
- PostgreSQL adapts the canonical Tool operation port onto existing
  `events.operations` and reconciliation storage;
- Tool operation reads/transitions are tenant-scoped;
- unit tests cover exact replay, stale-policy rejection, ambiguous dispatch and required
  credential references.

Implementation head `c6c86f6b0521d408cdf2fcd8938df481353e8d48` passed Foundation CI run 330.
The complete gate included frozen install, strict TypeScript, unit/architecture tests,
PostgreSQL 18 + pgvector integration suites and production builds. The PostgreSQL
fixture proves durable exact replay, revoked/stale authority rejection, tenant-scoped
operation reads and ambiguity-to-reconciliation with blind retry disabled.

Final documentation head `8502b302aaeef0d2d0e79a7861cf4a53974d437f` passed Foundation CI run 331 before merge.

Active receipt/replay slice now implements:
- canonical bounded external receipt evidence/record contracts in `packages/events`;
- consequential adapters must return sanitized receipt evidence for known dispatched
  outcomes before the operation may become locally successful/rejected/partial;
- Tool execution persists receipt evidence before settlement;
- receipt persistence failure becomes `unknown` -> reconciliation with blind retry
  disabled;
- exact replay loads durable receipts and does not redispatch;
- PostgreSQL ToolOperationStore records/lists canonical external receipts;
- receipt observation replay now compares payload reference and observation time as
  well as status/hash/reference/version;
- unit coverage includes receipt normalization, durable replay and receipt-store
  failure reconciliation;
- PostgreSQL integration coverage now expects durable receipt replay.

Immediate next:
1. run the full Foundation CI gate for this receipt/replay branch and fix any failures;
2. if green, add/verify any missing PostgreSQL receipt-conflict acceptance coverage;
3. merge the slice only after a green final documentation head;
4. then add typed provider failure/readiness/cost/timeout telemetry without secrets;
5. prove credential-reference scoping/resolution at the adapter edge;
6. finish the Phase 5 acceptance audit before advancing to Skills/Workflows.

The requested post-freeze donor boundary remains unchanged: MemPalace contributes
retrieval/evaluation/storage-contract behavior inside canonical Masanawa memory ports;
Paperclip contributes later workflow/runtime recovery and Ops behavior inside canonical
Masanawa workflow/agent ports. Neither becomes a production runtime authority.

The lifecycle/publication implementation now includes independent lifecycle CAS,
immutable same-scope/type lineage, current-authority + one-time-approval publication,
PostgreSQL fixtures for stale writers/preserved evidence/cross-scope rejection, stable
replay after later source supersession, source-row locking against concurrent revision
races, and generated sanitized publication provenance that cannot carry caller-injected
private verbatim evidence.

Foundation CI run 261 passed the complete gate on hardened implementation head
`f5777a0d32fdc57b84d8fd415bb4ddb5de57a972`; final documentation head
`061ab25d85b5100120c73d1442984cff8cf922e8` passed run 262; PR #30 merged as
`b3cc9e75fe32ded30dc51dc2b116a38b454b46a9`.

Do not skip directly to vector search. Retrieval quality cannot outrank canonical scope,
provenance, correction, deletion or liveness.

## Memory architecture — fixed

ADR-0007 and `docs/migration/MEMORY-ADOPTION-BOUNDARY.md` decide:
- `packages/memory` is the sole canonical memory authority;
- PostgreSQL stores canonical scoped records/revisions/evidence;
- relationship/private/shared/world separation is mandatory;
- scope/authorization precedes retrieval;
- contradictory/corrected history is versioned rather than silently overwritten;
- working context is compiled, not durable truth;
- vector/lexical/entity/temporal/graph indexes are disposable/rebuildable;
- expiration, tombstone and physical purge are distinct;
- automatic/proactive and explicit recall have separate policy gates;
- N.E.K.O, Letta Code, Mem0, OpenClaw and post-freeze MemPalace are bounded donors only.

## World architecture — fixed

ADR-0009 and `docs/migration/WORLD-SIMULATION-ADOPTION-BOUNDARY.md` decide:
- `packages/world` is the sole canonical world/life authority;
- AI Town supplies simulation mechanics, not canonical objects;
- ChatWithStars supplies life-state/canon/governance semantics;
- private Relationship memory cannot mutate shared World canon;
- memory/workflows consume World evidence only through typed boundaries;
- optional spatial simulation never becomes Character identity.

## Non-negotiable rules

- One identity system.
- One memory system.
- One skill system.
- One tool registry.
- One agent execution framework.
- One provider registry.
- One event model.
- One task/workflow engine.
- One world model.
- Channels/device nodes are adapters, not alternate brains.
- Characters are domain entities, not prompts or agent classes.
- Providers/models/UIs never own business truth.
- Consequential side effects require deterministic validation, authorization,
  idempotency, reconciliation and audit.
- Private relationship memory never silently becomes shared Character/World truth.
- Reference repositories are never production imports unless an explicit adapter ADR
  says so.
- No donor repository becomes a hidden runtime boundary.
- Licensing/provenance never decides feature survival.
- Nothing is migrated without evidence and an acceptance strategy.

## If context is missing

Do not ask the user to repeat previous discussions. Recover state from this repository,
the active branch, CI, source lock, reference vault and phase record.
