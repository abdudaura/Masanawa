# Phase 7 — Agent runtime

Status: IN PROGRESS
Current production task: **071 — CharacterSession canonical runtime contract**

Phase 6 is closed. Task 070 PR #76 merged as
`34aa6f9d19f9b0c92527fabe3a750052009398d2`; exact merged-main Foundation CI
run 451 passed. `docs/PHASE-6-CLOSURE-AUDIT.md` is PASS.
Task 071 starts from main `3f938bd8174e496b6ce3f4ec35d110d1c3aaa88b`
(PR #78, exact merged-main Foundation CI run 455 passed).
The implementation branch is `task071-character-session`. Acceptance remains pending
until this implementation is merged and exact merged-main CI passes.

## Task 071 chosen contract

`packages/agents` owns CharacterSession and its repository/migration. The public
schema v1 contains canonical tenant/User/Character/Relationship IDs, an exact
CharacterVersion ID, bounded continuity references, lifecycle/revision and timestamps.
It contains no transcript, prompt, compiled context, cached permission, provider thread,
model selection, Device brain, AgentRun or Workflow checkpoint.

Identity's new minimal `InteractionIdentityReader` supplies tenant/User/Character/
Relationship/version lifecycle facts without private content. Its PostgreSQL adapter
locks owning rows until transaction end. Creation and reset require the currently
active published CharacterVersion and active tenant/User/Character/Relationship with
the exact User–Character tuple. Continued sessions retain their original version when
a new authored version activates. A retired version blocks continued mutation;
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
  and ID replay the admitted record; changed requests conflict. Current authority and
  Identity admission are required for every attempt. The stored fingerprint contains
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
