# J13 — retry-safe Gwani appeal after a moderated decision

Source-only continuation of existing [PR #628](https://github.com/weavewellindustrieslimited/masanawa/pull/628). This adds no second case, money, notification or worker authority.

## Acceptance: fan → Gwani case → staff → appeal → reversal

1. An authenticated fan files a visible-source report with `clientRequestId`; PostgreSQL's existing case unique key preserves one report. The fan reads the case and event timeline.
2. Gwani proposes a compatible action; qualified staff provide one or two independent reviews. The existing `events.outbox` worker applies it only when the existing enforcement flag, lease, and policy allow. No activation in this PR.
3. Once actioned, dismissed or closed, the same reporter files an appeal with a 128-character-or-shorter `clientRequestId`. Gateway derives tenant/fan from trusted auth, validates reason and key. PG locks the existing case row and records the appeal/event once.
4. On transport timeout, the Flutter detail screen retains the key and retries the same appeal body. A matching replay returns `{accepted:true}` without a second DB row, timeline event, approval/reversal or outbox message. Reusing the key with a different reason returns 409; a new key while pending returns 409. Wrong reporter/tenant is denied.
5. Staff review through the existing Admin moderation UI. Two separate reviewers uphold and the existing `events.outbox` reversal worker remains sole enforcement authority. Real provider, native-device and worker dispatch verification are release gates, not claims here.

## Code and executable gates

- Contract/API: `services/gateway/src/modules/moderation/{service,routes}.ts`
- Historical-data-safe migration: `packages/moderation/migrations/0002_appeal_idempotency.sql` (nullable column for older rows, partial tenant+case+appellant+key unique index).
- Existing canonical PG transaction: `adapters/storage/postgres/src/moderation/repository.ts`; existing worker remains unchanged.
- Consumer: `apps/mobile/lib/src/features/gwani/{cases_api,cases_screen}.dart`; existing Admin appeal screen reused unchanged.
- Tests: `services/gateway/src/modules/moderation/service.test.ts`, `adapters/storage/postgres/src/moderation/repository.integration.test.ts`, `apps/mobile/test/features/gwani/appeal_retry_test.dart`.

Commands on pinned branch SHA when a runner can check out private repository:
```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm exec vitest run services/gateway/src/modules/moderation/service.test.ts
MASANAWA_TEST_DATABASE_URL=<disposable-local-PG18-URL> pnpm exec vitest run adapters/storage/postgres/src/moderation/repository.integration.test.ts
cd apps/mobile && flutter pub get && flutter analyze && flutter test test/features/gwani/appeal_retry_test.dart && flutter build apk --debug
cd ../admin_mobile && flutter pub get && flutter analyze && flutter test
```
Do not run PG tests against Railway/shared/production. Confirm the root importer, then AF00 must register new migration via the *existing* `platformProductMigrationRoots()` once and compose the existing J13 gateway/worker/Flutter routes. Review package/lockfile importers and execute J13 HTTP + PostgreSQL fresh/upgrade/checksum on a restored disposable snapshot. Do not deploy or merge to `main` before the separately documented release gates.
