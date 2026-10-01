# @masanawa/memory — canonical boundary

Status: architecture selected in Phase 0A; implementation intentionally deferred until Phase 0 closes.

This package is the **only canonical Masanawa memory boundary**.

It will own:
- MemoryRecord / MemoryScope contracts;
- PostgreSQL persistence and revisions;
- provenance/evidence;
- extraction/consolidation lifecycle;
- authorization-aware retrieval;
- bounded context compilation;
- retention/expiration/tombstones;
- rebuildable vector/lexical/entity/temporal projections;
- memory evaluation hooks.

It must not expose donor-native Letta, Mem0, N.E.K.O or OpenClaw memory objects as platform contracts.

See:
- `docs/adr/0007-memory-architecture-adoption-boundary.md`
- `docs/migration/MEMORY-ADOPTION-BOUNDARY.md`
- `docs/SOURCE-OWNERSHIP.md`

No production implementation should begin here until Phase 0 donor coverage/classification is complete.
