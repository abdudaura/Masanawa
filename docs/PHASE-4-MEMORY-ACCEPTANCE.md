# Phase 4 Memory Acceptance Closure

Status: IN PROGRESS  
Branch: `phase4-memory-acceptance-closure`  
Base merge: PR #35 `5ff2cc4f3b79d725d898ecfe0e92a3600f510a88`

This audit closes Phase 4 only from repository evidence. It does not authorize new
memory architecture.

## Acceptance matrix

| Target | Evidence | Status |
|---|---|---|
| Cross-user / cross-Relationship leakage returns zero records | `adapters/storage/postgres/src/postgres.integration.test.ts` creates two Users and two Relationships and proves exact-scope isolation; `projection.integration.test.ts` and `signals.integration.test.ts` repeat cross-Relationship non-disclosure at retrieval indexes/signals. | PASS |
| Scope authorization precedes every retrieval path | Projection/signal SQL requires explicit `MemoryScopePredicate`; lexical/vector/entity/temporal adapters apply scope predicates before ranking; fusion rechecks scope; hybrid executes inside one read-only REPEATABLE READ transaction. | PASS |
| Private → shared/world/organization promotion requires governed evidence | `packages/memory/src/governance.ts`, `adapters/storage/postgres/src/memory/publication.ts`, and publication integration fixtures require exact source/target resource authority, Operation identity and one-time Approval; source verbatim evidence is not copied. | PASS |
| Correction / supersession preserves prior evidence and current-view semantics | Canonical revision append and `memory.record_links` preserve historical revision/evidence; lifecycle integration fixtures prove supersession and replay. Closure fixture adds explicit retrieval current-view proof. | PENDING CI |
| Extraction retries are idempotent | `packages/memory/src/extraction.ts` fingerprints exact scope/source/extractor identity; PostgreSQL extraction fixtures prove replay reuse, stale fences and bounded retry. | PASS |
| Poison inputs dead-letter without blocking later memory | PostgreSQL extraction fixture dead-letters repeated malformed work while healthy and later jobs continue. | PASS |
| Index deletion/rebuild reproduces the same authorized result set | `projection.integration.test.ts` rebuilds/activates replacement generations and proves authorized result equivalence. | PASS |
| Explicit deletion/tombstone propagates to searchable projections | `tombstone.integration.test.ts` proves lexical/vector/entity/temporal/hybrid/context suppression immediately from canonical tombstone before physical projection cleanup. | PASS |
| Compaction flush cannot widen scope | `reflection-compaction.integration.test.ts` admits flush through extraction custody, reuses harmless schedule drift and conflicts on same-key scope drift; `safeToCompact` is returned only after committed admission/reuse. | PASS |
| Temporal / entity / contradiction retrieval has held-out fixtures | Existing multisignal fixtures cover entity/temporal held-out metrics; closure `acceptance.integration.test.ts` explicitly evaluates corrected-current vs forbidden contradicted predecessor across entity, temporal and hybrid retrieval. | PENDING CI |
| Context compiler respects budgets and maps every rendered item to provenance | `packages/memory/src/context.test.ts` covers deterministic item/token budgets, oversized-item skipping, scope checks and conflicting duplicates; tombstone fixture proves one-snapshot hybrid→context record/revision provenance. | PASS |
| Embedding model/dimension changes cannot silently mix projections | Vector generation compatibility binds provider/model/dimension; multisignal integration rejects wrong dimensions and incompatible model identity before ranking. | PASS |

## Closure gate

Phase 4 may be marked closed only after:
1. the new held-out contradiction fixture passes the complete Foundation CI gate;
2. the matrix has no PENDING/FAIL rows;
3. final closure documentation passes the same gate;
4. the closure PR has no unresolved review threads.

If those conditions pass, the next phase must be recovered from the repository rewrite
plan rather than guessed from donor projects or this audit.
