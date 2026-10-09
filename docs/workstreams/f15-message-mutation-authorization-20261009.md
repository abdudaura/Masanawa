# F15 C02: atomic human-message edit/delete authorization

**2026-10-09 — ACTIVE five-minute exact-path recovery lease, DRAFT/UNMERGED.**

- Existing implementation: [C02 draft #472](https://github.com/Baatiku/masanawa/pull/472), branch `work/c02-durable-human-dm-20261008`. Preserve competing #475 for later semantic review; do not apply its duplicate 0017 migration.
- Fresh claim: [issue #550 renewal comment](https://github.com/Baatiku/masanawa/issues/550#issuecomment-6072650649). Prior branch head at claim: `c60f16ba4733eae1d8ecd28ad7677a87332383d2`; main observed `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Claimed exact paths only: `services/gateway/src/human_messages/postgres_repository.ts`, `services/gateway/src/human_messages/postgres_repository.test.ts`, `services/gateway/src/human_messages/postgres_integration.test.ts`, this handoff file.
- Scope: remove time-of-check/time-of-use gap from authenticated message edit and tombstone/delete. A previously allowed actor must not mutate a message after an account becomes inactive, a contact is declined, another participant blocks, or a profile is restricted. Preserve sender ownership, tenant isolation, edit window, tombstones, repeat-safe deletion and existing error mapping.
- Shared contracts: C01/C02; requirements J03/J10/J11. No new migration/route; no ownership of `app.ts`, `main.ts`, five-tab Flutter root, Firebase, ledger or production.
- Verification status pending: do not infer successful gateway, database or Android integration from branch source.

## Checkpoint

Claim visible before source modification. Final code SHAs, executed tests, blockers and Work handoff will be written below before PR checkpoint.
