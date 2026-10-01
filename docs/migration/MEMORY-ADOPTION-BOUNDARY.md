# Memory Adoption Boundary — Letta + Mem0 + N.E.K.O + OpenClaw

Pinned comparison: 2026-10-01. See ADR-0007.

## Decision summary

Masanawa does not adopt a donor memory system wholesale. `packages/memory` owns the canonical record, scope, lifecycle, authorization, persistence and context-compilation contracts.

| Concern | Primary donor | Secondary donor | Masanawa boundary |
|---|---|---|---|
| Cognitive lifecycle | N.E.K.O | OpenClaw | typed scoped records + evidence-backed promotion |
| Working/core context | Letta Code | N.E.K.O | bounded compiled blocks, never identity truth |
| Extraction | Mem0 | N.E.K.O | idempotent async candidate pipeline |
| Retrieval/reranking | Mem0 | N.E.K.O/OpenClaw | authorization first; hybrid signals second |
| Entity/temporal indexing | Mem0 | N.E.K.O | rebuildable projections |
| Reflection/consolidation | N.E.K.O | OpenClaw/Letta | evidence-backed candidate lifecycle |
| Action-sensitive memory | OpenClaw | N.E.K.O | authority/expiry/prohibition metadata |
| Shared memory | Letta Code | OpenClaw | explicit scope only; never implicit relationship sharing |
| Conflict/revision handling | Letta Code | N.E.K.O | canonical DB revisions + idempotent workers |
| Evaluation | Mem0 | N.E.K.O tests | privacy + accuracy + cost + latency + liveness |

## Forensic findings

### Letta

At the pinned baseline, `letta-ai/letta` is a landing repository and explicitly points current development to `letta-ai/letta-code`. It must not be described as the active server implementation.

Letta Code demonstrates:
- always-visible `persona`/`human` memory blocks with read-only controls;
- a larger per-agent memory filesystem;
- explicit memory-size/tree constraints;
- serialized harness-owned writes with process-aware leases;
- conflict/invalid-history repair guarded by compare-and-set attempt tokens;
- git-backed revision/sync semantics;
- recall through a forked subagent;
- attached/shared repositories whose skill visibility is explicit rather than inferred from leftover local directories.

Useful behavior: bounded core context, editable/revisioned durable memory, concurrency/conflict discipline and explicit shared attachments.

Rejected boundary: agent ID, local filesystem, git checkout or Letta Cloud repository cannot define Masanawa privacy scope or canonical persistence.

### Mem0

The pinned Mem0 core validates and pins `user_id`, `agent_id` and `run_id` into query/storage scope and strips identity keys from caller metadata. This is a useful anti-scope-confusion pattern, but Masanawa needs richer tenant + character + relationship + shared/world authorization.

The documented extraction architecture uses asynchronous extraction, related-memory lookup, ADD-oriented facts, hash deduplication, embeddings, entity linking and temporal metadata. Retrieval combines semantic, BM25, entity and temporal signals. Evaluation explicitly tracks accuracy, context-token cost and latency.

Useful behavior: extraction/retrieval algorithms, temporal/entity metadata, reranking, expiration/decay semantics, vector/provider abstractions and benchmark harness ideas.

Rejected boundary: vector/graph stores are not canonical truth; Mem0 scope identifiers are not sufficient authorization; managed-platform benchmark numbers are not Masanawa acceptance claims.

### N.E.K.O

N.E.K.O remains the strongest cognitive-lifecycle donor:
- bounded working/recent/raw/fact/reflection/persona layers;
- newest-turn preservation during compression;
- fact deduplication and absorbed archival;
- evidence-backed, retry-idempotent reflections;
- promotion/merge into durable persona knowledge;
- explicit hybrid recall distinct from injected persona;
- embedding-failure fallbacks;
- replayable background work, poison-input liveness and dead-letter behavior;
- proactive-state/repetition controls.

Rejected boundary: per-character files/storage cannot represent Masanawa's private user↔character relationship isolation.

### OpenClaw

OpenClaw contributes:
- action-sensitive memory metadata and prohibitions;
- memory flush before compaction/context loss;
- consolidation/dreaming concepts;
- provenance-rich memory views/engines;
- explicit memory authority rules from ADR-0004.

Rejected boundary: workspace Markdown, session files and pluggable memory engines remain projections/compatibility surfaces, never canonical memory truth.

## Canonical ownership rules

1. Scope/authorization precedes extraction lookup and retrieval.
2. Private relationship memory cannot be promoted to shared/world truth without an explicit governed transition.
3. Contradictory facts are versioned/superseded; history is not silently destroyed.
4. Evidence and provenance survive reflection/consolidation.
5. Working context is a compiled view, not the durable store.
6. Vector, lexical, graph and temporal indexes are disposable/rebuildable.
7. Expiration, tombstone and physical purge are distinct operations.
8. Automatic recall and explicit recall use separate policy gates.
9. Retrieval quality never overrides privacy.
10. Donor code remains behind `packages/memory`; no donor memory object becomes a platform contract.

## Phase 0B acceptance fixtures to create later

- cross-user relationship leakage must return zero records;
- private→shared/world promotion requires explicit policy evidence;
- contradictory fact timeline preserves both evidence chains and selects the valid/current view;
- extraction retries are idempotent;
- poison inputs dead-letter without blocking later memory;
- index deletion/rebuild produces the same authorized result set;
- explicit deletion removes all searchable projections;
- compaction flush cannot widen scope;
- temporal/entity queries have benchmark fixtures;
- context compiler respects token budget and cites record provenance.
