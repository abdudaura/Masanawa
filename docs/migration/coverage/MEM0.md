# Phase 0B Forensic Coverage — Mem0

Pinned revision: mem0ai/mem0@94c3fe9f238f3dbf29c9ce98643bd71eb13077cd

Status: COVERED AT PINNED REVISION

Mem0 is a specialist donor for memory extraction, retrieval/ranking, entity projections, mutation history, expiration and evaluation/provider seams. It is not Masanawa's canonical memory authority. `packages/memory` remains the sole owner of canonical memory records, scopes, revisions, lifecycle and compiled context.

## Descendant capability matrix

| Family | Evidence | State treatment | A/B/C | Canonical destination | Acceptance/parity gate |
|---|---|---|---|---|---|
| Scope construction and identity-key hardening | `mem0/memory/main.py`, `tests/memory/test_session_scope.py`, `tests/memory/test_main.py` | D-MEM-030 / D-MEM-015 | A | packages/memory + security | typed scope inputs are required; caller metadata cannot create/change user/agent/run/actor scope |
| Extraction and fact normalization | `mem0/memory/main.py`, `mem0/memory/utils.py`, `tests/test_memory.py`, `tests/test_chatty_llm_parsing.py` | D-MEM-031 | A/B | packages/memory + providers | provider failure, no-facts, duplicate and persisted outcomes remain distinguishable |
| Hybrid retrieval | `mem0/memory/main.py`, `mem0/utils/scoring.py`, `mem0/utils/lemmatization.py`, scoring/vector tests | D-MEM-032 / D-MEM-021 | A/B | packages/memory/retrieval | semantic + BM25 + entity signals rank only already-authorized candidates |
| Reranking and fallback | `mem0/reranker/**`, `tests/rerankers/**` | ephemeral candidate ranking | A/B | packages/memory/retrieval/providers | reranker failure does not mutate caller candidates and fallback still honors top-k |
| Entity extraction/projection | `mem0/utils/entity_extraction.py`, entity paths in `mem0/memory/main.py`, related tests | D-MEM-033 / D-MEM-018 | B | packages/memory/entity projection | entity index is rebuildable; projection failure cannot widen scope or invalidate canonical memory |
| Mutation history | `mem0/memory/storage.py`, update/delete/history paths in `mem0/memory/main.py`, storage/main tests | D-MEM-034 / MemoryRevision | A/B | packages/memory/revisions + audit | history is appended after successful storage mutation; canonical revisions remain storage-neutral |
| Expiration | Python main/client + `mem0-ts/src/oss/src/utils/expiration.ts` | D-MEM-035 | B | packages/memory | ordinary search/list hides expired records unless explicitly authorized to include; expiry != deletion |
| Temporal behavior | temporal notice/guard paths and tests | validity date only at OSS pin | B/C | packages/memory temporal projection | do not claim unsupported reference-date temporal search; unsupported temporal inputs fail explicitly |
| Python vector stores | `mem0/vector_stores/**`, configs and 30+ store tests | rebuildable projection | B/C | packages/memory/retrieval/providers | adapter failure never changes canonical MemoryRecord truth |
| Python embedders | `mem0/embeddings/**` + tests | provider output | B | packages/providers + memory/retrieval | provider normalized behind canonical registry; embedding is rebuildable |
| Python LLMs | `mem0/llms/**` + tests | provider call | C/B | packages/providers | useful provider behavior only; no competing registry |
| TypeScript OSS core | `mem0-ts/src/oss/src/**` and co-located tests | parallel implementation | B/C | packages/memory/reference + selective reuse | parity deltas may be adopted, but no second memory runtime |
| Self-hosted API/auth/ops | `server/**`, migrations, dashboard | service-local auth/config/log state | C/B | apps/ops + optional compatibility adapter | JWT/API-key/request-log patterns may inform ops; server does not become canonical auth/memory service |
| Agent/framework plugins | `integrations/**` | adapter/plugin local state | C/B | plugins/memory-adapter | integrations cannot own memory scope/identity/lifecycle; flush/spool failure must remain observable |
| CLI, skills and examples | `cli/**`, `skills/**`, `examples/**` | presentation/examples | C/B/C | apps/cli, skills/reference, examples | no authority transfer |
| Documentation/repo automation | `docs/**`, `.github/**`, root metadata | none | C | reference/build | documentation supports evidence only |

## File accounting

`mem0-file-family-manifest.json` accounts for all **1,835** files at the pinned revision with **zero unresolved paths**.

Family totals include:
- 151 Python package files;
- 247 `mem0-ts` files;
- 395 integration/plugin files;
- 185 self-hosted server/dashboard files;
- 106 Python tests;
- 184 examples;
- 359 documentation files;
- all remaining CLI/skills/repository/developer metadata.

## Integration disposition

`mem0-integration-disposition-manifest.json` dispositions **772** integration/provider/server files.

Canonical integration mapping:
- vector stores -> I-MEM-004, rebuildable retrieval projection only;
- embedder/reranker providers -> I-MEM-005;
- self-hosted API/auth/ops compatibility -> I-MEM-006;
- agent/framework plugins -> I-MEM-007;
- LLM implementations -> existing canonical AI-provider ledger families.

Provider/storage failures never grant wider memory visibility. A vector/entity/reranker failure may degrade retrieval but cannot replace canonical persistence or scope authorization.

## Python vs TypeScript authority

The Python OSS implementation is the strongest behavioral evidence for the selected extraction/retrieval pipeline at this pin. The TypeScript OSS implementation is treated as parity/delta evidence, especially for expiration, BM25, storage/history and provider adapter behavior. Masanawa does not create parallel Python and TypeScript memory authorities.

## Temporal correction

Earlier Phase 0A language used “temporal/entity-aware retrieval” broadly. At this pinned OSS revision the implemented temporal behavior is materially narrower than a full temporal engine:
- expiration-date visibility is implemented;
- timestamps/temporal feature notices and guards exist;
- entity-aware ranking is implemented;
- full reference-date/event-time temporal retrieval should **not** be attributed to this OSS pin.

Masanawa's richer `MemoryTemporalProjection` remains a synthesis requirement, not a copied Mem0 feature.

## Merge decision

Adopt strongly:
- identity/scope-key hardening;
- extraction outcome distinctions and robust fact normalization;
- hybrid semantic/BM25/entity ranking after authorization;
- reranker fallback semantics;
- rebuildable entity projection;
- mutation-history ordering;
- expiration distinct from deletion;
- broad provider seams and provider tests as adapter evidence.

Redesign:
- Mem0 user/agent/run scope -> canonical tenant/character/relationship/shared/world MemoryScope;
- vector-store rows -> rebuildable projections over PostgreSQL canonical records;
- SQLite/Supabase history managers -> canonical MemoryRevision + AuditEvent;
- self-hosted API/auth -> Masanawa gateway/security/ops contracts;
- framework plugins -> bounded adapters under canonical plugin policy.

Do not adopt as canonical:
- Mem0 memory object as public domain truth;
- Mem0 entity IDs as authorization;
- vector/graph stores as source of truth;
- self-hosted Mem0 server as Masanawa memory service;
- parallel Python/TypeScript memory runtimes;
- managed-platform benchmark claims as Masanawa acceptance targets.

## Closure

All 1,835 pinned files are classified, integration surfaces are dispositioned, descendant behavior and state authority are mapped, and unresolved items are zero.
