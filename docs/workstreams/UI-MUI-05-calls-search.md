# MUI-05 / AF11 — complete authenticated Calls-history search

## Identity and status

- Fresh source base: `600fe204c1610c6c715ad9d61387f58f67d5817a` (includes prior #682/#683 MUI-03 scoped search).
- Feature/test source commit: `6c21289aaddaea3d4de96b0398add1b112429f80`.
- Branch: `lane/af11-mui05-search-20261012-gpt6`, [PR #684](https://github.com/weavewellindustrieslimited/masanawa/pull/684) (**DRAFT pending executable validation**).
- Lease `af11-mui05-calls-search-20261012-gpt6` on `factory/claims`; previous AF11 incoming, AF00 presentation and STATUS claims for these exact files were released. No active path conflict at acquisition. AF00 retains shared router/bootstrap and AF05 voice.
- Status **IMPLEMENTED_UNVERIFIED** until hosted focused checks finish; **NOT_MERGED**, **NOT_RELEASED**.

## Exact claimed paths

- `services/gateway/src/call_history/{service,routes,postgres_repository}.ts`: existing trusted session scope remains authoritative, optional normalized bounded `q` on `GET /v1/calls`, query-bound canonical cursors (legacy empty-query format retained), matching name/state/direction/supported call and character IDs in the filtered PostgreSQL keyset query **before** `LIMIT`; no second read/ledger, new auth or migration.
- `services/gateway/src/call_history/{routes,postgres_repository}.test.ts`: Fastify authority, foreign query cursor, validation and disposable PostgreSQL later-page/cross-account source tests.
- `apps/mobile/lib/src/calls/call_history.dart`: existing account-authenticated Dio `/v1/calls` transport accepts optional query and retains request cancellation.
- `apps/mobile/lib/src/screens/calls/calls_screen.dart`: MUI-01 shared search mounted on the existing rich Calls screen with 350ms debounce, immediate stale-response cancellation and account/session fencing, clear/loading/invalid/no-results/error/retry and query-preserving pagination and lifecycle refresh. Native/group/history/billing/incoming and row-opening actions retained.
- `apps/mobile/test/{calls_screen_test,call_history_transport_test}.dart`: direct transport and mounted Calls widget source cases for later-page response, clear, stale typing, no matches and retry, preserving previous regression fixtures.
- This handoff. **No** `main.ts`, root router, database migration, billing, auth or native code changed.

## Evidence and current gate

Hosted validation branch `validation/mui05-calls-search-20261012-gpt6` source parent `6c21289aaddaea3d4de96b0398add1b112429f80`, temporary test-workflow head `177468f6c097b08ec4b2361cb75fae0502207386`. [Run #38281852639](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38281852639) started. Its temporary workflow is **not** part of the feature PR. Commands requested:
- `flutter pub get`
- `flutter test --reporter expanded test/calls_screen_test.dart test/call_history_transport_test.dart test/ui/mui01_presentation_test.dart`
- `dart analyze lib/src/calls/call_history.dart lib/src/screens/calls/calls_screen.dart test/calls_screen_test.dart test/call_history_transport_test.dart`
- `pnpm install --no-frozen-lockfile` on isolated runner only; `pnpm exec vitest run services/gateway/src/call_history/routes.test.ts services/gateway/src/call_history/postgres_repository.test.ts` with ephemeral PostgreSQL18.
**Execution: in progress, no pass claimed yet.** A baseline full project 329 Flutter analyzer diagnostics, `TalkId` TS2459 and nine unrelated Flutter suite failures are not passed or waived. No signed device, provider or real installed APK/source identity is evidenced.

## Remaining acceptance / follow-on

1. Inspect exact CI job steps/logs, repair introduced Flutter/TS/PG failures, rerun focused tests and analyzer at app/test-identical source SHA.
2. Review updated main, diff, service/cursor auth and preservation, merge tested compatible #684 without bypass, then pin exact PR source and main SHA here (documentation follow-up if needed).
3. MUI-04 Status root/feed authorization and composition is missing on main and remains AF00 dependency; MUI-03 canonical C10 server-wide inbox integration remains partial. MUI-06 Rooms, MUI-07 Wallet, MUI-08 Crypto, MUI-09 combined 320/360/390/430px keyboard/large-text/RTL/account, MUI-10 signed installed-source identity and AF11 device/provider incoming-call qualification remain open. No production release from scoped source/tests.
4. Release the AF11 exact-path claim upon safe merge/handoff; next queue-aware window should take earliest dependency-ready unclaimed item, prefer MUI-04 through AF00 protected composition when available, else MUI-06 and preserve the MUI-03 C10 gap.

## Direct next continuation prompt (to update with merge SHA)

Continue weavewellindustrieslimited/masanawa from fresh origin/main. Read AGENTS.md, CONTINUE-HERE.md, docs/workstreams/UI-CONTINUATION-QUEUE-20261012.md, docs/workstreams/UI-NEXT-WINDOW-PROMPT-20261012.md and this UI-MUI-05-calls-search.md handoff. MUI-05 source/test PR #684 base `600fe204` and source `6c21289`; inspect exact CI run #38281852639, fix any introduced failure, do not claim an unrun check, merge safely, pin resulting main SHA and release AF11 path lease. MUI-03 local search #682/#683 is merged but remote C10 remains partial and AF00-owned. Prefer MUI-04 Status if AF00 protected integration is ready, otherwise earliest unclaimed ready UI milestone. Preserve Chats · Status · Wallet · Calls · Rooms, Chats default, Masana-only contacts, native/group/history/billing/incoming Calls, Status/media, Rooms, auth and finance. Do not wholesale merge historical shell, create fake records/valuations, duplicate ledgers, Cr-to-MSN relabel, user publishing or Create Room. Keep MUI-09 320/360/390/430px keyboard/large-text/RTL/account, MUI-10 installed signed-source identity and AF11 device/provider proof open. Report exact SHAs, PR, tests, blockers and next action.
