# MUI-07 / AF03 — mounted Wallet presentation and account-isolated reads

## Delivered identity and status

- Starting fresh `origin/main`: **`52c6b5a9afe83d40d1c7ee28ef5d8e7b837e5788`**. This includes MUI-01 #678, MUI-02 #680/#681, partial MUI-03 #682/#683, and MUI-05 #684/#685. All were preserved.
- Implementation/test commit and exact source PR head: **`416a2139c8dccf4747e7ec289ddecd7c381190c3`** on `lane/af03-mui07-wallet-presentation-20261012`.
- [PR #686](https://github.com/weavewellindustrieslimited/masanawa/pull/686) merged normally on 2026-10-12 at **`867d1288885bc335ee0f2704504de8135580dc72`**. Expected-head merge used; no admin flag, test/check disablement or protection change. All five application/test blobs were compared against merged main and match exactly.
- Documentation-only post-merge branch: `docs/mui07-verified-wallet-handoff-20261012`. This handoff and the MUI-03 reconciliation note change no executable source.
- **Implementation: INTEGRATED_SCOPED_SOURCE / PARTIAL_MUI07_ACCEPTANCE.** Verification: **PASS_SIMULATED_WIDGET** for executed Flutter/controller cases and **PASS_REAL_STATIC_ANALYSIS** for focused Dart analysis. **NOT_RELEASED**; no installed phone, live financial provider or production authorization qualification.

## Ownership and fallback resolution

Read current project instructions, queue, milestone handoffs and upstream Software Factory v0.4.4 at `Baatiku/Software-Factory-starter-kit@b8e9437ea40ce22094758a4352d9c88462d3e17a`, including AGENTS and relevant operating/ownership/verification references. Current project development policy governs main integration.

Registry claim **`af03-mui07-wallet-presentation-20261012`** acquired with exact paths before edits and renewed with source/test checkpoints. Two related paths were explicitly added before editing: the existing Wallet test fixture and MUI-03 handoff only. Release after post-merge documentation handoff. No contested implementation path was seized.

Fresh reconciliation found:

- MUI-03 #682 already merged scoped local filtering, with #683 handoff. Registry records the previous narrow recovery of `chat_list_screen.dart` from `af06-pr497-chat-list-async-action-lifecycle-20261010085813` to `af06-mui03-mounted-chats-search-20261012-gpt6`. Old branch checkpoint `3c0e88489baa7b5ad99dff66e69325f23937f086`, remaining broad claim paths and open PR #497 head `82e4f436e47828be76088cabe2c9064a80a548ec` remain preserved. This window did not edit Chats source.
- Canonical C10 #641 inbox is still on older `integration/rebuild`, not mounted on main. Completing it needs AF00 trusted-auth/Gateway/migration composition and an explicit exact-path transfer. `cloud-api-v1-20261011` still holds root composition, and unreleased `af05-android-voice-repair-20261012` still holds `services/gateway/src/main.ts` and voice paths. Expiry was not treated as release. Existing AF00 request: [#616 comment 6128601248](https://github.com/weavewellindustrieslimited/masanawa/pull/616#issuecomment-6128601248).
- MUI-04 canonical Status and MUI-06 persistent Rooms also need AF00 mounting/composition. MUI-05 is already merged with its own executed evidence. Therefore MUI-07 mounted Wallet presentation was the earliest safe disjoint source work.
- Inspected and preserved open MSN PR #576 at `aa88511f4add1bbcf9e213283088fea5a6b0561b` and its financial/reconciliation handoff. Its unmounted readback/ledger proposal was not wholesale-merged or used to rename legacy Credits.

## Exact changed paths and connected behavior

1. `apps/mobile/lib/src/screens/wallet/wallet_screen.dart`: mounted Wallet retains existing root callbacks and independent Billing/Crypto access during loading/outages. Standalone Wallet reuses MUI-01 white header; embedded root keeps its own header. Compact exact Cr balances keep pending/available distinct. Flat activity preserves server order, titles, direction and amounts, adds the actual entry date/time, and wraps long descriptions/amounts. Balance loading is distinct from zero/empty history; previous values are hidden during refresh/reload. Optional actions appear only when their callback exists and wrap at narrow widths. No new root callback or financial operation is activated.
2. `apps/mobile/lib/src/state/wallet_state.dart`: existing balance provider watches authenticated account ID instead of only signed-in boolean. Refresh invalidates and awaits Riverpod's existing managed read lifecycle; manual post-await state writes are removed. Delayed initial/refresh success or failure cannot overwrite newer account/logout/read state. Transport, server authorization, transfer/gift receipt contracts and monetary execution remain unchanged.
3. `apps/mobile/test/ui/mui07_wallet_test.dart`: 21 executed widget cases, including 16 width/text/direction combinations, actual zero versus unavailable, loading service access, retry, existing route opening and a supplied-only callback at 320px/2x.
4. `apps/mobile/test/wallet_account_fencing_test.dart`: nine executed controller races using deferred transport responses: signed-in A→B, refresh A after B, logout success/error, overlapping refreshes, A→B→A, initial load after refresh, initial account replacement and initial logout.
5. `apps/mobile/test/wallet_service_shortcuts_test.dart`: supplies the actual app theme to the existing outage fixture. Its original navigation/order/unavailable assertions remain intact.
6. This handoff and `docs/workstreams/UI-MUI-03-chats.md`: source/ownership/test evidence and remaining queue, no new implementation authority.

Preserved Chats · Status · Wallet · Calls · Rooms, Chats launch default, Masana-only identities, all native/group/history/billing/incoming Calls and other windows' source. No invented balance/valuation, MSN/Cr conversion, second ledger, historical shell replacement, unsupported publishing/Create Room, fiat cashout activation, auth or backend change.

## Executed verification

Local runner `/workspace`, Flutter **3.47.7** (`abaf9c5237`), Dart **3.13.5**. Tests use synthetic fixtures/software-rendered widgets, not real customer/provider/device evidence.

- `/workspace/flutter/bin/flutter --version` — executed; SDK downloaded from official Flutter repository/artifacts.
- `cd apps/mobile && /workspace/flutter/bin/flutter pub get` — **PASS**. SDK generated analysis-config/lockfile edits were restored to original bytes and not committed; later tests used `--no-pub`. This is not a frozen-lockfile qualification.
- RED: `flutter test --no-pub --reporter expanded test/wallet_account_fencing_test.dart test/ui/mui07_wallet_test.dart` — original account/read implementation failed all six initial race cases; header/layout acceptance failed. The additional initial-load-versus-refresh case also failed the first explicit-generation fix. Final code uses the canonical Riverpod lifecycle, not that discarded fix. Date assertions were corrected to Material's locale-format order; fixture-remount/theme mistakes were corrected before final runs.
- **PASS, 96 tests**, exact final application/test source `416a2139...`:
  ```sh
  flutter test --no-pub --reporter expanded \
    test/wallet_account_fencing_test.dart test/ui/mui07_wallet_test.dart \
    test/wallet_service_shortcuts_test.dart test/wallet_models_test.dart \
    test/wallet_http_transport_test.dart test/wallet_receipts_test.dart \
    test/crypto_wallet_test.dart test/ui/mui01_presentation_test.dart \
    test/ui/mui02_auth_language_test.dart test/ui/mui03_chats_search_test.dart \
    test/app_shell_route_compatibility_test.dart
  ```
  Nine new controller + 21 new widget cases; 66 existing cases, including MUI-01, all 33 MUI-02 cases, four scoped MUI-03 cases and route compatibility. Existing Wallet transport idempotency/receipt and crypto contract regressions retained.
- **PASS, zero issues**:
  ```sh
  dart analyze lib/src/screens/wallet/wallet_screen.dart \
    lib/src/state/wallet_state.dart test/ui/mui07_wallet_test.dart \
    test/wallet_account_fencing_test.dart test/wallet_service_shortcuts_test.dart
  ```
- **Full analysis remains non-clean:** `dart analyze` — starting-main snapshot **325 diagnostics**, implementation **324**. Compared diagnostic severity/path/message sets: no introduced diagnostic; only the existing Wallet unnecessary-underscore info removed. Historical 329 diagnostics are not declared passed or suppressed.
- **Full suites remain FAIL:** `flutter test --no-pub --reporter expanded` — untouched starting-main snapshot **496 passed / 9 failed**; same final production source **524 passed / 10 failed**. The source full run started before the final optional-callback test was added; the final 96-case focused run covers that addition. No whole-suite success claim.
- Independent read-only review of five changed app/test paths found **no actionable findings**. Its minor optional-action coverage suggestion was implemented and passed. `git diff --check` passed; exact five app/test blobs equal merge `867d1288...`.

### Whole-suite failures retained by name

Eight fail on both fresh baseline and source:

- `edit_profile_screen_test.dart`: missing profile offers real first-time creation; unsaved or invalid updates cannot be submitted; saved public profile survives leaving and reopening editor; failed save keeps previous server state for recovery.
- `agent_directory_readiness_test.dart`: malformed presence does not crash the whole agent directory.
- `agent_recovery_test.dart`: directory keeps roster on transient failure and clears it on 401.
- `talk_screen_test.dart`: listener opens Sponsor Seat sheet from Add AI; host opens direct Add AI semantics. The latter also fails an isolated source recheck.

Baseline-only ninth failure, `wallet_service_shortcuts_test.dart: service entry survives a wallet balance outage`, reproduced the missing app-theme fixture. Corrected fixture passes with original assertions.

Two additional source full-run failures involve unchanged timer-sensitive audio source/tests:

- `group_call_controller_test.dart: paid participant ends at consented duration cap` — the entire source file rerun **13 passed**; isolated baseline duration-cap case **1 passed**.
- `talk_live_audio_session_test.dart: ended heartbeat closes media instead of keeping synthetic audio alive` — isolated source and baseline reruns each **1 passed**.

These successful rechecks do not erase the full-run failures. Preserve the discrepancy for AF11/AF05/MUI-09; neither affected controller/test file changed in this PR. Raw local evidence logs are `/workspace/scratch/mui07-{focused-final,analyze-final,full-suite,baseline-full-suite,full-analyze,baseline-full-analyze,group-recheck,live-recheck,baseline-live-recheck}.log`.

### Standard CI and unrun scope

- [Foundation CI #38285565891](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38285565891): **FAIL**, existing `packages/agents/src/talk-replay.test.ts(6,8)` TS2459 (`TalkId` not exported), before later stages. Relevant TS files are unchanged.
- [Mobile Build #38285565739](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38285565739): **FAIL** at whole-project analyzer diagnostics; later test/APK stages not passed. Relevant focused executable tests/analysis were run locally instead. No check was altered or bypassed.
- Backend Vitest/PostgreSQL changes: **NOT_RUN / not applicable to this source-only Flutter change**. No backend claim from widget/controller fixtures.
- Installed/signed Android/iOS, real IME, full localized/keyboard combined flow, live financial Gateway/provider/account permissions, AF11 incoming/provider devices: **NOT_RUN**. Android SDK/signing/device unavailable in this runner; no APK or release claim.

## Remaining source and smallest next executable action

| Item | State / owner / exact next action |
| --- | --- |
| Mounted existing Wallet presentation + read isolation | Integrated #686, executed scoped tests; no pending implementable source item within this bounded change |
| MUI-07 MSN denomination, financial liabilities and funding/Send | **OPEN**, AF01 canonical financial authority + AF00 exact root/Gateway/migration transfers. Reconcile #576 against current main and qualified quote/receipt/settlement contracts before exposing an MSN/funding/Send journey. No relabeling or invented callbacks |
| MUI-03 canonical server-wide inbox | **OPEN**, AF06 with AF00 trusted auth/composition and AF05 exact `main.ts` coordination. Existing C10 authority must be reconciled, mounted and extended/tested for authorized names/titles/identifiers, bounded search, debounce/query/account/cache fencing, denied/offline/retry and preserved actions |
| MUI-04/06 Status/Rooms | **OPEN**, domain owners + bounded AF00 composition; do not substitute legacy live-Talk UI for canonical acceptance |
| MUI-05 Calls search | Preserve #684/#685 independent executed source; installed/provider qualification remains open |
| MUI-08 Crypto | **Next independent ready source**, AF03 after fresh exact-path claims: refine existing mounted capability-gated Crypto and supported transaction sheets, preserve exact amounts/quotes/expiry/uncertainty; reuse existing source, no aggregate valuation/provider activation |
| MUI-09 / MUI-10 / AF11 | **OPEN**, combined 320/360/390/430px keyboard/large-text/RTL/account/visual regression, signed installed-source identity, live incoming-call/device/provider qualification and named global failures |

Keep MUI-04…08 open until independently accepted; scoped Wallet delivery is not full MSN financial acceptance. Smallest safe independent continuation is MUI-08 on existing mounted Crypto; prefer completing MUI-03 first only when its required explicit protected-path transfers are available.

## Next queue-aware continuation prompt

```text
Continue weavewellindustrieslimited/masanawa from fresh origin/main.
Read AGENTS.md, CONTINUE-HERE.md, docs/MULTI-WINDOW-WORK.md,
docs/workstreams/UI-CONTINUATION-QUEUE-20261012.md,
docs/workstreams/UI-NEXT-WINDOW-PROMPT-20261012.md,
docs/workstreams/UI-MUI-03-chats.md and
docs/workstreams/UI-MUI-07-wallet.md.
Preserve MUI-01 #678, MUI-02 #680/#681, partial MUI-03 #682/#683,
and MUI-05 #684/#685; inspect their exact current handoffs.

MUI-07 bounded Wallet source and PR #686 exact head:
416a2139c8dccf4747e7ec289ddecd7c381190c3.
Merged main: 867d1288885bc335ee0f2704504de8135580dc72.
Starting main: 52c6b5a9afe83d40d1c7ee28ef5d8e7b837e5788.
Local Flutter 3.47.7 / Dart 3.13.5: 96 focused tests PASS,
focused analysis zero issues; full analysis 324 versus 325 baseline,
no new diagnostics. Full suites FAIL: baseline 496 pass / 9 fail,
implementation 524 pass / 10 fail; two unchanged audio timing cases
pass rechecks. Read exact failure names/test-set caveats in the handoff.
Standard CI still FAILS at TalkId TS2459 and global Flutter diagnostics.
No signed/provider/production qualification or disabled checks.

MUI-03 canonical C10 inbox remains unmounted: local filtering is not
server-wide authenticated search. Preserve prior narrow claim recovery,
PR #497 unique source and AF05 voice changes. Obtain explicit AF00 exact
Gateway/auth/migration/router transfers and AF05 main.ts coordination.
MUI-04/06 also need AF00; MUI-07 MSN/funding/Send needs AF01/AF00
reconciliation with #576 at aa88511f4add1bbcf9e213283088fea5a6b0561b.
If these protected dependencies remain unavailable, the next independent
ready source is MUI-08 / AF03: mounted real capability-gated Crypto and
transaction presentation, exact quotes/fees/expiry/status, no invented
valuation. Inspect fresh main, PR heads and claims; claim exact paths.

Preserve Chats · Status · Wallet · Calls · Rooms, Chats default,
Masana-only contacts and all native/group/history/billing/incoming Calls,
Status/media, Rooms, auth and finance. No wholesale historical shell merge,
second ledger, Cr-to-MSN relabel, fake records, fiat cashout or unsupported
publishing/Create Room. Keep MUI-04…08 independent acceptance, MUI-09
combined keyboard/layout/RTL/account, MUI-10 signed installed-source
identity and AF11 live incoming/provider/device qualification OPEN.
Execute relevant tests; review, commit, push and merge compatible source
normally. Record exact SHAs, PR, results and gaps; release ownership and
print the next queue-aware continuation prompt directly.
```
