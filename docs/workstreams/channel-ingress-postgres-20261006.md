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

State: CLAIMED.

Last update: 2026-10-06.
