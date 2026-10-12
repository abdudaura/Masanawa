# MUI-08 / AF03 — mounted Crypto and transaction presentation

## Identity and ownership

Base: `1337917a7e063971fd083deb4d0ce4b59310b219` (delivered #687).
Implementation/test SHA: **`e2950f41c96599a8223e089a9713318d780abf6d`** on `lane/af03-mui08-crypto-20261012`. PR and main merge recorded after publication.
Implementation: **PARTIAL_IMPLEMENTATION** until source merge is recorded; bounded mounted presentation, not complete financial/provider acceptance.
Release: **NOT_RELEASED**. No signed installed app or provider execution.

Read AGENTS, CONTINUE-HERE, multi-window rules, queue, next-window seed and MUI-03/07 handoffs. Latest Software Factory remains v0.4.4 at `b8e9437ea40ce22094758a4352d9c88462d3e17a`; read its AGENTS, skill, operating and verification references. Project owner policy authorizes normal main integration and governs superseded integration-only rules. Used executing-plans/TDD/verification skills; independent read-only reviewer required by those skills found no source blockers. Its Buy/Convert coverage suggestion was addressed.

Fresh main and open PRs matched the supplied handoff. Factory claims still require bounded AF00 composition/auth/migration transfers and AF05 `main.ts` coordination. Latest paginated #616 comments contain the existing request [6128601248](https://github.com/weavewellindustrieslimited/masanawa/pull/616#issuecomment-6128601248), no new transfer. PR #497 unique source and narrow Chats recovery remain preserved. MUI-03 server-wide C10 inbox, MUI-04/06 composition and MUI-07 MSN/funding/Send remain open.

Inspected PR #576 exact head `aa88511f4add1bbcf9e213283088fea5a6b0561b`, including its Crypto file diff: additive MSN readback is preserved in its branch, not imported or relabelled. No other unreleased claim overlaps this window's three paths. Exact CAS claim **`af03-mui08-crypto-20261012`** acquired at registry `af87cc3e0907220699007b064fa091348790360c9a`, with meaningful test/source checkpoints. Final release recorded after handoff integration.

## Exact paths and behavior

- `apps/mobile/lib/src/finance/crypto_wallet_screen.dart`: existing mounted `/crypto` detail route keeps title/back navigation and white header. Gradient, horizontal chips, oversized tiles and history card replaced with actual asset/network selection rows, exact selected balance, compact wrapping supported actions and flat server-ordered activity. Missing balance remains unavailable. No portfolio valuation or extra asset is computed. Conversion requires an actual different supported destination.
- Same file: receipt details expose existing request ID, exact amount, network, supplied recipient/address/fee/settled target amount/status/timestamps. Existing review and deposit dialogs scroll; summaries stack and wrap; recipient text is not truncated. Amounts/units/identifiers use LTR within RTL presentation. Supplied quote time is shown. The controller/transport/DTOs, authorization, operation request IDs, secure checkout and status refresh contracts are unchanged. A screen-lifetime guard disables financial actions and wallet refresh/pull while a journey awaits input, quote, confirmation or execution; cancel restores controls. Server capability authority remains unchanged.
- `apps/mobile/test/ui/mui08_crypto_test.dart`: 24 simulated widget cases: 16 width/scale/direction cases, unavailable versus zero, absent unsupported actions, receipt disclosure, Receive/Buy/Convert keyboard layouts, deferred withdrawal with explicit authorization/in-flight lock, conversion cancel/estimate and outage retry. Optional font/capture defines produce fixture-only renders without network/provider calls. Capture output stays outside Git.
- This handoff only. No controller/backend/auth/ledger/router/migration/CI file changed.

All five tabs, Chats default, Masana-only contacts, prior MUI-01/02/03/05/07 and native/group/incoming Calls remain intact. No Cr-to-MSN mapping, second ledger, invented balances, fiat cashout, new provider activation or unsupported publishing/Create Room.

## Executed evidence

Flutter **3.47.7** (`abaf9c5237`), Dart **3.13.5**, newly installed in `/workspace/flutter`. `flutter pub get` passed; its generated analysis-options/lock changes were restored to original bytes and not committed. Checks subsequently used `--no-pub`; this is not frozen-lock qualification.

- RED against unchanged production screen: 1 pass / 19 failures in the original 20-case set. Explicit header/flat-layout assertions, unavailable balance and missing receipt behavior failed. Later fixture corrections: remount ProviderScope key, icon-button subclass/tooltip/SelectableText child lookups and pump after scroll. These are test harness repairs, not product failures.
- Pending quote regression failed with wallet refresh still enabled. Screen-lifetime financial journey lock passes final withdrawal authorization case; execution is zero before explicit confirmation and one after, pending provider status remains submitted rather than success.
- First render used Ahem/partial font loading; not treated as visual qualification. Final captures explicitly load official Flutter SDK Roboto/MaterialIcons, with a test-only AppBar font override to replace test fallback; 16 widths/scales/directions plus receipt, Receive/Buy/Convert keyboard and withdrawal/conversion review captures inspected. Synthetic software-rendered fixtures, not phones or live accounts. RTL numeric wrap discovered during render review and corrected with explicit LTR financial values, with a corrected RED→GREEN assertion.
- **PASS, 134 focused tests** on final app/test source `e2950f41...`, including all 24 new cases and 110 existing Wallet/Crypto/MUI-01/02/03/07/root/Calls regressions. **PASS, 24 SDK-font render cases** on identical source, with fixture captures inspected. Exact commands below.
- **PASS, zero issues:** `dart analyze lib/src/finance/crypto_wallet_screen.dart test/ui/mui08_crypto_test.dart`. `git diff --check` passed.
- Initial broader focused run: **131 PASS**, before three added Buy/Convert/outage cases. A later run with the additional cases failed only the new incorrect SelectableText test cast; fixed before final execution. No failed attempt is counted as a final pass.
- Whole analysis remains non-clean. First full run: 323 diagnostics, including one introduced unnecessary test import; removed. Final focused analysis must be zero issues. Final full run: **322 diagnostics versus 324** on untouched fresh main `1337917a...` in a separate worktree with the same SDK. Compared severity/path/message sets: **zero introduced diagnostics**; the two original deprecated dropdown `value` diagnostics were removed. Global diagnostics are not suppressed.
- `flutter build apk --debug --no-pub`: **BLOCKED**, `[!] No Android SDK found`. No APK/signing/device claim. No live financial provider, backend/PG execution or paid resource used.
- Full Flutter suites **NOT_RERUN** for this presentation patch. Preserve exact previous [MUI-07 evidence](UI-MUI-07-wallet.md): baseline 496 passed/9 failed; implementation 524 passed/10 failed, with test-set caveat and successful unchanged audio rechecks. Those failures are not erased by this scoped run. Standard CI's existing whole-analyzer failures and TalkId TS2459 remain named debt; current PR runs recorded after push.

## Acceptance and remaining owners

| Acceptance | Evidence / remaining action |
| --- | --- |
| Flat actual asset/network/balance/activity; white detail header; no fabricated valuation | Scoped source + 16 widget layout cases; supplied strings retained |
| Capability-gated supported Buy/Receive/Convert/Withdraw | Same transport/controller operations, unsupported buttons absent, no destination means no Convert |
| Readable exact receipt/review/keyboard presentation | Executed simulated widget cases and inspected SDK-font captures; full localized/device visual qualification remains open |
| Explicit financial authorization/in-flight blocking/uncertain status | Deferred withdrawal proves no execution before confirmation, one afterward, pending message retained; live reconciliation remains AF01/provider qualification |
| Quote expiry | **OPEN, AF01**: existing Crypto quote DTOs expose `quotedAt`, no `expiresAt`/bound quote identity. No invented expiry or UI-only financial contract. AF01 must define/reconcile authoritative expiry/admission before claiming expiry acceptance |
| All account/async/offline/combined/localized journeys | **OPEN, MUI-09/AF03/AF08**: this bounded change does not qualify existing Crypto controller races or real account/provider permissions. No controller change or new account-isolation claim |
| MSN funding/Send integration | **OPEN, AF01/AF00**, reconcile #576 and qualified issuance/quote/receipt/settlement authority, obtain exact protected-path transfers |
| MUI-03/04/06 | **OPEN**, C10 trusted composition/auth/migration and Status/Rooms mounting remain protected AF00/AF05 dependencies |
| MUI-09/MUI-10/AF11 | **OPEN**, combined regression including named global failures; signed installed-source identity; real incoming-call/device/provider qualification |

## Next action and continuation

Prefer MUI-03 when explicit AF00/AF05 transfers become available. Otherwise the next independent queue work is **MUI-09 / AF13 bounded combined regression** on the integrated screens, reporting every unresolved feature acceptance and obtaining exact owner transfers for demonstrated defects. Do not claim whole-audit closure while MUI-03/04/06/07/08 acceptance is open. AF01 quote-expiry contract reconciliation can independently unblock remaining MUI-08 financial acceptance. Avoid more cosmetic changes while these substantive gaps remain.

## Reproducible final commands

From `apps/mobile`, with `/workspace/flutter/bin` on PATH:

```sh
flutter test --no-pub --reporter expanded \
  test/crypto_wallet_test.dart test/wallet_account_fencing_test.dart \
  test/ui/mui08_crypto_test.dart test/ui/mui07_wallet_test.dart \
  test/wallet_service_shortcuts_test.dart test/wallet_models_test.dart \
  test/wallet_http_transport_test.dart test/wallet_receipts_test.dart \
  test/ui/mui01_presentation_test.dart test/ui/mui02_auth_language_test.dart \
  test/ui/mui03_chats_search_test.dart test/app_shell_route_compatibility_test.dart \
  test/calls_screen_test.dart test/call_history_transport_test.dart

dart analyze lib/src/finance/crypto_wallet_screen.dart test/ui/mui08_crypto_test.dart

dart analyze

flutter test --no-pub --reporter expanded \
  --dart-define=MUI08_CAPTURE=/workspace/scratch \
  --dart-define=MUI08_FONTS=/workspace/flutter/bin/cache/artifacts/material_fonts \
  test/ui/mui08_crypto_test.dart

flutter build apk --debug --no-pub
```

Final raw local logs: `/workspace/scratch/mui08-{focused-verified,render-verified,analyze-verified,full-analyze-final,baseline-analyze,apk,rtl-red-corrected}.log`. Captures are synthetic fixtures under `/workspace/scratch`, not committed customer data. CI/release evidence and exact merged main identity follow after normal PR integration.
