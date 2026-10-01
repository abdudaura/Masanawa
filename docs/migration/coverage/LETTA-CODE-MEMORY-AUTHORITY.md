# Letta Code Memory Authority Map

Status: COMPLETE FOR PHASE 0B

Letta Code is a strong donor for memory mutation, revision/conflict handling, shared-memory attachment and working-context behavior. Its Git/filesystem implementation is not Masanawa's canonical storage model.

| Letta Code state/mechanism | Evidence | Masanawa owner | Treatment |
|---|---|---|---|---|
| primary memory checkout | src/agent/memory-filesystem.ts, memory-git.ts | packages/memory | replace with scoped PostgreSQL-backed MemoryRevision/Record model; Git only donor behavior evidence |
| memory writer operation lock | memory-operation.ts | memory/workflows | retain lease semantics as D-MEM-020 |
| conflict/invalid-history repair marker | memory-conflict-repair.ts | memory/workflows | retain token/CAS stale-worker protection as D-MEM-021 |
| Git commit/rebase/merge lineage | memory-git.ts, worktree.ts | memory revisioning | retain immutable revision ancestry/conflict semantics; storage-neutral |
| memory constraint config and hook | memory-constraints.ts | memory/ops/security | retain bounded layout/size policy and explicit approval to relax constraints |
| unattended worker confinement | memory-confinement.ts, permissions/* | memory/security | retain fail-closed sandbox and own-scope path checks |
| shared/attached repositories | shared-memory skills + turn cleanup tests | packages/memory | map to AttachedMemoryScope with explicit read/read_write and owner/scope authorization |
| background memory worker worktree | subagent memory worker | workflows + memory | isolated mutation proposal branch; merge/admission controlled by canonical memory service |
| client memory_updated event | websocket turn cleanup | memory/events | emit only from canonical MemorySyncReceipt / committed revision state |
| context compaction | backend/local/compaction.ts | agents/context + memory | working-context projection only; never delete durable memory implicitly |
| local context estimator | backend/local/local-context-estimate.ts | agents/context | bounded estimation input for compiler; not memory authority |
| memory CLI/viewer | CLI/web memory viewer | apps/ops/client projection | presentation only |
| conversation record/history | backend/conversation* + websocket runtime | conversation/agents/gateway | Letta conversation object is not canonical Masanawa relationship/session identity |
| attachment policies | Slack/WhatsApp attachment code | gateway/knowledge/security | retain admission/path/recipient behavior; attachment content enters knowledge/memory only through explicit ingestion policy |

## Canonical rewrite model

Masanawa memory mutation should follow:
1. authorize subject/scope and current policy;
2. acquire MemoryMutationLease for the affected partition/revision;
3. read current revision and construct candidate changes;
4. validate scope, constraints, provenance and retention rules;
5. commit immutable MemoryRevision plus affected MemoryRecords transactionally;
6. if optimistic revision changed, create conflict evidence and reconcile/repair against the new head;
7. emit MemorySyncReceipt and downstream events only after canonical commit succeeds;
8. rebuild vector/entity/temporal projections asynchronously.

Git may still be used as an optional export/debug representation, but never as canonical storage authority.

## Shared memory rule

Attached/shared memory is a separately authorized scope. Read permission does not imply write, and write permission does not imply permission to promote content into Character/world canon. Private relationship memory cannot be attached or exposed by convenience alone.

## Working context rule

Letta compaction and memory files inform how to build bounded working context, but WorkingContextProjection is ephemeral. Compaction never mutates or deletes canonical MemoryRecords unless a separate retention/consolidation workflow explicitly does so.
