# U05 — Opt-in agent memory / five-minute ownership

**Claimed 2026-10-09 (Africa/Lagos), window GPT-6.** Base main `5e758673ae91082520b21b3153da53791ae2cbf3`. Branch `work/u05-opt-in-agent-memory-20261009-gpt6`. Status: IN PROGRESS / NOT VERIFIED / NOT MERGED.

## Bounded exclusive paths
- `services/gateway/src/operator_memory/**`: bounded, authorized memory adapter and isolated route module / tests.
- `apps/mobile/lib/src/operator_memory/**`: private Manage memory screen/controller/transport and tests (no root router edits).
- This handoff file only. No `packages/memory/src/index.ts`, `main.ts`, `app.ts`, financial ledger, Firebase, migrations registry or root Flutter router.

## Coordination
U01 #519 operator contract and U02 draft branch are existing upstream; the canonical `@masanawa/memory` PostgreSQL repository/governance and governed scope authority are mandatory. Never fabricate per-user mapping from tenant organization, character ID or exposed client scope. Existing Work #497 / finance / C/R integration remain independent. Five-minute exact-path ownership rule applies; inspect other changes before any conflicting write. A stale lease does not permit overwriting unmerged source.

## Initial objective
Explicit opt-in, consented remember/list/correct/forget, TTL/provenance, no full human DM/audio ingestion; private account-scoped UI. Defer shared Gateway composition to integrator. Preserve source-vs-test-vs-device distinctions in final handoff.
