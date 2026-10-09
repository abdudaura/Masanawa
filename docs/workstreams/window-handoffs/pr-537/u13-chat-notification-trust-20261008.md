# U13 — Human DM notification trust and mute preferences

**Status: PARTIAL_IMPLEMENTATION, UNVERIFIED integration; DRAFT/UNMERGED, no deployment.**
**Claim:** [#528](https://github.com/Baatiku/masanawa/issues/528) with five-minute refresh.
**Base:** fresh `main` at `5e758673ae91082520b21b3153da53791ae2cbf3`. **Branch:** `work/u13-chat-notification-trust-20261009-gpt6`; use its current GitHub HEAD for the exact source commit.

## Exclusive paths modified

- `services/gateway/src/human_dm_preferences/policy.ts`: versioned mute/push policy with strict expiry/version checks, generic redacted push data, typed errors.
- `services/gateway/src/human_dm_preferences/service.ts`: canonical platform-session authorizer injection; reauth after async operations, session-swap fencing, CAS conflict, unread and link readback, C03 event checks; trusted worker-only push hint, never public.
- `services/gateway/src/human_dm_preferences/postgres_repository.ts`: real Postgres interface and SQL against existing **C01/C02/C03** authorities: member+active peer, declined contacts and reciprocal block/safety checks; serializable-by-conversation preference writes and optimistic revisions, accurate COUNT of unread nondeleted *messages* rather than global message-sequence subtraction, exact C03 event/member/unread matching, unique recipient/event attempt claim.
- `services/gateway/src/human_dm_preferences/SCHEMA_PROPOSAL.sql`: two new tables for preferences and recipient-scoped event dedupe, **not an applied or registered migration**; the F15/F16 sequencer must review and allocate it without clashing with C01 0016, C02 0017 and C03 0019/0020.
- `services/gateway/src/human_dm_preferences/routes.ts`: isolated Fastify registrar for GET/PUT private settings, GET authoritative unread, GET link eligibility, strictly not composed into shared Gateway yet.
- `services/gateway/src/human_dm_preferences/policy.node-test.mjs`: independent native Node policy/service tests.
- `apps/mobile/lib/src/human_chat_preferences/dm_notification_preferences.dart`: real Dio HTTP transport and account-fenced controller with no optimistic success on lost responses; explicit 409 conflict, denied, uncertain and reload states; safe link reauthorization.
- `apps/mobile/lib/src/human_chat_preferences/dm_notification_preferences_sheet.dart`: working standalone Flutter sheet for 8-hour/forever/off mute and privacy-safe preview, busy/failure/reload controls; no extra navigation root.
- `apps/mobile/test/human_chat_preferences/dm_notification_preferences_test.dart`: model/revision and signout race tests, not executed (no Flutter SDK).
- This handoff.

## Source recovered/reviewed, no duplication

C01 [#468](https://github.com/Baatiku/masanawa/pull/468), C02 [#472](https://github.com/Baatiku/masanawa/pull/472) and competing [#475](https://github.com/Baatiku/masanawa/pull/475), C03 [#483](https://github.com/Baatiku/masanawa/pull/483) continuation of #473, R14 FCM [#436](https://github.com/Baatiku/masanawa/pull/436) and safe previews [#502](https://github.com/Baatiku/masanawa/pull/502), native Firebase [#461](https://github.com/Baatiku/masanawa/pull/461), shared Work [#497](https://github.com/Baatiku/masanawa/pull/497). None are claimed merged or replaced here. No edits to Gateway app.ts/main.ts, core migrations, firebase files, root Flutter router, payments, ledgers, C03 events or human DM schema.

## Evidence (limited to locally replicated isolated code)

Using Node 22.16.0 and global `tsc` (repo requires Node 24/pnpm 12), compiled and strict-typechecked local policy, service and PostgreSQL repository source equivalents; zero core type errors. Ran **seven isolated native Node policy/service tests: seven passed, zero failed**, covering invalid mute/revision/expiry, no private push data, recipient and self-event suppression, active mute, authenticated account scope, session identity swap, missing and version-conflicting writes, and duplicate event at-most-once reservation. Source has been written and pushed via Git objects; **the remote committed files have not been independently checked out and rerun**, and the Fastify routes were not typechecked locally. Thus this is not full-repo CI or executable feature qualification.

To rerun on an actual clone:
```sh
cd services/gateway/src/human_dm_preferences
mkdir -p /tmp/masanawa-u13-node
tsc --target ES2022 --module NodeNext --moduleResolution NodeNext --strict --skipLibCheck --outDir /tmp/masanawa-u13-node policy.ts service.ts postgres_repository.ts
cp policy.node-test.mjs /tmp/masanawa-u13-node/
node --test /tmp/masanawa-u13-node/policy.node-test.mjs
cd ../../../../..
pnpm install --frozen-lockfile && pnpm typecheck && pnpm test:ci
cd apps/mobile && flutter analyze && flutter test test/human_chat_preferences/
```
Project's CI [#457](https://github.com/Baatiku/masanawa/issues/457) quota and missing Postgres runner, Firebase credentials, Android/iOS devices, Flutter SDK in this window block all integrated/device/provider proof; commands above are **not claimed executed**. No FCM push was attempted.

## Required final integration / verification

1. F15/F16 schema owner reconciles C01/C02/C03 SQL, chooses unique migration sequence, tests actual PostgreSQL installation, FK/CAS locks, concurrent duplicate claims, index/performance, rollback/retention and authorization.
2. Canonical Gateway composer injects **the same C02 authenticated platform-session authorizer and DB Pool**; registers routes under its existing error handling. Test 401/403, wrong tenant/member/blocked/declined, 409, expired sessions, post-commit readback, high-volume and read cursor ordering.
3. R14/F10 sender invokes `pushHint` **only from trusted committed C03 events**; sends solely generic returned data. Unique claim means at-most-one *attempt*, not guaranteed delivery; if the process crashes after claim, C03/C02 catch-up replaces the lost push. Verify FCM/APNs backgrounds, OS consent, lock-screen copy and sender/provider dedupe.
4. C05/F12 client integration mounts sheet in **human Chats**, injects account-scoped current Dio bearer and account key, clears upon signout/switch, and calls `canOpen` before navigation from incoming hints. Notifications do not alter C02 read receipts. Run Flutter widget and two-device tests for mute, block/revoke/deeplink replay, conversation deletion, app killed/foreground and large-font/low-end.
5. Final Work #497 integrator resolves ownership, migration conflicts, R14 native keys, full CI, physical devices and signoff. **Not DONE**, not integrated, no production change, no merge authorization.

**Security limits:** no private sender name, message contents, media or financial details in push; no new authentication, provider, public notification-send endpoint, DM row write, or private message AI ingestion. Schema uninstalled by design pending canonical integration.