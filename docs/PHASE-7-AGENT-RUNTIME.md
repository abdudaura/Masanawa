# Phase 7 — Agent runtime

Status: IN PROGRESS
Current production task: **072 — AgentRun identity, lineage and durable trace references**

Phase 6 is closed. Task 070 PR #76 merged as
`34aa6f9d19f9b0c92527fabe3a750052009398d2`; exact merged-main Foundation CI
run 451 passed. `docs/PHASE-6-CLOSURE-AUDIT.md` is PASS.
Task 071 started from main `3f938bd8174e496b6ce3f4ec35d110d1c3aaa88b`
(PR #78, exact merged-main Foundation CI run 455 passed).
Task 071 is COMPLETE. Task 071 implementation head `333030618c0d060c6253dbe99fe548dc3b823d4c` passed Foundation CI run 458 (360 tests in 75 files, including ten real PostgreSQL 18 CharacterSession acceptance cases). PR #79 merged as `c2bdfb9f5a970d3d949cbd8692d9c59cb89670a0`; merged-main Foundation CI run 459 passed on that exact merge commit.
The historical implementation branch is `task071-character-session`; future branches
start from current merged main.

## Task 071 chosen contract

`packages/agents` owns CharacterSession and its repository/migration. The public
schema v1 contains canonical tenant/User/Character/Relationship IDs, an exact
CharacterVersion ID, bounded continuity references, lifecycle/revision and timestamps.
It contains no transcript, prompt, compiled context, cached permission, provider thread,
model selection, Device brain, AgentRun or Workflow checkpoint.

Identity's new minimal `InteractionIdentityReader` supplies tenant/User/Character/
Relationship/version lifecycle facts without private content. Its PostgreSQL adapter
locks owning rows until transaction end. New creation and reset require the currently
active published CharacterVersion and active tenant/User/Character/Relationship with
the exact User–Character tuple. Continued sessions retain their original version when
a new authored version activates. A retired version blocks binding updates;
authorized history and closure remain available. Inactive identities deny access.

Skills supplies an existence-only exact-version reference reader. Session selection
stores up to 64 immutable SkillVersion IDs, not another Skill catalog or certification.
Changing publication or readiness never silently changes those IDs. A future executor
must reload current Skills readiness/certification and resolve its canonical revision
pin before execution; session membership is never eligibility or permission.

Task and WorkflowRun references are bounded to 64 each and require the corresponding
current AuthorityContext resource scope when attached or carried through reset.
They are references only: their owners must resolve/revalidate them before use.
Task 071 does not create future Workflow tables or a parallel task engine.

## Lifecycle and concurrency

- Create allocates a caller-supplied canonical session ID once. Same normalized request
  and ID replay the current stored record; changed requests conflict. Replay never
  reopens closed/expired continuity or re-admits a replaced/retired authored version.
  Current authority and active Identity scope are required for every attempt. The stored fingerprint contains
  only IDs, duration and bounded references, never authority or private content.
- `active -> closed` is terminal, with `ended` or `reset` reason. Expiry is a separate
  time boundary: an expired active record is history and cannot accept binding updates.
  Explicit close/reset may retire expired continuity.
- `updateBindings` explicitly replaces channel/presence projections and/or exact
  skill/task/workflow references using expected-revision CAS. Tenant/User/Character/
  Relationship/version, creation time and expiry cannot change.
- Reset closes the previous session and creates a new session in one transaction.
  It retains Relationship and exact skill/task/workflow references, clears transports,
  and explicitly admits the chosen active CharacterVersion. Successor collisions roll
  back closure; competing resets admit one successor. Retry of a stale reset conflicts;
  authorized read of the predecessor/successor reconciles a lost response.
- Every changed row advances revision once. SQL guards immutable identity/lifetime,
  rejects stale direct updates and prevents closed-history mutation or deletion.
  A deferred same-relationship successor FK and unique successor preserve scoped lineage.
- `maxDurationMs` is required service-composition policy, not a per-adapter retention
  default. Session expiry does not erase durable Memory, Relationship, World, Task or
  Workflow truth. Physical transcript/session retention is later explicit policy work.

## Authorization and persistence

`CharacterSessionRepository` has no unscoped read/list API. Each request supplies the
exact tenant/User/Character/Relationship tuple and admitted AuthorityContext. The
capabilities are `agents.session.create/read/update/close/reset`; relationship resource
scope is always required. User principals must match the User. Other principals also
need explicit `agents.session.manage-other`; service/device/operator identity alone
never grants private access. History read exposes only session metadata, and grants no
permission to resolve its task/workflow references.

The concrete pool-scoped PostgreSQL adapter owns every transaction. It captures
normalized immutable requests before waits, uses Security's transaction-local policy
share lock and revocation lookup, locks Identity lifecycle rows through its owning read
port, then verifies server time and authority after waits and mutations before commit.
Revocation/policy replacement serializes with admission. Expired or stale authority
rolls back the transaction. Session visibility is never an authorization shortcut.

Canonical storage is `agents.character_sessions`. No network effect runs in the
transaction and no foreign package tables are mutated. `characterSessionMigrationRoots()`
explicitly composes Foundation + Identity + Agents migrations; service readiness uses
that manifest and detects missing/drifted Agents artifacts. Foundation-only consumers
retain their existing manifest. No new deployable service or public HTTP endpoint is
introduced in this contract milestone.

## Acceptance evidence

- Agents unit tests: bounded/copy-frozen references, canonical ID separation, unknown
  fields/schema rejection, lifecycle consistency, expiry/duration, owner/tenant/
  relationship/action checks, delegated service access and scoped references.
- `tests/integration/character-session-acceptance.test.ts`: ten isolated real PostgreSQL
  18 cases for concurrent idempotent creation, changed request rejection, cross-tenant
  and same-tenant private isolation, Identity mismatch/draft/archive rejection, reconnect
  continuity, competing CAS writers, exact pins after pool restart and new publication,
  explicit selection refresh, reset continuity/rollback/races, expiry/close, policy and
  revocation checks, authority expiry during lock waits, SQL immutability and migration
  readiness drift. The fixture uses real canonical Identity/Skills ports.
- Identity relationship state is checked unchanged across reset; task/workflow/skill
  references survive. Memory/World/Workflow truth is outside this port and receives no
  writes or deletes. Later golden journeys will exercise those complete owners together.
- Database tests explicitly skip without `MASANAWA_TEST_DATABASE_URL`. Foundation CI
  runs them against PostgreSQL 18 + pgvector, then production builds. Local skipping
  is not PostgreSQL acceptance or completion evidence.

## Boundaries carried forward

Identity/World retain Character and life/canon authority. Skills and Tools retain
certification/readiness, exact pins, Operations, receipts, current-authority execution
and reconciliation. Cloud and future Device Providers remain interchangeable edges;
real Android/OmniSIP qualification belongs to later Device milestones. Task 072 adds
AgentRun identity/lineage/trace references. Strategies, context compilation, budgets and
run cancellation remain later Phase 7 tasks. Phase 8 owns durable business Workflows.

## Task 072 implementation checkpoint

The current implementation branch adds the canonical AgentRun identity,
lineage and durable trace-reference contract plus PostgreSQL persistence.
AgentRun is scoped to one tenant/User/Character/Relationship and exact
CharacterSession/CharacterVersion. Root/parent lineage is bounded; request,
correlation, optional Task/Workflow and Operation references are immutable;
terminal completion/failure is explicit. Direct database rewriting/deletion of
run identity/lineage/trace history is rejected.

A supplemental Alpha 1 vertical slice exercises this new contract from the
Flutter app: each text or media turn creates a real CharacterSession-backed
AgentRun, uses a replaceable development inference executor, then finishes the
run. This is testing integration only and does not advance Tasks 073+.

PostgreSQL acceptance coverage was added for lineage, terminal persistence,
Relationship isolation and database immutability. GitHub-hosted Actions remain
unable to allocate a runner in the current repository/account state; Task 072
must not be marked COMPLETE until its required verification evidence actually
runs and passes.

## Next milestone — Task 072

Recover the canonical AgentRun ID/domain model and ADR-0008 before choosing its
identity, lineage and durable trace-reference contract. Compose admitted runs with the
existing CharacterSession and delegated Security ceiling. Do not introduce another
principal/identity store, transcript-as-memory authority, strategy engine, provider
selector, Skill catalog, Operation ledger or Workflow checkpoint owner. Record its
persistence and acceptance requirements when assessing the implementation above.
Task 072 is implemented but remains open for its full acceptance gate.
Do not recreate its model, repository or migration.


## Task 073 adjacent implementation groundwork

While Task 072 remains formally open pending its acceptance gate, the Alpha runtime now
uses the next provider-neutral seam without advancing the canonical task ledger:
- `@masanawa/agents` owns an `AgentStrategy` interface keyed by exact AgentRun,
  CharacterSession and CharacterVersion identity;
- transient user input is explicitly text or media and is not durable transcript,
  Memory, World or Workflow truth;
- `AgentInferenceProvider` is model/vendor neutral and owns no Character/session/run,
  Skill/Tool, Memory or Workflow authority;
- Gateway Alpha composition now calls AgentStrategy, while the Gemini adapter translates
  only provider-neutral inference input at the external model edge;
- the initial Alpha strategy intentionally did not compile Memory/World context,
  select Skills/Tools, enforce budgets or delegate; those remain Tasks 074-079.

This is mergeable architectural groundwork for Task 073, not a completion claim.

## Task 073 inference hardening and local gate

The Agents-owned inference admission function takes a copied/frozen, bounded transient
text/media envelope. It excludes canonical IDs, authority and arbitrary extra fields,
checks model output and returns only validated text. Typed failures have stable
provider-neutral codes and safe retryability; raw exceptions/payloads are never retained.
The Gemini edge now keeps its credential out of request URLs, redacts HTTP/transport/
JSON failures and excludes internal thought parts.

Gateway persists safe inference failure codes in terminal AgentRuns. Replacement
tests prove that two inference implementations retain the same session and exact
session CharacterVersion while generating separate canonical runs. This does not
compile Memory/World, orchestrate Skills, implement run budgets or add cancellation.

Broader local checks also repaired the Alpha route-versioning mismatch across Gateway,
mobile transport and docs; Ops TypeScript 7 typing and readonly HTTP projections;
the misplaced configured-Character guard in catalog listing; invalid route-test IDs;
and the public Ops API-origin environment registration.

`pnpm alpha:verify` builds/typechecks the Gateway/Ops dependency graphs, runs runtime,
architecture and Contracts tests, then runs real CharacterSession/AgentRun PostgreSQL
acceptance. Missing `MASANAWA_TEST_DATABASE_URL` fails before checks rather than
producing a green skipped suite. `--unit-only` explicitly reports database exclusion.

Local Node 24.19.0/pnpm 12.8.2 evidence: full workspace typechecking passed;
`alpha:verify --unit-only` passed with 131 tests; full Vitest passed 344 tests with
72 database-dependent tests skipped. PostgreSQL/Flutter/APK and exact merged-main
Foundation CI acceptance remain unverified. Task 072 is still current and Task 073
remains unchecked.

## Task 074 bounded context groundwork (not complete)

Agents now composes transient context from owner-resolved CharacterVersion,
compiled Memory projections and public approved World events. It validates the
exact running AgentRun/active CharacterSession version, tenant and Relationship;
rejects mismatched or non-current evidence before truncation; preserves mandatory
Constitution instructions; bounds optional evidence deterministically; and retains
source/revision references outside inference prompt text. No context is persisted.

Gateway conversation custody accepts an optional context compiler for both text
and media turns. Alpha strategy checks its run/session/version binding and uses
compiled authored identity instead of presentation aliases when supplied. The initial optional seam did not wire source retrieval. The Identity-backed Alpha
composition below supersedes that limit; Memory/World recall remains unwired.

The source composer remains responsible for owner-authorized reads, current policy,
revocation, tombstones and source freshness. Character-private and organization
Memory are excluded until an owner-admitted disclosure projection exists. Shared
Character scopes still require explicit Character resource admission. Private
Relationship evidence never becomes World canon. Task 074 remains incomplete;
Task 072 remains the canonical current task pending full acceptance.

Verification for this context slice: frozen-lockfile installation succeeded on
pnpm 12.8.2; Gateway/Ops dependency builds and typechecks plus the runtime gate
passed 142 tests; full Vitest passed 355 tests with 72 database-dependent skips.
PostgreSQL, Flutter and APK acceptance remain unrun in this environment.


## Task 074 Identity-backed Alpha composition (still incomplete)

Gateway's default Alpha database composition now supplies a Character context compiler;
Alpha startup refuses missing compiler composition. Identity owns the exact-version
Constitution read port. The PostgreSQL composer reuses canonical session/run admission,
locks current Security policy and Identity lifecycle, rereads both durable snapshots,
loads the pinned published version, and compiles Identity-only transient context. It
checks server time/current authority again before returning. Provider adapters receive
admitted text only and never fetch canonical data independently. Model inference runs
after the read transaction ends; this is a context-admission snapshot, not a long-lived
lock or cancellation/supersession implementation (Task 080).

A new active version does not rebind an existing session. Closed/changed sessions,
terminal/changed runs, stale policy, revoked authority and archived Relationships deny
context before inference. Gateway records a failed run when context admission fails.
Constitution replaces presentation aliases in model instructions; UI projection edits
still change UI labels. The owner-backed recall checkpoint below extends this original
Identity-only composition without adding transcript persistence or World mutation.

The AgentRun read adapter's `FOR SHARE` now runs in a transaction that permits row
locks. Its previous read-only setting was incompatible with PostgreSQL row locks.
The query-harness regression test passes; real PostgreSQL acceptance remains required.

Verification: Gateway/Ops dependency builds/typechecks and runtime/architecture checks
passed 152 tests. Full Vitest passed 365 tests with 75 database-dependent skips.
Three added PostgreSQL 18 acceptance cases cover exact version after activation, changed
run/policy, and closed session/archived Relationship. They are authored but unrun here.
Flutter/APK and hosted merged-main gates remain open; Task 072 is still current.


## Task 074 owner-backed Memory and World recall (still incomplete)

Memory owns a narrow Relationship context read port. Its PostgreSQL reader checks
current authority and the explicit memory.context.read capability, searches only the
session Relationship using the existing lexical retrieval pipeline, and compiles at
most eight current evidence items. The 8,000-character budget is conservative input
size accounting, not a provider token or billing estimate. Queries are capped at
2,000 characters; blank queries skip Memory I/O. Gateway supplies text or optional
media captions without treating transcripts or raw media as durable Memory.

World owns a public-event context read port guarded by world.context.read and
explicit World resource scopes. Reads admit at most eight approved, non-retired,
currently effective public events for the pinned CharacterVersion or World-wide
events. No private World events, other versions, or implicitly accessible Worlds
are admitted. Alpha grants Relationship Memory recall but no automatic World scopes.

Agents compose these owner projections with the pinned Constitution under the
existing 32,000-character context budget and retain evidence provenance separately
from provider text. The compiler rechecks server time and current authority after
retrieval; revoked or expired authority fails before inference. This snapshot does
not implement Task 080 cancellation or grant tool execution authority.

Focused runtime, Memory, World and architecture verification passed 199 tests and
the Gateway dependency build. Full real PostgreSQL and mobile acceptance remain
required. This work does not complete Task 074 or advance the Task 072 ledger gate.

Broader checkpoint verification: 388 tests passed, 75 database-dependent tests
skipped; root TypeScript compilation passed. No skipped test is a passing acceptance gate.


## Task 074 PostgreSQL recall acceptance preparation

Two real PostgreSQL 18 journeys now seed canonical Memory plus its active lexical
projection, and authored World events. They verify Relationship isolation, explicit
read capabilities, approved public canon, draft/private exclusion, and World scope
isolation through the actual context compiler. These tests use a disposable database
created by the existing AgentRun acceptance harness, not the user's Alpha database.
They are authored and typechecked, but have not run against PostgreSQL here.

Acceptance preparation exposed and fixed a World SQL parameter mismatch: canonical
World IDs are text columns, so the admitted-ID array is cast to text[] rather than
uuid[]. The query-harness regression now checks this storage-compatible cast.

The runtime verification command now includes Memory and World owner unit tests.
`pnpm alpha:verify --unit-only` passed 214 tests plus Gateway/Ops builds and all
relevant typechecks. Full Vitest passed 388 tests with 77 database-dependent skips.
Task 072 remains current; PostgreSQL acceptance, merged-main CI and mobile gates
remain open. No deployment or APK was built by this checkpoint.


## Task 075 run-bound Skill/Tool selection preparation (not complete)

Agents now prepares a transient selection through Skills' narrow selection source.
It requires explicit agents.skill.select authority, matching Character assignment
and selected session SkillVersion, an active session and running bound AgentRun.
Assignment/session references constrain selection but never grant capabilities.

Skills owns exact dependency revision pins, model advertisement and current
readiness. Every dependency's authority requirements are checked. Tools remain
in the one Tool registry; selection resolves only declared references and exact
ToolVersion IDs, honors declared pins, rejects duplicate/extra selections and
requires explicit choices for provider-neutral capability references. Graphs and
selected references are bounded to 64. Agents imports Skills, not Tools directly.

After asynchronous current-policy/revocation checks, Agents rechecks time/access
and Skills eligibility. Changed graph pins or expired sessions deny preparation.
Confirmation requirements are metadata only: no approval, Tool invocation, provider
choice, side effect, receipt or durable execution truth is produced. Gateway Alpha
has not been wired to this source and is not granted the new selection capability.
Consumers must supply owner-admitted durable snapshots and current assignments;
this helper does not replace durable admission or Task 080 stale-result fencing.

Verification: 21 new selection tests cover graph readiness, exact pin enforcement,
undeclared/duplicate Tool references, explicit Skill/Tool capabilities, assignment
and session binding, revocation, expiry and graph changes. The expanded runtime
gate passed 316 tests plus Gateway/Ops builds/typechecks; full Vitest passed
409 tests with 77 database-dependent skips. Task 072 remains current; Tasks
073–075 remain open. Latest pre-checkpoint GitHub Actions on 590deea had zero
steps and runner_id=0 for both Foundation CI and Mobile Build. No PostgreSQL
acceptance, hosted inference or APK/device verification is claimed.


## Task 075 durable selection admission and Gateway custody checkpoint

The PostgreSQL selection adapter now rereads CharacterSession and AgentRun
snapshots, locks the current Character assignment, and rejects changed custody
before preparing anything. Skills owns a bounded exact graph reader: only the
selected root/dependencies are loaded, definition hashes are checked, current
readiness rows are locked, and graphs over 64 versions fail closed. Assignment,
Skill versions/readiness and current Security/Identity custody stay in their
owning schemas within one repeatable-read transaction. No selection writes occur.

Gateway conversation composition accepts this admission port and supplies text
and media strategies an optional run-bound prepareSkillSelection callback. The
callback takes only exact Skill/Tool choices; caller-supplied authority or assignment
cannot replace Gateway custody. It closes on strategy return/failure and rejects
both retained calls and in-flight results that arrive after the strategy turn ends.
Provider adapters still receive inference input only. No tool action, approval,
receipt or completed side effect is inferred from preparation. This local callback
lifecycle guard does not complete Task 080 cancellation/supersession.

Default Alpha has no executable Tool catalog composition and does not receive
selection authority automatically. Actual Skill execution integration remains
open. One new PostgreSQL 18 journey is authored/typechecked to verify current
assignment/readiness changes; it has not run here. Eleven admission query-harness
tests and two Gateway journeys verify custody, locks, hash/readiness rejection,
capability checks, callback lifetime and text/media binding.

Verification: expanded runtime gate passed 329 tests plus Gateway/Ops builds and
relevant typechecks. Full Vitest passed 422 tests with 78 database-dependent skips.
Task 072 remains current; Tasks 073–075 are not complete. No PostgreSQL acceptance,
hosted deployment, Flutter/APK build or device test is claimed.
