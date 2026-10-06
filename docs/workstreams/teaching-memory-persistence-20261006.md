# Core Teaching durable Memory persistence

Status: CLAIMED — 2026-10-06
Branch: `work/teaching-memory-persistence-20261006`
Base: `work/integration-core-teaching-20261004` / PR #96

## Ownership

Owned paths only:
- `adapters/storage/postgres/src/teaching/**`
- `docs/workstreams/teaching-memory-persistence-20261006.md`

No Gateway/router/mobile/channel/shared export/migration/production-environment edits.

## Goal

Implement PR #96's `TeachingProgressPort` using the existing canonical PostgreSQL Memory tables with:
- Relationship-private scope;
- exact SkillVersion binding;
- atomic attempt + resulting-progress persistence;
- RequestId replay detection;
- changed-payload conflict rejection;
- first-write/concurrent-writer serialization without a new Teaching table or migration.

Use PostgreSQL transaction-scoped advisory locking to prevent duplicate first-write progress records for the same Tenant + Relationship + SkillVersion.