# Post-freeze supplemental donor assessment

Status: evaluated, not admitted to the pinned reference vault yet  
Date: 2026-10-01

Phase 0 remains closed at the revisions in `docs/migration/SOURCE-LOCK.md`. This document records a bounded post-freeze assessment requested during Phase 2. It does **not** authorize a second runtime, second source of truth, or direct production dependency.

## Evaluated revisions

| Project | Revision | License | Primary relevance |
| --- | --- | --- | --- |
| MemPalace | `5ea40d30caf0ed2ff6e49623e386a0863b28edaa` | MIT | memory evidence, retrieval/index safety, memory evaluation |
| Paperclip | `8f7baf2f7254cebc7250d775e1e2757269e42666` | MIT | agent/workflow control plane, Ops governance, recovery, sandbox operations |

These revisions are evaluation pins, not runtime dependencies. If either source is formally admitted later, its exact revision must be added through the normal source-lock/provenance/ledger process before implementation evidence is treated as migration evidence.

## MemPalace

### Useful capability

MemPalace has several mature ideas that complement rather than replace Masanawa's existing memory architecture:

- verbatim source retention instead of treating generated summaries as evidence;
- explicit storage-backend contracts and conformance behavior;
- palace/namespace isolation semantics that fail closed when a backend cannot provide the requested isolation;
- embedder model/dimension identity checks so a vector index cannot silently mix incompatible embeddings;
- observable maintenance/index-build outcomes instead of fire-and-forget maintenance;
- temporal knowledge validity and graph-style retrieval;
- resume-safe mining/sweep behavior;
- local/hybrid retrieval evaluation and benchmark discipline;
- MCP/import surfaces that demonstrate useful memory tooling ergonomics.

### Canonical Masanawa destination

Masanawa keeps `packages/memory` as the **sole memory authority**. The clean adoption is:

1. retain canonical scoped memory records, provenance, deletion/retention state and privacy ownership in PostgreSQL behind `packages/memory`;
2. adopt MemPalace-style verbatim evidence references so extracted memory can always point back to immutable/retained source evidence when policy permits;
3. make vector/lexical/entity/temporal indexes rebuildable projections, with an explicit embedder/index identity contract;
4. add backend/index conformance tests that prove tenant/scope isolation and reject unsupported isolation rather than silently degrading it;
5. reuse MemPalace benchmark ideas to evaluate retrieval quality, stale-fact handling and temporal recall;
6. treat any MemPalace process/MCP integration as an optional adapter only, never a canonical memory store.

### Do not import

Do not make Palace/Wing/Room/Drawer identities canonical Masanawa domain identities. Do not introduce Chroma, SQLite or a Python MemPalace service as a second authoritative store. Do not let an MCP write bypass Masanawa scope, authority, provenance, retention or audit rules.

Because Masanawa is a TypeScript/PostgreSQL platform and already has a canonical memory boundary, the preferred path is selective TypeScript reimplementation/adaptation of the useful contracts and tests, not embedding MemPalace as a hidden runtime.

## Paperclip

### Useful capability

Paperclip is a particularly strong operational/control-plane donor. Its current design and roadmap cover areas Masanawa already owns architecturally but has not yet implemented deeply:

- bounded agent runs and run recovery;
- budget/spend controls and hard stops;
- explicit review/approval stages;
- revisioned plans and plan approvals;
- work queues and recurring routines;
- artifact/work-product ownership;
- watchdogs and outcome enforcement;
- governed MCP/app access with per-action policy;
- centrally managed secrets with per-agent access;
- activity history and action attribution;
- multiple human operators;
- sandbox/cloud execution providers and isolated workspaces;
- agent evals, skill version history and restore;
- document comments/revisions and operator search;
- multi-model/multi-harness execution;
- extensive lifecycle, runner-recovery, browser E2E and release-smoke testing.

### Canonical Masanawa destination

Paperclip must remain a donor behind Masanawa's already-frozen authorities:

- `packages/workflows`: durable run/task/queue/recovery semantics;
- `packages/agents`: bounded agent-run lifecycle, never Character identity;
- `packages/security`: budget/approval/secret/access policy;
- `packages/tools` and `packages/plugins`: governed MCP/app actions;
- `packages/skills`: revision/test/restore ergonomics;
- `packages/telemetry`: activity attribution and operator-visible run evidence;
- `services/ops` + `apps/ops`: control-plane UX for reviews, budgets, recovery, artifacts and diagnostics;
- adapters: sandbox/workspace/provider integrations.

Microsoft Agent Framework remains the durable workflow donor selected by ADR-0008, OpenClaw remains a bounded runtime/channel/steering donor, and Masanawa's Operation/current-authority/reconciliation contracts remain the source of truth for consequential effects. Paperclip can materially improve those implementations without replacing them.

### Do not import

Do not add Paperclip's company/task database as another workflow authority. Do not route Masanawa agents through a separate Paperclip runner/control plane. Do not duplicate approvals, users, secrets, memory connectors, task states or audit history. Do not let its operator UI write canonical tables directly.

Direct reuse of isolated low-level modules is acceptable only after a source-lock/ledger review proves the module has no hidden dependency on Paperclip's own control-plane truth. Otherwise preserve the behavior and implement it inside the canonical Masanawa package.

## Clean adoption path

1. **Keep Phase 2 moving.** Neither donor blocks the current Foundation closure.
2. **Paperclip delta pass before deep agent/workflow/Ops implementation.** Map only capabilities that improve existing Masanawa owners; produce source-map/ledger deltas instead of importing Paperclip wholesale.
3. **MemPalace delta pass before deep memory implementation.** Add retrieval evidence/index identity/evaluation requirements to the existing memory acceptance plan without changing memory ownership.
4. **Pin only after admission.** If code-level reference is needed, add exact source pins and provenance through the repository's existing source-lock process. Do not silently add an untracked donor runtime.
5. **Acceptance before adoption.** Every retained capability needs Masanawa tests proving tenant isolation, authorization, idempotency/recovery, privacy and observability where applicable.

## Decision

Both projects can improve Masanawa substantially, but the clean integration is **selective bounded adoption into existing canonical subsystems**, not merging their top-level applications into Masanawa.

Paperclip has the strongest near-term value for the agent/workflow/Ops control plane. MemPalace has strong later value for memory evidence, retrieval quality and derived-index safety. Neither changes the one-system ownership decisions already recorded in ADR-0007/ADR-0008.
