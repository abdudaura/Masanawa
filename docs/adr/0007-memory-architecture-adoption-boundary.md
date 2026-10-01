# ADR-0007 — Canonical memory architecture and donor boundary

Status: Accepted  
Date: 2026-10-01  
Phase: 0A

## Context

Masanawa needs one memory system for persistent fictional characters, private user↔character relationships, shared character knowledge, governed world truth, tasks and embodied/realtime sessions. The system must preserve provenance and privacy before retrieval quality is considered.

The pinned comparison covers:
- Letta Code `3687ea51f6d11eabc4ad7a7b163c649d023801ba`;
- Letta landing repository `5bcdd177d70fa2b31a754cfcd801e77b2e1ab16a`;
- Mem0 `94c3fe9f238f3dbf29c9ce98643bd71eb13077cd`;
- N.E.K.O `48ac9243a9d8e75a37d7598548c29017df1c6d2e`;
- OpenClaw `83e4755b55e8864e48348f3eb2364ee3e5f0fb54`.

The pinned Letta server repository is now a landing/historical repository; current implementation evidence is therefore taken primarily from Letta Code.

## Decision

`packages/memory` is the sole canonical memory authority.

No donor runtime, filesystem, vector database, graph database, workspace, prompt block or agent object owns Masanawa memory truth.

### Structural ownership

Masanawa owns a typed `MemoryRecord` plus immutable provenance/evidence and an explicit `MemoryScope`. Every durable record is stored in canonical PostgreSQL state before any derived retrieval index is authoritative.

Required scope dimensions include:
- organization/tenant;
- character;
- relationship (user↔character private scope);
- explicit shared-character scope;
- world scope;
- task/session/run scope where applicable.

A record may never become visible in a broader scope merely because semantic retrieval finds it. Authorization and scope filtering happen before candidate retrieval and again before context compilation.

### Donor roles

**N.E.K.O — primary cognitive-lifecycle donor.** Preserve/adapt its bounded working context, recent-memory compression, chronological journal, atomic facts, evidence-backed reflections, idempotent reflection identity, absorbed-fact archival, promotion/merge lifecycle, liveness/dead-letter behavior, explicit recall and proactive recall separation.

**Mem0 — primary retrieval/extraction/evaluation donor.** Adapt its ADD-oriented extraction, related-memory lookup, deduplication, embeddings, BM25/lexical signal, entity linking, temporal metadata, multi-signal fusion/reranking, decay/expiration concepts, provider abstraction and benchmark discipline. Its `user_id/agent_id/run_id` filters are inputs to an adapter, not Masanawa authorization.

**Letta Code — working-context and durable editable-memory donor.** Adapt the distinction between always-visible memory blocks and larger durable memory, bounded core-memory constraints, explicit read-only blocks, recall subagent patterns, serialized writes, conflict repair and revisioned/git-like memory change semantics. Do not adopt agent-owned filesystem/git repositories as canonical storage.

**OpenClaw — action-sensitive/compaction/provenance donor.** Preserve action-sensitive memory metadata, compaction-before-loss flush, provenance-rich recall and consolidation/dreaming concepts. Do not adopt workspace Markdown or a pluggable memory engine as canonical authority.

**ChatWithStars — privacy/domain invariant donor.** Its relationship/private/shared/world separation remains mandatory and outranks donor retrieval convenience.

## Canonical record model

The Phase 0 implementation target behind `packages/memory` must represent at least:

- stable record ID and revision;
- memory type (observation/fact/event/state/preference/relationship/plan/reflection/procedural/summary/prohibition or later normalized equivalent);
- explicit scope and visibility;
- subject/entity references;
- content plus structured payload where appropriate;
- source event/message/artifact IDs;
- evidence/provenance set;
- confidence and extraction method/model version;
- event time, observed time, valid-from/valid-to and optional expiry;
- lifecycle state (active/superseded/absorbed/expired/tombstoned);
- action-sensitivity metadata (authority, safe-to-act condition, prohibition, expiry);
- created/updated/revision metadata.

Embeddings, lexical documents, entity edges, temporal search projections and graph/vector indexes are rebuildable projections. They are never the source of truth.

## Write lifecycle

1. Accept a source event only after canonical identity/scope resolution.
2. Persist source/provenance and enqueue extraction idempotently.
3. Extract candidate memories without broadening scope.
4. Compare/deduplicate within the authorized scope.
5. Append a new record/revision; do not silently overwrite contradictory history.
6. Build/update derived retrieval projections asynchronously.
7. Create reflection/consolidation candidates from evidence.
8. Promote/merge only under deterministic scope and provenance rules.
9. Archive/supersede/tombstone without losing audit evidence required by policy.

Extraction failure must not block the conversational response. Poison inputs must be bounded/retried/dead-lettered rather than stalling memory progress.

## Read/context lifecycle

1. Resolve caller, tenant, character, relationship and purpose.
2. Compile an authorization predicate before search.
3. Search only eligible scopes using semantic + lexical + entity + temporal signals.
4. Rerank with recency/decay and task relevance without overriding authorization.
5. Exclude expired/tombstoned records by default.
6. Compile a bounded context with citations/provenance.
7. Keep always-visible working-context blocks separate from retrieved durable memory.
8. Record retrieval evidence/quality telemetry without making retrieval frequency canonical truth.

Automatic/proactive recall and explicit user/tool recall are separate policy paths.

## Deletion and retention

Expiration is reversible visibility policy; tombstoning is a durable logical deletion state; physical purge is a policy-governed operation. Deletion must propagate to rebuildable indexes and caches. Shared/world promotion does not erase the private source record or its provenance, and private source text must not leak into shared projections.

## Evaluation

Memory acceptance must measure at least:
- scope/privacy leakage rate (target: zero);
- extraction precision/recall and duplicate rate;
- retrieval accuracy by semantic/entity/temporal/contradiction categories;
- stale/superseded-memory error rate;
- provenance/citation correctness;
- context tokens per query;
- p50/p95 retrieval latency and cost;
- deletion/index-rebuild correctness;
- reflection/consolidation liveness.

Mem0 benchmark methodology is a donor for measurement, not a claim that its managed-platform scores transfer to Masanawa.

## Direct reuse boundary

Allowed behind adapters when licensing and dependency review pass:
- isolated Mem0 OSS algorithms/components or provider adapters that do not own canonical state;
- narrowly scoped Letta/OpenClaw interoperability clients if a future integration requires them.

Default approach:
- reimplement/adapt memory domain, persistence, authorization, lifecycle and context compiler in Masanawa TypeScript/PostgreSQL;
- use pgvector/PostgreSQL search initially unless evidence justifies another projection store;
- keep donor repositories reference-only.

## Consequences

There is one memory API and one persistence authority. Donor-specific memory objects never escape adapters. Retrieval infrastructure can be replaced or rebuilt without changing canonical memory identity. Character identity remains authored/versioned domain truth, not learned memory. World truth remains governed world state, not a high-confidence memory.
