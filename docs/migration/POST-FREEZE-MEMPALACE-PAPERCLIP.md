# Post-Freeze Candidate Assessment — MemPalace and Paperclip

Status: assessed, not admitted to the pinned reference vault  
Assessment date: 2026-10-02

This assessment was requested after Phase 0 donor freeze and after the non-spatial
Phase 3 Identity/World closure. It does not silently reopen Phase 0 and does not make
either upstream repository a Masanawa runtime dependency.

Repositories inspected at:
- MemPalace `mempalace/mempalace` default branch `develop`, head
  `5ea40d30caf0ed2ff6e49623e386a0863b28edaa`;
- Paperclip `paperclipai/paperclip` default branch `master`, refreshed head
  `c83df091b1a5207375eaf23466bb5c62e4e1518e`.

## 2026-10-02 upstream refresh

MemPalace remains at the originally assessed head, so its storage/retrieval findings are
unchanged. Its accepted storage-backend RFC still requires explicit capability
reporting, rejection rather than silent dropping of unsupported filters/namespaces, and
strict embedding dimension/model identity compatibility.

Paperclip advanced after the first assessment. The current execution semantics still
separate checkout ownership from the live execution run, refuse stale-lock adoption
while a holder is non-terminal, model blockers separately from task ancestry, and
re-check execution gates before dispatch. Recent commit
`4e524632036af370da2008f1edcb4b89a4ff2b00` also adds recovery from stalled
external-runtime log streams by switching observation paths without redispatching the
command, preserving output deduplication and requiring verified command exit before
completion. This is useful later for Masanawa runtime adapters and reconciliation, not
a reason to import Paperclip as a control plane.

The previously cited Paperclip issues #12482 (single-consumption authorization) and
#11852 (persisted run-context validation consistency) were rechecked on 2026-10-02 and
remain open. Masanawa therefore keeps its stricter one-time Approval consumption,
AuthorityContext and Operation/effect semantics rather than inheriting Paperclip
approval state directly.

## Decision summary

Both repositories contain useful capabilities, but neither should be bolted onto
Masanawa as another source of truth.

### MemPalace

Decision: **strong Phase 4 memory donor, behavior-level adoption only by default.**

Best contributions:
- verbatim source/evidence preservation rather than lossy extraction-only storage;
- pluggable retrieval backend contract with explicit capability reporting;
- strict partition/isolation conformance;
- embedder identity + vector-dimension compatibility checks;
- semantic + lexical/hybrid retrieval and benchmark discipline;
- temporal entity/relation projections with validity intervals and source links;
- resumable/idempotent transcript mining/sweeping concepts;
- context-loss/compaction hooks that flush durable evidence before context is lost.

Canonical destination:
- `packages/memory` owns records, scopes, revisions, lifecycle, provenance and
  authorization;
- PostgreSQL owns canonical durable memory;
- pgvector/lexical/entity/temporal structures are rebuildable projections;
- `packages/telemetry` owns evaluation evidence;
- optional external retrieval stores, including a future MemPalace compatibility
  adapter, sit behind canonical retrieval/provider ports only.

Do **not** adopt as canonical:
- Palace/Wing/Room/Drawer taxonomy as platform identity or privacy scope;
- ChromaDB, SQLite, its temporal graph database, or filesystem layout as memory truth;
- agent diaries/logstreams as a second workflow/task system;
- MCP tools as privileged memory authorization;
- Python process/runtime ownership of Masanawa memory.

### Paperclip

Decision: **strong later workflows/agents/Ops donor, not a Phase 4 memory dependency.**

Best contributions:
- control-plane / execution-plane separation;
- external runtime adapters behind one orchestration contract;
- heartbeat/wake execution windows triggered by assignment, schedule, comment,
  manual invoke, and approval resolution;
- atomic task checkout and one-live-run execution ownership;
- stale-run adoption guarded by transactional locks and terminal-run evidence;
- blockers/dependency readiness before checkout;
- goal/task ancestry;
- runtime/session continuity as adapter state rather than business truth;
- budget/cost/run telemetry;
- operator-facing workforce/task/run visibility.

Canonical destinations:
- `packages/workflows`: task hierarchy, leases/checkouts, blockers, attempts,
  recovery/reassignment and durable work state;
- `packages/agents`: worker/strategy execution envelopes and runtime references;
- `packages/telemetry`: usage/cost/run evidence;
- `apps/ops`: goal/task/worker/run visibility and operator controls;
- execution workspaces remain tool/runtime adapter state, never canonical workflow truth.

Do **not** adopt as canonical:
- Paperclip Company as a replacement for Tenant/Organization;
- Paperclip employee Agent as Character identity;
- Paperclip issue state as a second workflow engine;
- Paperclip sessions as durable memory;
- direct Paperclip approval semantics in place of Masanawa security/Operation
  authority.

## Why MemPalace materially improves the Phase 4 design

### 1. Keep verbatim evidence as well as extracted memories

ADR-0007 already requires provenance/evidence. MemPalace provides strong evidence that
verbatim source segments are valuable retrieval material because extraction can discard
context. Masanawa should therefore distinguish:
- immutable/source evidence references or bounded verbatim evidence segments;
- extracted/normalized MemoryRecords;
- reflections/summaries as derived records.

Extracted facts must never be the only surviving representation of what justified them.

### 2. Retrieval projections need an explicit compatibility contract

MemPalace's backend contract records the embedding model identity and vector dimension,
and treats a model/dimension mismatch as a migration/rebuild event rather than silently
mixing vector spaces.

Masanawa should carry, for every vector projection:
- source MemoryRecord/Revision;
- projection version;
- embedding model/provider identity;
- vector dimension;
- source content hash;
- built-at time.

Changing embedding identity requires a new/rebuilt projection generation. It must not
reinterpret old vectors as if they came from the new model.

### 3. Isolation should be conformance-tested at every retrieval adapter

MemPalace has explicit cross-palace isolation tests and refuses unsupported namespaces
rather than silently ignoring them.

Masanawa's stronger rule is:
- canonical authorization derives an allowed MemoryScope predicate first;
- every retrieval projection adapter receives only that authorized predicate;
- an adapter that cannot enforce the requested partition/filter capability fails
  closed instead of widening the query;
- cross-tenant and cross-relationship conformance tests run against every adapter.

### 4. Temporal entity graphs are useful only as projections

MemPalace's temporal graph tracks validity windows and source evidence. This is useful
for entity/temporal recall, but Masanawa should implement the semantics over canonical
MemoryRecord revisions/evidence and rebuildable PostgreSQL projections.

The graph cannot become a separate truth store. A graph edge must always trace back to
canonical record/revision/evidence IDs.

### 5. Benchmark discipline should become an acceptance gate

MemPalace distinguishes retrieval recall from end-to-end QA and keeps held-out results
separate from tuned benchmark results. Phase 4 should adopt that discipline:
- scope leakage rate is measured separately and must remain zero;
- retrieval recall/precision is measured on fixed held-out fixtures;
- temporal, entity, contradiction, preference and provenance categories are separate;
- reranking quality, latency, cost and context-token usage are reported separately;
- a high retrieval score can never compensate for an authorization failure.

## Why Paperclip materially improves later control-plane design

### 1. Durable checkout ownership is stronger than conversational task intent

Paperclip's issue checkout uses conditional updates over issue status, assignee,
checkout run and execution run. Its stale-run adoption path locks both the issue and
run evidence before transferring ownership.

Masanawa should preserve the principle behind `packages/workflows`:
- one work item has an explicit live execution lease/attempt;
- checkout/claim is atomic;
- stale ownership is reclaimed only from durable terminal/expired attempt evidence;
- retries do not become concurrent execution merely because the same AgentStrategy
  woke twice.

### 2. Heartbeats are useful as a wake protocol, not a second scheduler

The wake model is useful for agents that should not remain resident continuously.
Masanawa can normalize schedule/assignment/event/operator wakes into workflow/agent
run requests while `packages/workflows` remains the only durable task authority.

### 3. Operator visibility deserves first-class product treatment

Paperclip makes task ancestry, agent status, budget, current run and history visible.
Masanawa's Ops surface should provide equivalent observability for:
- active Character/AgentStrategy work;
- workflow/task state and blockers;
- attempt/lease holder;
- spend/budget;
- approvals and current authority;
- reconciliation/needs-attention;
- recent failures and recovery evidence.

### 4. Masanawa must keep its stronger authorization model

Current Paperclip source still represents approvals primarily as status-bearing rows
and an open upstream issue (#12482) documents that one approved authorization can be
read by multiple concurrent runs unless a consuming claim is added. Another open issue
(#11852) documents inconsistent persisted run-context validation across checkout and
other issue writes.

Masanawa already has the stronger boundary:
- current AuthorityContext;
- exact ApprovalBinding to principal/resource/action/version/arguments/risk;
- one-time approval consumption for consequential actions;
- Operation identity/idempotency;
- effect receipts and reconciliation;
- fail-closed replay.

Paperclip's task-control mechanics are valuable, but they must be subordinated to these
Masanawa security/effect semantics.

## Clean integration plan

### Phase 4 — now

Use MemPalace as an additional post-freeze memory donor without adding a production
dependency:

1. implement canonical MemoryRecord/MemoryRevision/MemoryScope in TypeScript;
2. persist canonical memory in PostgreSQL;
3. preserve source/verbatim evidence alongside extracted records;
4. make scope authorization explicit before retrieval;
5. add projection metadata including embedder identity/dimension/source hash;
6. implement PostgreSQL lexical/vector/entity/temporal projections incrementally;
7. add cross-scope adapter conformance and held-out retrieval evaluation;
8. add a compatibility/import adapter later only if a concrete interoperability need
   appears.

### Phase 8 / control-plane work — later

Use Paperclip as a behavioral donor:

1. model workflow task claim/lease/attempt state inside `packages/workflows`;
2. normalize wake reasons into canonical workflow/agent run requests;
3. preserve atomic checkout, blockers and stale-attempt adoption;
4. connect attempts to canonical Operation/Approval/Authority evidence;
5. expose budget/run/task ancestry in Ops;
6. keep external runtime adapters behind agent/tool execution ports;
7. do not deploy Paperclip as a parallel control-plane database.

## Admission policy

No source-vault admission is required to use these findings.

If future implementation needs sustained source-level parity tracking, add each project
as an explicit pinned post-freeze reference only after:
- recording the exact revision;
- updating source/feature/behavior/data/integration ledgers;
- proving no canonical ownership changes are implied;
- documenting which acceptance fixtures its behaviors add.

Until then, this document is the evidence-backed candidate boundary and the upstream
repositories remain external references, not dependencies.
