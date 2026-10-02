# Continue Here

This is the mandatory handoff entry point for every new Masanawa implementation session.

## Mission

Build Masanawa as one clean canonical platform from the strongest validated capabilities
found across the reference vault and explicitly assessed post-freeze candidates.

Do not recreate donor project boundaries. The repository is the source of truth.

## Mandatory read order

1. `README.md`
2. `docs/VISION.md`
3. `docs/PRODUCT-NORTH-STAR.md`
4. `docs/PRODUCT-PROJECT-STRUCTURE.md`
5. `docs/PRODUCTION-MASTER-TASKS.md`
6. `docs/ARCHITECTURE.md`
7. `docs/AGENT-PHONE-EMBODIMENT.md`
8. `docs/TECHNOLOGY.md`
9. `docs/SOURCE-OWNERSHIP.md`
10. `docs/REWRITE-PLAN.md`
11. `docs/migration/LANDSCAPE-EXPANSION.md`
12. `docs/migration/SOURCE-LOCK.md`
13. `references/README.md`
14. `references/SOURCES.md`
15. `docs/migration/FORENSICS-METHOD.md`
16. `docs/migration/FEATURE-LEDGER.md`
17. `docs/migration/BEHAVIOUR-LEDGER.md`
18. `docs/migration/DATA-LEDGER.md`
19. `docs/migration/INTEGRATION-LEDGER.md`
20. relevant files under `docs/migration/sources/`
21. the active phase implementation record named below.

`docs/migration/LICENSE-LEDGER.md` is compliance/provenance metadata and is **not** part
of architectural feature selection.

## Current phase

**Phase 6 — Skills.**

Phase 5 is closed on merged `main` at
`0fe123e18a9163386c4ab10331139265ce26b64e`; Foundation CI run 369 passed on
that exact merge commit.

The next implementation branch must start from current merged `main`, not from an
older Phase 5 branch.

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

Phase 6 — Skills remains the product implementation phase, preceded by the production-structure hardening sequence in the canonical ledger.

Tasks 001-054 are merged complete.

Task 054 implementation head `3a0a6251a551ffcfd852d3f4f80063195257ece6` passed
Foundation CI run 379, PR #47 merged as
`d0a198dbdec1af08e3c8f1378da0985db628eb6e`, and merged-main Foundation CI
run 380 passed on that exact merge commit.

**Current: Task 062 of 150 — Implement Skill dependency graph and cycle/conflict validation.**

Active implementation branch: `task062-skill-dependency-graph`. Existing registry graph logic is being hardened with atomic cycle/missing/depth validation tests and stable SkillId↔key conflict enforcement. Acceptance/CI is pending.



Tasks 001-061 are merged complete.





Task 061 implementation head `6072e2ca40aea0f852f61b4c008a5b18d8251dae` passed
Foundation CI run 411. PR #58 merged as
`7e1fc2576979823a0cb859ac9a6bd7ea21d0f522`, and merged-main Foundation CI
run 412 passed on that exact merge commit.

Task 061 established:
- provider-neutral required Tool capability declarations on immutable SkillVersions;
- named Tool references that may remain capability-bound or pin an exact ToolVersionId without pinning a Provider;
- fail-closed normalization requiring complete capability/reference coverage;
- fail-closed resolution against the canonical Tool registry for missing capabilities, missing candidates and exact-pin capability mismatches.

Task 060 implementation head `f5f939f7fb6999fa901d1538ab2a37ef50b04579` passed
Foundation CI run 407. PR #56 merged as
`c4cf2ce319bc1365387ec3ebcd510916ac9de579`, and merged-main Foundation CI
run 408 passed on that exact merge commit.

Task 060 established:
- TypeBox-validated native Skill manifest v1 with bounded fields and fail-closed unknown versions/properties;
- bounded `SKILL.md` compatibility import for routing metadata without introducing a general YAML runtime;
- relative-POSIX resource containment rules with traversal/ambiguous path rejection;
- scripts skipped by default and requiring explicit import opt-in that still grants no execution authority;
- deterministic normalized-content provenance fingerprints and explicit quarantined import candidates with no canonical IDs/certification/readiness.

Task 059 implementation head `3755dbf7b32f3eaa4e84db32e26749e21c110ef9` passed
Foundation CI run 402. PR #54 merged as
`631076323f075f07a9c67ea5902f17070d859e22`, and merged-main Foundation CI
run 403 passed on that exact merge commit.

Task 059 established:
- canonical private `@masanawa/skills` workspace integrated into frozen-install/build gates;
- stable logical Skill identity separated from immutable exact SkillVersion content;
- canonical normalization and recursive freezing for SkillVersion-owned schemas, examples, capabilities, provenance and certification evidence;
- fail-closed certification, consequential idempotency/reconciliation and billed-confirmation invariants;
- preserved dependency-aware registry work as bounded groundwork only, without claiming Tasks 060-070 complete.

Task 058 implementation head `bc6fb045a57759c65531e54f35599d1b91b2b993` passed
Foundation CI run 397. PR #52 merged as
`0a8376a69a9410c8bee48ef03d0b939a31188da9`, and merged-main Foundation CI
run 398 passed on that exact merge commit.

Task 058 established:
- machine-readable production environment registry and ownership/classification rules;
- explicit composition-root-only environment access with domain packages isolated from `process.env`;
- Security-aligned secret/bootstrap conventions without raw secret material in source-controlled manifests;
- canonical coarse deployment topology for Gateway/Worker/Presence/Ops and vendor-neutral hosting;
- architecture enforcement for registered production environment reads and secret classification.

Task 057 implementation head `fbdd51b0b113f8d40c625086d0a851c3de60a7f0` passed
Foundation CI run 394. PR #51 merged as
`5395b29c1bfa5705d447152d3ff3c606c0658ed6`, and merged-main Foundation CI
run 395 passed on that exact merge commit.

Task 057 established:
- one machine-readable API lifecycle policy separating workspace SemVer, HTTP majors, schema versions and domain registry versions;
- root-only reusable workspace exports and repository-wide no-deep-import enforcement;
- Contracts-suite acceptance for API lifecycle and supported HTTP major routing;
- machine-audited deprecation registry with source annotations for deprecated workspace symbols;
- immutable event/payload and Tool/Provider version semantics.

Task 056 implementation head `b17d4ba53d23abb9abf40aa7800b1c461dc9fa90` passed
Foundation CI run 386. PR #49 merged as
`ed119581974cfb146da0b6e0a5e119eda8731df8`, and merged-main Foundation CI
run 387 passed. Supplemental Security/Load/Recovery hardening PR #50 merged as
`b07565a315c35dc1ef840c89845ccfd2836c2da4`; merged-main Foundation CI run
391 passed on that exact commit.

Task 056 established:
- canonical cross-cutting suites for contracts/integration/e2e/parity/security/recovery/load/chaos;
- strict TypeScript and default Vitest discovery for `tests/**`;
- deterministic Recovery and Chaos evidence using the shared fault-injection harness without duplicate tests;
- targeted suite commands plus one all-tests `test:ci` merge gate;
- visible Foundation CI Typecheck/Test/Build stages;
- architecture enforcement for suite directories, scripts, discovery and workflow wiring.

Implemented on Task 057 branch:
- added one machine-readable API lifecycle manifest separating workspace SemVer, HTTP majors, schema versions and domain registry versions;
- activated the Contracts suite as blocking evidence;
- enforced root-only reusable workspace exports and repository-wide no-deep-import rules;
- enforced supported HTTP major prefixes with only /healthz and /readyz unversioned;
- added a machine-audited deprecation registry and required source annotations for deprecated workspace symbols;
- documented immutable event/payload and Tool/Provider version semantics.

Task 057 remains incomplete until the branch passes the complete gate, merges to main,
and merged-main CI passes.

The existing `phase6-skills-foundation` branch contains valid unmerged Phase 6 work
based on pre-roadmap `main`. Preserve it, but do not merge it ahead of Tasks 054-058.
After the structure-hardening sequence closes, reconcile/rebase its valid Skill work
onto then-current `main` rather than duplicating that implementation.

Before implementing the first Phase 6 slice, use `docs/PRODUCT-NORTH-STAR.md` as the
product-priority check and preserve the device-provider direction in
`docs/AGENT-PHONE-EMBODIMENT.md`. Skills must be capable of resolving Tools through
both cloud Providers and future Device Providers without embedding either execution
path in Skill definitions.

Merged Phase 5 history:
- registry foundation PR #37:
  `b3f2e8ce33aeb4ed125bd40af78f10a454174bbd`;
- consequential execution/reconciliation PR #38:
  `21141266ab15e2111b8f78c6df365100a60a017a`;
- durable receipt/replay PR #39:
  `8d531188e2f9d7c38f50cc883e3425096b5408ad`;
- typed Provider failures/privacy-safe telemetry PR #42:
  `be814fee91b8b551b00e2d9900d2970680297b3d`.

PR #45 merged as `0fe123e18a9163386c4ab10331139265ce26b64e`.
Foundation CI run 369 passed on the merged `main` commit. Phase 5 is therefore closed.

PR #44 is an older, still-open alternative credential-resolution branch based on the
pre-#45 history. Treat it as stale/superseded unless a later reconciliation finds a
missing behavior not already preserved in the merged credential-custody design.

Implemented on the branch:
- Security-owned CredentialRefId resolution binds tenant, Provider, Operation and slot;
- raw credential material is available only through `CredentialSecret.use(...)`;
- CredentialSecret string/JSON surfaces are always `[REDACTED]`;
- encrypted credential envelopes are crypto/KMS-neutral contracts rather than a
  hard-coded provider;
- PostgreSQL `security.credential_refs` stores only encrypted envelope material plus
  tenant/provider/slot/generation/active metadata;
- create is conflict-safe; rotation uses expected-generation CAS; revocation disables
  subsequent resolution;
- provider adapter-edge helpers resolve only validated Provider credential slots;
- wrong tenant/provider/slot, missing/ref-revoked credentials and decrypt/KMS failures
  all fail through one non-disclosing `credential.unavailable` authorization surface;
- PostgreSQL integration coverage proves ciphertext-at-rest, scope isolation,
  generation rotation/stale rejection, revocation and decrypt-error redaction.

Foundation CI run 356 found an implicit-any issue and later hardening added a real
same-tenant Operation requirement plus a genuine pre-revocation decrypt-error test.
Hardened implementation head
`7d53562fe29f5aae6a3e69c495757ce22658df3a` passed Foundation CI run 365.
The complete gate passed frozen install, strict TypeScript, unit/architecture tests,
PostgreSQL 18 + pgvector integration suites and production builds.

The Phase 5 acceptance audit is PASS and its final merge is green.

Immediate next:
1. reconcile the valid `phase6-skills-foundation` work onto current merged `main` without duplicating already-valid Skill work;
2. continue Task 059 in ledger order and preserve provider-neutral Skill ownership;
4. keep Skills provider-neutral so future assigned Android devices participate through the same Tool/Provider architecture;
5. use Paperclip only as a bounded workflow/runtime/Ops behavior donor and preserve Masanawa Authority/Operation/Provider boundaries.

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
