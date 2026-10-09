# F16/C03 — Immediate expired-cursor recovery (2026-10-09)

**Status:** PARTIAL_IMPLEMENTATION. This is a bounded C03 correctness repair on existing **draft, unmerged PR #483**, not a separate realtime implementation or integration approval.

## Ownership and immutable handoff

- Exact claim, posted **before** source edits: [#558](https://github.com/Baatiku/masanawa/issues/558), renewable five-minute lease.
- Current main inspected: `5e758673ae91082520b21b3153da53791ae2cbf3` (2026-10-09). Existing #483 started at `65c91bb239f9f8e9bf177a1f707f98c7fa391e78`; do not force rebase and erase history.
- Code+test checkpoint **`f541448c4f3607247a9d9c52ff922933a50331ba`**; branch `work/c03-reclaim-realtime-20261008-gpt6` (PR #483). Post-checkpoint handoff commit is documentation-only.
- Exact owned source paths: `services/gateway/src/human_dm_realtime/service.ts` and `services/gateway/src/human_dm_realtime/realtime.test.ts`. This handoff file is the third owned path. Post-checkpoint source blobs: `83f602523ef2168dc5ff22fdfe53a2c3e7e9359f`, `15b02af18c4160c3caac36ed9dd1f01fb702ba2a`.
- No `retention.ts` changes (stacked #486), no migration/composer/router/native/Firebase/ledger/CI/provider/production changes. Historical #473 and concurrent C05 and C02 alternatives remain preserved for review.

## Real behavior and safety

1. The C03 long poll now returns `resetRequired=true` as soon as the authenticated member's PostgreSQL cursor is below the per-account retention watermark; it no longer sleeps up to a 15-second deadline when the event page is empty. The caller must fetch a fresh authorized C02 snapshot before C05 can advance its protected cursor.
2. Session authorization is still checked *after* the database read, even on this immediate-return branch, before disclosing the watermark or event metadata. Revoked sessions receive an authorization error.
3. The same service's anonymous destructuring was explicitly typed through `Parameters<HumanDmRealtimeService["sync"]>[0]` because strict isolated TypeScript compilation identified implicit-any parameters; this is a source typing fix, not a contract alteration.
4. Added two realistic Vitest regressions to the existing C03 suite: immediate reset without any polling/sleep; and in-flight session revocation preventing return of the reset checkpoint. No fake delivery/read/receipt.

## Executed checks (2026-10-09)

- Read back exact source and test blobs from GitHub after pushing. `git hash-object` of a local copy of the complete **exact committed** `service.ts` equals `83f602523ef2168dc5ff22fdfe53a2c3e7e9359f`.
- Isolated `tsc --strict` of this **exact** source passed under TypeScript 5.8.3, Node 22.16.0, using source-compatible minimal `PlatformSessionIdentity` and `HumanDmRealtimeRepository/SyncPage` type stubs (not the full real workspace types). Initial isolated compile found existing implicit anys, fixed at the checkpoint.
- Three **PASS_SIMULATED** Node runtime assertions using the compiled exact service source and fake repository/authorizer: one-read/no-sleep immediate reset + final reauthorization, revoked token denies checkpoint, and valid/overflow cursor boundaries. This does **not** prove PostgreSQL or live bearer correctness.
- PR diff `65c91bb..f541448c`: exactly two source/test paths, +44 test lines and source guard/typing additions.

## NOT RUN / blocking facts

- Actual Vitest tests (including the two committed cases), full Gateway `tsc`/typecheck, real authenticated Fastify request, real disposable Postgres migration/retention concurrency, Flutter analyzer/tests, Android A/B/restart/offline, true Firebase push, CI runner and integrated backend/provider were **NOT executed**. Git HTTPS private checkout unavailable in isolated container (DNS failure for github.com), no pnpm, PostgreSQL or Flutter SDK. Shared Actions capacity incident [#457](https://github.com/Baatiku/masanawa/issues/457) is not a source-code PASS.
- Unmerged canonical C01 #468 and **one** approved C02 migration (#472 vs #475), C03 #483/#486, C04 #478, C05 #474/#476, R14/F10 and F12 router plus Work #497 must still be semantically composed; full J03/J04/J10/J11 real two-account E2E remains open. Do not mark F16 DONE or merge on these isolated checks.

## Exact verification for integration owner

From reviewed, reconciled C01+C02+C03 branch with complete lockfile/dependencies, run:

```sh
pnpm install --frozen-lockfile
pnpm --filter @masanawa/gateway-service typecheck
pnpm exec vitest run services/gateway/src/human_dm_realtime/realtime.test.ts services/gateway/src/human_dm_realtime/postgres_integration.test.ts
# Only with approved disposable PostgreSQL 18 test database and reviewed migration order 0016 -> 0017 -> 0019 -> 0020
MASANAWA_TEST_DATABASE_URL=<disposable-only-url> pnpm exec vitest run services/gateway/src/human_dm_realtime/postgres_integration.test.ts
cd apps/mobile && flutter analyze && flutter test test/messages/realtime/
```

Then inspect actual A/B auth and person membership, 15s concurrent long polling, pruned checkpoint=>fresh protected C02 snapshot=>persisted C05 cursor, network disconnect, revoked/blocked member, account switch/restart/offline, retention/read consistency, low-end device. Revalidate complete source at integration SHA and keep #486 retention owner in sync with the #483 parent branch. No production purge/release or customer fund action was performed.
