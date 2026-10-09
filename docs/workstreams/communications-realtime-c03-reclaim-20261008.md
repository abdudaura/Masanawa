# C03 — durable human DM realtime recovery / full Work handoff

Updated UTC: 2026-10-08, C03 recovery window (GPT-6). **PARTIAL_IMPLEMENTATION — NEVER DONE.**
**PR:** https://github.com/Baatiku/masanawa/pull/483 (**draft, unmerged**). Historical source PR: https://github.com/Baatiku/masanawa/pull/473 (**draft, superseded for review, do not merge both**).
**Base main** `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`; **branch** `work/c03-reclaim-realtime-20261008-gpt6`; **last substantive code/contract commit** `ca12fdb6f564f143799d83dba295977b553db47c`; final handoff HEAD is the subsequent PR commit (see PR #483 head for exact latest value).
**Claim/lease:** stale prior C03 #473 last updated 11:20:09Z and rechecked 11:26:40Z (6.5 minutes inactive). Fresh claim was pushed to new branch at `7407bb35bb40aeb3fd8a2764562a33679f197b31`, then the previous 12 immutable source blobs imported at `c369895adcfedaace4c5471a4a0bb56847d1e79a` on top of *newer* main. No old branch force-push, delete, merge, overwrite or duplicated rewrite. Subsequent C03 commits implement fixes. Claim expires after five minutes without a further repository-visible update.

## Requirements and exact ownership
**C03**: M02/M06/M08/M10, N06/N08, Q06/Q08 and J03/J04/J10/J11.
Exact owned paths:
- `packages/talks/migrations/0019_human_dm_realtime.sql` (preserved as from #473) and **new** `packages/talks/migrations/0020_human_dm_cursor_retention.sql`.
- `services/gateway/src/human_dm_realtime/{composition,postgres_repository,service,routes}.ts` and `{realtime,postgres_integration}.test.ts`.
- `apps/mobile/lib/src/messages/realtime/{human_dm_realtime_sync,human_dm_realtime_transport}.dart` and corresponding `apps/mobile/test/messages/realtime/*test.dart`.
- `docs/contracts/HUMAN-DM-C03.md` plus this workstream record.

**Explicitly not owned/not modified**: shared `services/gateway/src/app.ts`, `main.ts`, `mobile_push.ts`; `services/gateway/src/human_messages/**`, `human_contacts/**`; C05 protected local cache/outbox, root Flutter router/navbar/notification/Activity, R14 Firebase plumbing, security/finance-ledger authorities, applied shared schema, workflows, CI/org settings, deployment. This boundary is intentional coordination, not evidence of full product integration.

## Source actually implemented

1. **DB / transactional journal (retained):** migration 0019 adds metadata-only events keyed by tenant/member/event ID, bounded keyset lookup, trigger projection of C02 inserts/edits/deletes/read receipts and C01/profile/account/block access invalidations. Per-tenant advisory transaction lock protects event ordering across slow commits. No body, push token or human contact-book data in journal.
2. **DB / lossless retention (new):** migration 0020 adds account-specific `trimmed_through_id` watermark and a bounded privileged `talks.trim_human_dm_events(tenant,cutoff,limit)` operator function. It holds the emitter's tenant transaction advisory lock, deletes only a safe contiguous event prefix, updates per-member checkpoints atomically and refuses recent/invalid parameters. `PUBLIC` execute is revoked. NOT a scheduled job, NOT run in any DB yet, NOT an approved retention policy.
3. **Gateway service/API (retained + fixed):** `GET /messages/sync` uses the existing session-authorizer composition seam, validates 0..2^63-1 cursor, page/wait bounds, membership/peer/account/block/contact/profile restrictions, and no-store long polling. Watermark and visible rows are now read in a **single SQL statement snapshot**, forcing `resetRequired:true` with a safe checkpoint if the authenticated member's cursor expired. Preserves this flag through the service (the old source incorrectly overwrote it) and revalidates the bearer **after** the DB read before releasing any event metadata.
4. **Flutter isolated realtime client (retained + fixed):** Dio transport uses the canonical session ApiClient; typed cursor/event validation; bounded sync and event de-dup per thread; forced C02 resnapshot; only persist C05-protected cursor AFTER actual projection success; stop stale account streams; cancel foreground polls and retry bounded network failures. Newly treats 401/403 as terminal `authenticationRequired` instead of an infinite retry of an invalid token.
5. **Tests authored (not executed):** TS Fastify service/SQL projection cursor expiry and post-DB token-revocation tests; disposable PG18 two-account event/consent/revoke/trim/resnapshot/restart test; Flutter expiry resnapshot failure/ack and unauthorized-session stop tests in addition to old PR #473 tests.
6. **Contract:** updated `docs/contracts/HUMAN-DM-C03.md` with exact reset payload, ops guard, retention and recovery semantics.

## Missing implementable source / integration blockers (why PARTIAL, not IMPLEMENTED_UNVERIFIED)

- **C01 / C02 schema authority unresolved:** #468 contains contacts and 0016; **#472/#475/#477 independently implement incompatible C02 0017 human-DM schemas, typed routes and idempotency contracts.** Work must select one reviewed C02 contract, absorb good tests/behavior and reject duplicate migration application. This C03 code specifically targets #472's `talks.human_dm_conversations`, `messages`, `reads`, `contact_requests` columns and service.
- **Gateway route unreachable in canonical app:** `services/gateway/src/app.ts` / `main.ts` need semantic merging with R18 #435, C01 #468 and the chosen C02, then C03 `composeHumanDmRealtime` + `registerHumanDmRealtimeRoutes`. A stand-alone Fastify registration test is not running-product proof.
- **Flutter projection/cache not connected:** C05 #474/#476 duplicates exist. One protected per-account cursor store and actual C02 inbox/history projection must implement `HumanDmRealtimeCursorStore` and `HumanDmRealtimeProjection`; no local-only invented message source. The R17/C08 one-owner five-tab integration must attach authenticated human-only Chats, logout/account switch, background/foreground state and typed `/messages` aliases without repurposing private AI `/chats`.
- **R14 push delivery absent:** only masked, membership-validated private event hints after C02 committed send; delivery outbox/FCM token settings/dedupe/mute/deeplink and actual device acceptance needed. Existing R14 #436 owns shared push files; this C03 branch does **not** claim to implement private push.
- **Maintenance scheduling/retention not shipped:** 0020 is a guarded, opt-in SQL function, not a cron or deployed purge. Define policy, approved privileges, backup/rehearsal and monitoring; test reset under actual pruning before scheduling. No arbitrary production deletes.
- **Build/verification not executed:** CI #457 quota/runner incident, connector-only git editing, no approved disposable PG18 instance or Flutter SDK/Android device in this window. These block *verification*, not a permission to claim the missing wiring is already implemented.

## Verification status and exact deferred Work commands

**Actual executable test results: NONE.** GitHub connector file read/write and PR-creation success prove source was pushed, **not** executable correctness. No `pnpm`, `vitest`, `flutter analyze`, `flutter test`, `psql`, two-account E2E, device, provider or CI jobs were executed. CI incident https://github.com/Baatiku/masanawa/issues/457 (representative zero-step runner failures, account quota exhaustion). A missing runner should not be retried repeatedly by this feature window.

From a **fresh local checkout of PR #483**, after merging the *reviewed* C01/C02/C04/C05 contracts into an isolated throwaway integration worktree and applying migration roots to a disposable loopback PostgreSQL 18 `*_test` database:

```sh
pnpm install --frozen-lockfile
pnpm --filter @masanawa/gateway-service typecheck
pnpm exec vitest run services/gateway/src/human_dm_realtime/realtime.test.ts
MASANAWA_C03_ENABLE_DB_TESTS=yes MASANAWA_C03_TEST_DATABASE_URL='postgresql://tester:LOCAL_ONLY@127.0.0.1:5432/masanawa_c03_test' pnpm exec vitest run services/gateway/src/human_dm_realtime/postgres_integration.test.ts
cd apps/mobile
flutter pub get
flutter analyze
flutter test test/messages/realtime/human_dm_realtime_test.dart test/messages/realtime/human_dm_realtime_transport_test.dart
```

Then full Gateway integration/unit/typechecks, all Flutter integration/regression suites, a physically deployed *test* Gateway/PG18 with two real sign-in users (A/B + outsider), edited/deleted message/read receipts, revoked bearer during DB wait, declined contact/mid-stream block, tenant isolation, session/account switching, foreground/background/kill/reconnect, a real cursor older than pruned watermark followed by successful C02 resnapshot, failed resnapshot without cursor ACK, multi-device duplicate/out-of-order highwater and masked notification settings/mute/link; target low-memory Android 1k threads/100k messages, release APK and Firebase/on-device qualification. On an approved test clone also transaction-abort/commit contention and independent retry of pruning; record outcomes at exact HEAD SHAs.

## Data/security/financial/backward compatibility

- C03 does not touch financial ledgers, qualified providers, live public Talk audio or AI conversations. Do not mistake a received sync event for a human message ACK/receipt.
- Schema dependencies: select 0016 C01, ONE 0017 C02, relevant 0018 C04, 0019 C03, 0020 C03 retention. Run existing canonical migration registry/manifest checks and safe backup/restore rehearsal; NEVER edit an already-applied migration, overwrite production schema or publish partial migrations. Existing #473's 0019 is preserved byte-identical.
- Realtime event rows disclose only authenticated member metadata. Access invalidations must still be sent to former members to force cache eviction; account or profile deletion must revoke client storage. SQL trim function's role permissions must be explicitly audited.
- No implementation of push delivery/privacy acceptance until R14 coordination and no mobile acceptance without signed build and session-restoration tests.

## Exact next steps for ONE final ChatGPT Work integrator

1. Check live `main`, #483 HEAD, #473 old HEAD, all five-minute claims/PR changed paths, #457. Confirm no other C03 writer updated in the meantime. Keep both original histories; **do not merge both PRs**.
2. Resolve three C02 divergent contracts (#472/#475/#477) and two C05 (#474/#476) first. Produce a canonical 0017 schema and real typed C02 service; align this branch's C03 query columns, migration references, event/read semantics to that actual selected contract.
3. Apply chosen migrations on disposable PG18 after export/restore rehearsal. Typecheck and run focused TS/PG + Flutter tests, fix concrete failures rather than changing test expectations to fit broken source. Check query authorization and SQL trimming under concurrent sender + pruning transactions.
4. Coordinate shared Gateway composer with C01 #468 and R18 #435, expose actual `GET /messages/sync` with canonical auth; wire C05 protected cursor/projection and C02 UI into R17/C08 final five tabs; authorize R14 FCM masked outbox hints and privacy settings. Complete any additional owned source, with new tests and fixed statuses in PR.
5. Execute real two-device/Android tests, app restart/forced logout and DB retention recovery; record check command/exit/log + tested SHAs. Repair GitHub Actions through #457 once centrally, not every window.
6. Set `VERIFIED_E2E` only with executed authoritative Gateway → Postgres → two-account Flutter readback, offline recovery and negative privacy proof; qualify backup/ops/delivery, then merge in validated dependency order. Otherwise retain draft unmerged and new missing-source list.

## Release gate matrix (this checkpoint)

| Gate | Evidence |
| --- | --- |
| SOURCE_WRITTEN | YES for isolated C03 journal/retention/poll/mobile adapter/tests; **NO for complete integrated C03 feature** |
| LOCAL_TESTED | NO |
| CI_EXECUTED | NO, #457 |
| DB_INTEGRATED | NO |
| APP_INTEGRATED | NO |
| DEVICE_VERIFIED | NO |
| PROVIDER_QUALIFIED | NO, push/FCM not qualified |
| DEPLOYED | NO |
| MERGED | NO |

**Classification remains PARTIAL_IMPLEMENTATION. Do not claim C03 DONE.**
