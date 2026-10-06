# Durable PostgreSQL channel ingress custody — Production Task 097

Owner/window: ChatGPT continuation window / 2026-10-06
Lease acquired under the merged five-minute stale-claim rule.
Branch: `work/channel-ingress-postgres-20261006`
Base: stale PR #311 head `31ea6679e5f51b8b17f2db8b767cc4be065465fd`

## Exact owned paths

- `docs/workstreams/channel-ingress-postgres-20261006.md`
- `adapters/channels/messaging/migrations/0001_ingress_custody.sql`
- `adapters/storage/postgres/src/channels/ingress.ts`
- `adapters/storage/postgres/src/channels/ingress.test.ts`
- `adapters/storage/postgres/src/channels/index.ts`
- `adapters/storage/postgres/src/index.ts`
- `adapters/storage/postgres/src/readiness.ts`
- `adapters/storage/postgres/package.json`
- `pnpm-lock.yaml`

## Explicitly excluded

- webhook parsing/authentication logic
- shared Gateway composition/router
- channel linking/identity work
- outbound provider HTTP edges
- mobile/APK
- production environment/credentials

## Acceptance

- complete batch is admitted atomically in one serializable transaction;
- missing dedupe key stores exact normalized evidence;
- exact key+hash replay returns duplicate;
- key+changed hash aborts the whole batch with no partial insert;
- persisted row stores normalized event evidence, never raw webhook body or secrets;
- store response exactly covers requested canonical batch;
- migration root is part of platform-product readiness;
- workspace dependency + lockfile are updated together.

State: IMPLEMENTED / VERIFICATION PENDING.

## Completed

- adds adapter-owned `channels.ingress_events` durable schema;
- stores only normalized ChannelIngressRecord evidence JSON, not raw webhook bodies or secrets;
- implements serializable whole-batch admission with exact dedupeKey replay identity;
- exact dedupeKey+evidenceHash replay returns duplicate;
- changed evidence under an existing key throws and rolls back the entire batch;
- concurrent insert races reconcile by re-reading the durable winner inside the transaction;
- exact duplicate keys inside one requested batch coalesce; changed in-batch evidence fails before SQL;
- exports the Postgres channel store;
- adds `@masanawa/messaging-channels` as an explicit Postgres workspace dependency and locks it;
- adds the messaging-channels migration root to platform-product readiness;
- transaction-backed tests prove new, duplicate, mixed, whole-batch rollback and empty admission behavior.

Implementation head before handoff: `be349a355205cb1f211b2af25f86924d72be843c`.

Last update: 2026-10-06.
