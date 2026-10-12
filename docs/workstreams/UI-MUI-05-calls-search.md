# MUI-05 / AF11 — complete authenticated Calls-history search

## Identity and status

- Fresh source base: `600fe204c1610c6c715ad9d61387f58f67d5817a` (includes prior #682/#683 MUI-03 scoped search).
- Feature/test source commit: `93797a4b5908ed4f4ea14e2484dc740e75549b13` (earlier implementation `6c21289`, observed failures corrected at `c7f548f`, final style + state/account regressions).
- Branch: `lane/af11-mui05-search-20261012-gpt6`, [PR #684](https://github.com/weavewellindustrieslimited/masanawa/pull/684) (source-tested; awaiting merge review).
- Lease `af11-mui05-calls-search-20261012-gpt6` on `factory/claims`; previous AF11 incoming, AF00 presentation and STATUS claims for these exact files were released. No active path conflict at acquisition. AF00 retains shared router/bootstrap and AF05 voice.
- Status **VERIFIED_SCOPED_SOURCE**, **NOT_MERGED** at this source checkpoint, **NOT_RELEASED**. Hosted widgets and actual isolated PostgreSQL 18 passed; no signed install/live customer/provider assertion.

## Exact claimed paths

- `services/gateway/src/call_history/{service,routes,postgres_repository}.ts`: existing trusted session scope remains authoritative, optional normalized bounded `q` on `GET /v1/calls`, query-bound canonical cursors (legacy empty-query format retained), matching name/state/direction/supported call and character IDs in the filtered PostgreSQL keyset query **before** `LIMIT`; no second read/ledger, new auth or migration.
- `services/gateway/src/call_history/{routes,postgres_repository}.test.ts`: Fastify authority, foreign query cursor, validation and disposable PostgreSQL later-page/cross-account source tests.
- `apps/mobile/lib/src/calls/call_history.dart`: existing account-authenticated Dio `/v1/calls` transport accepts optional query and retains request cancellation.
- `apps/mobile/lib/src/screens/calls/calls_screen.dart`: MUI-01 shared search mounted on the existing rich Calls screen with 350ms debounce, immediate stale-response cancellation and account/session fencing, clear/loading/invalid/no-results/error/retry and query-preserving pagination and lifecycle refresh. Native/group/history/billing/incoming and row-opening actions retained.
- `apps/mobile/test/{calls_screen_test,call_history_transport_test}.dart`: direct transport and mounted Calls widget source cases for later-page response, clear, stale typing, no matches and retry, preserving previous regression fixtures.
- This handoff. **No** `main.ts`, root router, database migration, billing, auth or native code changed.

## Evidence and current gate

Final hosted validation branch `validation/mui05-calls-search-final-20261012-gpt6`, application/test source **identical to** `93797a4b5908ed4f4ea14e2484dc740e75549b13`; temporary workflow commit `c1dfb81b0112ba2aec26bd39cde999f0b4e9009b`. A GitHub commit comparison confirms **exactly one added path** (`.github/workflows/verify-mui05-temp.yml`), no app/test/source differences. Temporary validation workflows were not added to source PR.

- **PASS** [hosted final run #38282543556](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38282543556) (Flutter stable 3.47.7; Node 24, pnpm 12.8.2; disposable PostgreSQL 18.6):
  - `cd apps/mobile && flutter pub get` — PASS.
  - `flutter test --reporter expanded test/calls_screen_test.dart test/call_history_transport_test.dart test/ui/mui01_presentation_test.dart` — **27 PASSED**, covering complete query through existing transport, later-page result, clear, stale A/B, account replacement during query, no matches/offline retry, pinning existing Calls/group actions and MUI-01 shared layouts.
  - `dart analyze lib/src/calls/call_history.dart lib/src/screens/calls/calls_screen.dart test/calls_screen_test.dart test/call_history_transport_test.dart` — **PASS, no issues found**.
  - Isolated-runner `pnpm install --no-frozen-lockfile` — PASS, did not write repository lockfile.
  - `pnpm exec vitest run services/gateway/src/call_history/routes.test.ts services/gateway/src/call_history/postgres_repository.test.ts` — **13 PASSED** in 2 test files: seven Fastify/authorization/cursor cases and six actual PostgreSQL18 cases including query matching before pagination, state/direction/ID, tenant/fan/roster denial, historical compatibility, lifecycle recording.
- **FAIL then FIXED**, first [run #38281852639](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38281852639): the real PG18 fixture only has historical 0007 columns, so direct `h.direction` search reference raised `42703` and tests failed. Repaired with `to_jsonb(h)` optional-field access (no production/schema mutation), preserving direction/incoming when available and falling back for older rows. One Flutter retry fixture spent the simulated network failure on the initial empty search; corrected. First Flutter run 25 passed/1 failed; first PostgreSQL query failed.
- **PASS tests, 2 nonfatal existing group-call formatting infos** in [run #38282179776](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38282179776): **26 Flutter passed**, **13 backend/real PG18 passed**; scoped Dart analyzer returned two `curly_braces_in_flow_control_structures` info diagnostics in existing group-call guard statements. Corrected braces without behavior change and added another searched-account regression; final run passed 27 tests and analyzer zero issues.
- **Not run**: whole-repository Flutter analyze/typecheck/full suites, installed signed Android/IME/real account/service/provider; no production database or ledger touched. Historical 329 full Flutter diagnostics, `TalkId` TS2459 and nine unrelated full-suite Flutter failures remain baseline **not passes/not waived**. GitHub transient runner `--no-frozen-lockfile` is not proof the normal frozen lockfile job passes.

## Remaining acceptance / follow-on

1. Completed: inspected actual failed/green CI job steps/logs, repaired historical-schema SQL and fixture errors, reran 13 backend/real PG18 and 27 Flutter tests and focused zero-issue analysis on exact source. Next: normal safe merge, no bypass.
2. Review updated main, diff, service/cursor auth and preservation, merge tested compatible #684 without bypass, then pin exact PR source and main SHA here (documentation follow-up if needed).
3. MUI-04 Status root/feed authorization and composition is missing on main and remains AF00 dependency; MUI-03 canonical C10 server-wide inbox integration remains partial. MUI-06 Rooms, MUI-07 Wallet, MUI-08 Crypto, MUI-09 combined 320/360/390/430px keyboard/large-text/RTL/account, MUI-10 signed installed-source identity and AF11 device/provider incoming-call qualification remain open. No production release from scoped source/tests.
4. Release the AF11 exact-path claim upon safe merge/handoff; next queue-aware window should take earliest dependency-ready unclaimed item, prefer MUI-04 through AF00 protected composition when available, else MUI-06 and preserve the MUI-03 C10 gap.

## Direct next continuation prompt (to update with merge SHA)

Continue weavewellindustrieslimited/masanawa from fresh origin/main. Read AGENTS.md, CONTINUE-HERE.md, docs/workstreams/UI-CONTINUATION-QUEUE-20261012.md, docs/workstreams/UI-NEXT-WINDOW-PROMPT-20261012.md and this UI-MUI-05-calls-search.md handoff. MUI-05 source/test PR #684 base `600fe204` and source `6c21289`; inspect exact CI run #38281852639, fix any introduced failure, do not claim an unrun check, merge safely, pin resulting main SHA and release AF11 path lease. MUI-03 local search #682/#683 is merged but remote C10 remains partial and AF00-owned. Prefer MUI-04 Status if AF00 protected integration is ready, otherwise earliest unclaimed ready UI milestone. Preserve Chats · Status · Wallet · Calls · Rooms, Chats default, Masana-only contacts, native/group/history/billing/incoming Calls, Status/media, Rooms, auth and finance. Do not wholesale merge historical shell, create fake records/valuations, duplicate ledgers, Cr-to-MSN relabel, user publishing or Create Room. Keep MUI-09 320/360/390/430px keyboard/large-text/RTL/account, MUI-10 installed signed-source identity and AF11 device/provider proof open. Report exact SHAs, PR, tests, blockers and next action.
