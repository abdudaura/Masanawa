# Source Map — Mem0

Pinned: `94c3fe9f238f3dbf29c9ce98643bd71eb13077cd`.

Status: Phase 0A memory deep pass complete.

Mem0 is a specialist memory platform and is selected as Masanawa's primary donor for extraction, hybrid retrieval and memory evaluation—not canonical memory ownership.

## Core scope behavior

The pinned Python core:
- requires at least one of `user_id`, `agent_id` or `run_id`;
- validates/normalizes those IDs;
- strips identity keys from freeform metadata;
- pins identity fields from explicit entity parameters into storage metadata and query filters;
- prevents caller metadata from silently changing scope.

Preserve the anti-scope-confusion behavior, but replace the scope model with Masanawa tenant + character + relationship + explicit shared/world authorization.

## Extraction

The documented current architecture separates write/extraction from read/retrieval:
1. ingest conversation asynchronously after response;
2. retrieve related existing memories;
3. distill ADD-oriented facts;
4. hash-deduplicate and embed;
5. extract/link entities;
6. derive temporal metadata independently.

The ADD-oriented approach intentionally preserves prior contradictory facts rather than destructively replacing them. Masanawa should preserve that history and add explicit supersession/validity state.

## Retrieval

Mem0 combines:
- semantic/vector similarity;
- BM25 lexical matching with normalization/lemmatization;
- entity matching/boosts;
- temporal-intent scoring;
- optional reranking.

The signals are fused rather than allowing temporal/entity signals to hard-filter otherwise relevant results.

Masanawa adds a mandatory stage before all of these: canonical scope authorization. Retrieval cannot widen visibility.

## Temporal/entity model

Useful fields/concepts include event dates, temporal type/state/plan/preference/relationship classification, entity attribution/linking and query-time temporal intent. These become rebuildable projections over canonical MemoryRecords.

## Decay and expiration

Decay is a soft search-time ranking bias driven by recent retrieval/access and does not delete records. Expiration hides a record from ordinary search while preserving it for direct retrieval and possible reactivation.

Masanawa preserves the conceptual distinction among:
- decay/relevance bias;
- validity/expiration;
- tombstone/logical deletion;
- policy-governed physical purge.

## Evaluation

Mem0 explicitly evaluates accuracy together with token cost and latency and provides LoCoMo/LongMemEval/BEAM workflows. Its documentation also warns that managed-platform results include proprietary optimizations.

Masanawa should reuse the evaluation discipline and benchmark shapes, not copy managed-platform scores as acceptance targets. Privacy leakage, provenance correctness, deletion/rebuild correctness and consolidation liveness are additional mandatory metrics.

## Storage/provider architecture

Mem0 has broad embedder, reranker and vector-store abstractions. These are useful implementation donors. Vector/graph stores remain disposable indexes in Masanawa; PostgreSQL canonical records remain authoritative.

## Adoption role

Primary donor for:
- extraction/dedup;
- semantic + lexical + entity + temporal retrieval;
- reranking;
- temporal/entity indexing;
- decay/expiration concepts;
- evaluation methodology;
- embedding/vector/reranker provider seams.

Rejected as canonical:
- Mem0 entity IDs as complete authorization;
- vector/graph records as source of truth;
- Mem0 memory object as Masanawa's public domain contract;
- managed Mem0 service as a required runtime.

See ADR-0007 and `docs/migration/MEMORY-ADOPTION-BOUNDARY.md`.
