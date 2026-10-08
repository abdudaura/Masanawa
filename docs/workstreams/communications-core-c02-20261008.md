# C02 — Durable human-to-human messaging (2026-10-08)

**Owner:** independent C02 implementation window. Branch `work/c02-durable-human-messages-20261008`, based on canonical main `5d19afc952b3dcabd18ee8f8d1c3ad13b72e6762`.
**Lease:** claim effective at this repository-visible commit under the five-minute fresh-activity rule of `docs/MULTI-WINDOW-WORK.md`.

## Claimed exact files (no shared composer/router)
- `packages/talks/migrations/0017_human_dm_conversations.sql`
- `services/gateway/src/human_messages/model.ts`
- `services/gateway/src/human_messages/postgres_repository.ts`
- `services/gateway/src/human_messages/service.ts`
- `services/gateway/src/human_messages/routes.ts`
- `services/gateway/src/human_messages/service.test.ts`
- `services/gateway/src/human_messages/postgres_repository.test.ts`
- `services/gateway/src/human_messages/postgres_integration.test.ts`
- `apps/mobile/lib/src/messages/human_messages_transport.dart`
- `apps/mobile/lib/src/messages/human_messages_controller.dart`
- `apps/mobile/lib/src/messages/human_conversation_screen.dart`
- `apps/mobile/test/human_messages_transport_test.dart`
- `apps/mobile/test/human_messages_controller_test.dart`
- `apps/mobile/test/human_conversation_screen_test.dart`
- `docs/workstreams/communications-core-c02-20261008.md`

## Owner & API boundaries
C02 depends on C01 contact policy tables from **draft #468**, not on AI/private character threads. Migration 0016 is reserved by C01, migration 0015 by R18 #435; C02 exclusively uses 0017. **Do not edit** shared `services/gateway/src/app.ts`, `main.ts` (conflicts between #468/#435), session infrastructure, R14 event fan-out, finance, or Flutter shared shell. Composition/route activation must be coordinated with C01 and R18 owner after verified migrations and tests; root Chats navigation with R17/C08 only. This C02 branch is NOT production-wired without those gates.

Trace IDs: M01, M02, M05, M10, P03, P05; journeys J03, J10/J11. Negative tests: cross-tenant, nonmember, reciprocal blocks and withdrawn permission on each send, duplicate client ID after retry, rate limits, sorted paging, sender-only edits/deletes, account-change isolation.

**Status at claim: IN_PROGRESS; no application tests, Postgres or Android evidence yet.** #457 exhausts Actions minutes; Work owns deferred CI and merge validation.


## Checkpoint — implementation, source not runtime verified

Code pushed under the exact claimed paths above. This C02 lane implements:

1. **Schema (0017):** account- and tenant-scoped conversation membership, canonical pair uniqueness, immutable client-request de-duplication, ordered history indexes, sender-specific rate index, editing revision CAS, content tombstones, identity foreign keys and cascades. C01 0016 is a strict runtime dependency. No second session/auth, blockchain or AI conversation table.
2. **Gateway isolated module:** authenticated start/list/read/history/send/edit/delete API registration function; platform session identity is the only source of user/tenant; SQL applies C01 active-account, reciprocal block, profile safety, accepted-contact or explicit public-contact eligibility. A new conversation and each text INSERT include policy guard in the actual SQL statement. Database per-sender advisory transaction lock, 30 messages/minute throttle, immutable SHA-256 original message checksum, stable unique per-sender client request ID and replay receipt prevent duplicate creation. Opaque exclusive cursor and revision-CAS editing (15 minutes)/deletion use server time.
3. **Flutter isolated module:** typed authenticated Dio transport; safe strict response parsing; user-scoped secure-storage pending text/request ID before HTTP send and post-crash recovery; no new request ID for uncertain delivery; account-switch refusal and private state clearing; sent state only after returned authoritative sender/conversation/text confirmation; paginated conversation screen with explicit retry, edit and delete actions. Not yet in final app shell.
4. **Tests written:** Gateway service/routes, PostgreSQL SQL contract and opt-in real database integration, Flutter transport, controller/restart/account-switch and widget pending/retry. No mock presented as shipped feature; tests use fixtures only for unit assertions.

### Exact integration blockers / status

- **C01 draft PR #468** owns `0016_human_messaging_contacts.sql`, real contact admission, and shared Gateway composer. This branch's 0017 migration uses 0016's tables at runtime. Review/verify #468 first and test the combined migration ordering. **Do not merge C02 alone into production** before live C01 and R18 migration sequencing.
- **R18 draft #435** and **C01 #468** both changed `app.ts`, `main.ts`; the shared integrator must reconcile them and then wire:
  `createPostgresHumanMessageRepository(database.pool)`, `createHumanMessageService({repository,authorizer:canonicalCustomerSessions})`, optional `humanMessages` `GatewayAppOptions`, and `registerHumanMessageRoutes(app,humanMessages)` only after account/session/DB readiness. No overlapping composer edits were made in this branch.
- **R17/C08 shared shell** must bind the new standalone `HumanConversationScreen` into the approved Chats root and C01 contact entry, not old AI `/chats`. Explicit empty/error/privacy/loading/small-screen states and deep-link/back-stack should be exercised on Android.
- **C03/C04/C05** must later add realtime delivery/read/unread and notification eventing, private media/voice notes, authenticated delta-sync and bounded per-account indexed cache/multi-message outbox. This C02 MVP is durable server text and a one-pending-send safety gate; **not** WhatsApp-grade finished Chats and **not E2EE**.
- **Verification has not executed.** GitHub Actions incident #457 has zero-step failures/quota exhaustion, and this connector runtime cannot clone/use pnpm+Flutter+Postgres. Static source readback only. No database migration, CI, APK, deployed SHA, Android or two-account result exists.
- **No completion claim:** C02 is `IMPLEMENTED_ISOLATED / UNVERIFIED / NOT_WIRED`; release acceptance J03/J10/J11 remain OPEN and C01/R18/R17/C03–C05 dependencies remain unsatisfied. PR stays **draft and unmerged**.

### Precise ChatGPT Work verification / handoff

1. Checkout this PR plus latest C01/R18 shared integration, reconcile migration 0015/0016/0017 without overwrite or renumbering, run `pnpm install --frozen-lockfile`, `pnpm --filter @masanawa/gateway-service typecheck`, `pnpm --filter @masanawa/gateway-service build` and `pnpm exec vitest run services/gateway/src/human_messages/service.test.ts services/gateway/src/human_messages/postgres_repository.test.ts`. Fix any real compiler/runtime errors, don't delete failing tests.
2. Start disposable **local** PostgreSQL with database ending `_test`; after C01/R18 migrations integrated set `MASANAWA_C02_TEST_DATABASE_URL=postgres://...@localhost/..._test`, `MASANAWA_C02_ENABLE_DB_TESTS=yes`, then run `pnpm exec vitest run services/gateway/src/human_messages/postgres_integration.test.ts`. Never use production credentials. Check concurrent same-ID replay, bilateral blocking and access revocation, inactive/deleted account, tenant isolation, malformed cursors, privilege injection, edit/delete CAS and retention.
3. With the approved production composer gate wired, run Gateway HTTP integration test on *two independently authenticated accounts*, check POST actually lands in Postgres/recipient GET, restart/resend same request ID without duplicate, unauthorized third user denied, sender offline sees pending not delivered; verify account deletion cannot leave residual DM data.
4. `cd apps/mobile && flutter pub get && dart format --output=none --set-exit-if-changed lib/src/messages/human_messages_transport.dart lib/src/messages/human_messages_controller.dart lib/src/messages/human_conversation_screen.dart test/human_messages_transport_test.dart test/human_messages_controller_test.dart test/human_conversation_screen_test.dart && flutter analyze && flutter test test/human_messages_transport_test.dart test/human_messages_controller_test.dart test/human_conversation_screen_test.dart`; then full suite, release build and two low-end Android devices. Test airplane mode, app killed/restarted, account swap mid-POST, compose/read accessibility and network spikes. Record exact test output and deployed commits before any merge.
5. Coordinate recipient push/receipt semantics with C03/R14 and protected local cache/outbox with C05. CI/merge owner is ChatGPT Work per #457; don't repeatedly retry no-step Actions, don't squash these implementation gaps into a DONE state.
