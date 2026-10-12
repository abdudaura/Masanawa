# MUI-05 / AF11 — complete authenticated Calls-history search

## Identity and status

- Fresh source base: `600fe204c1610c6c715ad9d61387f58f67d5817a` (includes prior #682/#683 MUI-03 scoped search).
- Feature/test source commit: `93797a4b5908ed4f4ea14e2484dc740e75549b13` (earlier implementation `6c21289`, observed failures corrected at `c7f548f`, final style + state/account regressions).
- Branch: `lane/af11-mui05-search-20261012-gpt6`, [PR #684](https://github.com/weavewellindustrieslimited/masanawa/pull/684). Reviewed PR head `bb81dbc447b0a0734c9e695906319323b0dcca66`, **merged main `b398aa27c1259d4e69546be91b1c2b00ccc29fd7`** through normal GitHub merge with expected-head protection; no admin bypass.
- Lease `af11-mui05-calls-search-20261012-gpt6` on `factory/claims`; previous AF11 incoming, AF00 presentation and STATUS claims for these exact files were released. No active path conflict at acquisition. AF00 retains shared router/bootstrap and AF05 voice.
- Status **INTEGRATED / VERIFIED_SCOPED_SOURCE**, **NOT_RELEASED**. Final hosted Flutter+real PostgreSQL tests on exactly matching app/test blobs passed; all nine touched app/test SHA blobs were separately checked equal at validated source `93797a4` and merged main `b398aa2`. No signed install/live customer/provider assertion. Hosted widgets and actual isolated PostgreSQL 18 passed; no signed install/live customer/provider assertion.

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

1. **Completed:** inspected actual failed/green CI job steps/logs, repaired historical-schema SQL and fixture errors, reran 13 backend/real PG18 and 27 Flutter tests with focused zero-issue analysis on exact source; merged reviewed, compatible source PR #684 to `main@b398aa27c1259d4e69546be91b1c2b00ccc29fd7` without admin bypass. All nine app/test blobs equal validated source. No pending MUI-05 implementable source item remains.
2. **Remaining release qualification:** whole-repo baseline issues, real account history permissions against deployed Gateway, installed Android/real IME/RTL/account navigation and AF11 qualified incoming/provider calls. Scoped Flutter widget+real PG tests do not prove a signed production release.
3. MUI-04 Status root/feed authorization and composition is missing on main and remains AF00 dependency; MUI-03 canonical C10 server-wide inbox integration remains partial. MUI-06 Rooms, MUI-07 Wallet, MUI-08 Crypto, MUI-09 combined 320/360/390/430px keyboard/large-text/RTL/account, MUI-10 signed installed-source identity and AF11 device/provider incoming-call qualification remain open. No production release from scoped source/tests.
4. AF11 exact-path ownership is released separately on `factory/claims` after this documentation merge. Next queue-aware window: prefer MUI-04 through AF00 protected composition when its integration contract is ready, otherwise MUI-06 Rooms (also requires bounded AF00 composition). Preserve the outstanding MUI-03 C10 server-authorized inbox gap.

## Direct next queue-aware continuation prompt

```text
Continue weavewellindustrieslimited/masanawa from fresh origin/main.
Read AGENTS.md, CONTINUE-HERE.md,
docs/workstreams/UI-CONTINUATION-QUEUE-20261012.md,
docs/workstreams/UI-NEXT-WINDOW-PROMPT-20261012.md,
docs/workstreams/UI-MUI-03-chats.md and
docs/workstreams/UI-MUI-05-calls-search.md.

MUI-01 PR #678 source 3076b2605 merged 18bdd8140.
MUI-02 PR #680 source 5cb21b1 merged 8bc782c2659973f43c6e6e248540c6b16b2a3106
and verified handoff PR #681 main eecea844349738b1e9a7227fa31d859f438503e9.
MUI-03 local mounted Chats search PR #682 merged
5b5bd26e7d5d62541652a2090bd32c9a90caa9fe, handoff PR #683
main 600fe204c1610c6c715ad9d61387f58f67d5817a.
MUI-03 remains PARTIAL: canonical C10 remote /v1/chats is not
mounted on main; AF00 owns bounded C10 integration request #616 comment 6128601248.

MUI-05 AF11 full paginated Calls search source/test 93797a4b5908ed4f4ea14e2484dc740e75549b13,
PR #684 final head bb81dbc447b0a0734c9e695906319323b0dcca66,
MERGED MAIN b398aa27c1259d4e69546be91b1c2b00ccc29fd7.
Final hosted run #38282543556 at source-identical temp workflow
c1dfb81b0112ba2aec26bd39cde999f0b4e9009b passed 27 Flutter
widget/regression tests, 13 backend/Fastify/real PostgreSQL18 tests,
focused Dart analysis with ZERO issues. Nine changed app/test blobs
match merged main exactly. Earlier actual run failures fixed and documented.
No signed device/live provider or whole-repository clean CI claim.

NEXT MUI-04 / AF09 Status, if no active claim: adopt existing
authorized feed/media and staff/approved Masana publication source
selectively onto fresh main; AF00 owns protected shell/router, Gateway
and migrations. Preserve real auth/permission and media readback;
remove unsupported human New status. Do not wholesale merge old
integration shell or lose native/group/billing/incoming Calls.
If AF00 composition is actively owned or cannot be safely transferred,
select next dependency-ready unclaimed milestone MUI-06 / AF10 Rooms,
or MUI-07 / AF03 with AF01 financial authority. Preserve MUI-03
remote server-inbox acceptance as an explicit pending AF00 item.

Keep Chats · Status · Wallet · Calls · Rooms, Chats default, Masana-only
contacts and existing Status/media, Rooms, auth and finance. No invented
records, money/rates, second ledger, Cr-to-MSN relabel, human publishing,
Create Room or destructive provider activation. Retain MUI-06…08,
MUI-09 320/360/390/430px keyboard/large-text/RTL/account journeys,
MUI-10 signed installed app/source identity and AF11 qualified
incoming-call/device/provider regression. Existing whole Flutter analyzer
329 diagnostics, TalkId TS2459 and nine earlier unrelated Flutter
suite failures are baseline NOT PASSES and not waived.

Fetch fresh origin/main, all relevant PR heads and factory/claims.
Claim exact files; coordinate protected edits with AF00, AF08 and AF01
as applicable. Implement connected code, run relevant tests, review,
commit, push, merge safe compatible changes into main. Preserve CI
and protections; never claim unrun release/device checks. Update
selected milestone handoff with base/source/merge SHAs, PR, paths,
actual tests/errors, remaining acceptance and smallest next action.
Release ownership and print the next queue-aware prompt directly.
```
