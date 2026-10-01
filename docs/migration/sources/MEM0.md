# Source Map — Mem0

Pinned: `94c3fe9f238f3dbf29c9ce98643bd71eb13077cd`.

Status: Phase 0B exhaustive coverage complete at the pinned revision. See `docs/migration/coverage/MEM0.md`, `docs/migration/coverage/MEM0-MEMORY-AUTHORITY.md`, `docs/migration/coverage/mem0-file-family-manifest.json` and `docs/migration/coverage/mem0-integration-disposition-manifest.json`.

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
6. preserve available timestamp/expiration metadata for downstream validity handling; richer event-time temporal derivation remains a Masanawa synthesis responsibility.

The ADD-oriented approach intentionally preserves prior contradictory facts rather than destructively replacing them. Masanawa should preserve that history and add explicit supersession/validity state.

## Retrieval

Mem0 combines:
- semantic/vector similarity;
- BM25 lexical matching with normalization/lemmatization;
- entity matching/boosts;
- expiration/validity handling and entity-aware scoring; full temporal-intent/reference-date scoring is not implemented at this pin;
- optional reranking.

The implemented semantic, lexical and entity signals are fused rather than letting an entity signal hard-filter otherwise relevant results. Masanawa may add temporal signals later from its canonical temporal projection.

Masanawa adds a mandatory stage before all of these: canonical scope authorization. Retrieval cannot widen visibility.

## Temporal/entity model

The exhaustive Phase 0B pass tightened the earlier Phase 0A description. Entity extraction/linking and entity-aware ranking are implemented at this pin, and expiration/validity-date behavior is implemented. However, a full reference-date/event-time temporal retrieval engine is **not** present in the pinned OSS implementation and must not be attributed to Mem0.

Masanawa's richer temporal type/event-time/validity model therefore remains a synthesis requirement implemented as rebuildable projections over canonical MemoryRecords, while Mem0 remains evidence for entity projection, expiration and related retrieval mechanics.

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
- semantic + lexical + entity retrieval, with Masanawa-owned temporal projection added separately;
- reranking;
- entity indexing plus expiration/validity behavior; richer temporal indexing remains Masanawa-owned;
- decay/expiration concepts;
- evaluation methodology;
- embedding/vector/reranker provider seams.

Rejected as canonical:
- Mem0 entity IDs as complete authorization;
- vector/graph records as source of truth;
- Mem0 memory object as Masanawa's public domain contract;
- managed Mem0 service as a required runtime.

See ADR-0007 and `docs/migration/MEMORY-ADOPTION-BOUNDARY.md`.


## Phase 0B closure

All 1,835 pinned files are classified with zero unresolved paths. The explicit integration/provider/server disposition manifest covers 772 files. Python OSS core is the strongest behavioral evidence for scope/extraction/retrieval at this revision; the TypeScript OSS tree is parity/delta evidence, not a second canonical runtime.
