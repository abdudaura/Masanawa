# MUI-02 — AF08 authentication language alignment

## Identity and current state

- Reconciled main/base: ada66c61ce7e34393aa452487da079cfb1d65fc1. MUI-01 source 3076b26056e6c1ad4e3958f1126e193198409b76 was merged through PR #678 at 18bdd8140a2bdf78b8cccfdb42a8030a5452d52c and its shared presentation remains unchanged.
- Source/test head before this handoff: 651b857d2d5de56f7c40db1095745ab5c36887be. Source implementation 173ac943dc90c87cd29897a570c5c5901707591c, first test commit 8231ea345396b4920ecb8e2e1bebedbb5d2609b5, formatting commits d2d0cb001f862a0c0e763160772d614ac7c02b7b and 4bf60f214211aaa56fa87024ed7975057c037ea3, corrected semantics assertion 651b857d2d5de56f7c40db1095745ab5c36887be.
- Branch: lane/af08-mui02-auth-language-20261012-gpt6; [PR #680](https://github.com/weavewellindustrieslimited/masanawa/pull/680) against main. **UNMERGED** because new relevant widget tests have not executed. No merge/main SHA is claimed.
- Claim: af08-mui02-auth-language-20261012-gpt6 in factory/claims, acquired at 91ca3118eac5e795ed4ed9dea79344c98461c92a. Paths inspected against existing live claims before acquiring. Release after this handoff.
- Implementation: **IMPLEMENTED_UNVERIFIED**, with unmerged PR source. Verification: **PASS_SOURCE_INSPECTION_ONLY** for invariants, GitHub CI Flutter install PASS and analyzer FAIL on 329 unchanged baseline diagnostics; all new widget cases **NOT_RUN**. Release: **NOT_RELEASED**.
- Exact changed paths: apps/mobile/lib/src/screens/onboarding/phone_login_screen.dart; apps/mobile/lib/src/screens/onboarding/password_screen.dart; apps/mobile/lib/src/screens/onboarding/otp_screen.dart; apps/mobile/lib/src/screens/onboarding/name_screen.dart; apps/mobile/test/ui/mui02_auth_language_test.dart; this docs/workstreams/UI-MUI-02-auth-language.md handoff.

## Delivered source and open acceptance

- All four existing production-mounted auth routes /phone-login, /password, /otp and /name use a direction-neutral centered Align wrapper around the existing LanguagePickerButton, replacing end alignment. The existing icon, accessible Material TextButton, translated label, modal language choices and persisted LocalePreferenceController are unchanged.
- OTP/password six digit boxes use LayoutBuilder to fit the 320px padded form instead of overflowing six fixed 47px boxes in the 272px content space. Auth state, code handling, focus, OTP resend, identity, password entry and routing were not changed.
- The new test file authors 32 mounted-route widget cases (4 routes × 320/390 widths × English/Arabic RTL × 1×/2× large text), checking center geometry, available button/icon, semantics tap action and absence of exceptions. An additional case selects French, checks saved choice and navigates to password retaining localization: **33 authored, not executed**. These represent acceptance still **OPEN**, not a visual test pass.
- The five-tab shell Chats · Status · Wallet · Calls · Rooms, default Chats, Masana-only contacts, native/group/history/billing/incoming Calls, shared MUI-01 header/search, Status/media, Rooms, existing auth and financial source are untouched. No second ledger, Cr-to-MSN relabel, fake valuation/record, unsupported publishing or Create Room was added. AF05 separate voice work and AF11 device/provider qualification are unaffected.

## Executed checks and nonwaived blockers

- GitHub per-file base/source inspection at source 651b857d2: **PASS_SOURCE_INSPECTION_ONLY**; each auth widget has exactly one centered language picker, none end-aligned, all pre-existing sessionProvider notifier calls, watches and navigation call counts unchanged; both six-box layouts modified with the expected LayoutBuilder, regression file includes the intended matrix/persistence cases. This is not Flutter widget test or render evidence.
- [Mobile Build run 38273141731](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38273141731) on earlier 8231ea345: Flutter install PASS; flutter analyze FAIL with 330 diagnostics, including one introduced SemanticsNode.hasAction API error. **Repaired** at 651b857d2 by using getSemanticsData().hasAction.
- [Mobile Build run 38273525989](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38273525989) at corrected 651b857d2: install PASS; flutter analyze **FAIL, 329 existing diagnostics**, zero introduced MUI-02 diagnostics; workflow's flutter test step **SKIPPED** because analyze failed first. This is not an analyzer PASS and does not run or prove the 33 tests.
- [Foundation CI run 38273525981](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38273525981) at corrected head: typecheck FAIL at existing packages/agents/src/talk-replay.test.ts:6 TS2459, TalkId declared locally but not exported; backend test stage skipped. Same known baseline as MUI-01.
- Current environment cannot execute Flutter/Dart/Android builds or render phone UI. Not run here: flutter test on MUI-02 and existing MUI-01/auth regressions, focused dart analyze, 320/390 pixel/RTL/large-text render inspection, keyboard/auth end-to-end, signed APK/device testing. Prior MUI-01 delivered evidence reported 329 analyzer diagnostics and nine full-suite Flutter failures on its different source; those are **not passes in this window**.
- Reviewer checked changed paths against claims and structural auth preservation. New test syntax was analyzed through GitHub Mobile Build, but executable widget runtime remains a merge gate. Do not merge or publish an installed-app claim until run.

## Remaining acceptance, owner, smallest next action

1. **AF08, Flutter-capable runner**: check out PR #680 latest exact head, run from apps/mobile: flutter pub get; flutter test test/ui/mui02_auth_language_test.dart test/onboarding_scaffold_test.dart test/localization/language_picker_button_test.dart test/password_screen_test.dart test/ui/mui01_presentation_test.dart; run focused dart analyze on changed paths. Fix any real widget/layout exceptions, especially at 320/390px, 2× text, Arabic RTL, accessibility, picker selection and keyboard. Capture mounted render results. Recheck auth flows and locale storage.
2. **AF08 integrator**: inspect latest main/claims, review the PR after executable widget pass, and merge compatible source to main with actual merge SHA. Current PR #680 is unmerged and the 33-case matrix is not qualified. Existing full-repo 329 analyzer findings and backend TS2459 require separate owner remediation, not disabling or waiving.
3. **MUI-03…08 owners**: Chats authorized search including query/account fences, clear/no-results/offline/pin/read/archive/open; connected real Status/media, complete paginated Calls search while preserving incoming/native/group/history/billing; persistent Rooms with retry/account fencing and paid entitlement (unavailable is not empty); truthful Wallet/MSN funding/send and crypto activity/receipts/uncertain-operation recovery. The audit queue acceptance remains OPEN.
4. **MUI-09 AF13**: combined 320/360/390/430px, large-text/RTL/keyboard/account-switch/Rooms/search/wallet regressions and integration verification. Preserve pre-existing nine Flutter failures and 329 analyzer diagnostics for their respective owners.
5. **MUI-10 release/device owner and AF11**: exact source-to-signed-artifact-to-installed-app identity, real device auth/search/Status/Rooms/wallet; incoming-call/device/provider/native group qualification remains open, not implied by this UI patch.

Smallest next action: run the 33-case auth language widget suite on a Flutter runner, fix any introduced failing case, review and merge #680 if compatible. If #680 is owned by another window, choose the next unclaimed dependency-ready queue milestone, preferring MUI-03 Chats search consuming MUI-01 shared ConversationSearchField.

## Next queue-aware prompt

~~~text
Continue weavewellindustrieslimited/masanawa from fresh origin/main.
Read AGENTS.md, CONTINUE-HERE.md,
docs/workstreams/UI-CONTINUATION-QUEUE-20261012.md,
docs/workstreams/UI-NEXT-WINDOW-PROMPT-20261012.md and
docs/workstreams/UI-MUI-02-auth-language.md.

MUI-01 source 3076b2605 was merged in PR #678 at 18bdd8140.
Preserve its shared presentation and regression tests.
MUI-02 / AF08 PR #680 has source/test 651b857d2 (plus its handoff commit),
with four mounted auth language controls centered and 33 widget cases
authored but NOT EXECUTED. GitHub mobile analyzer reports 329 existing
diagnostics; backend TS2459 is also baseline. Reconcile latest PR/main
and claims, run relevant Flutter widget tests at 320/390px, 1×/2× and
Arabic RTL; retain locale persistence, semantics and authentication.
Fix introduced errors and merge only after relevant executable checks.

If MUI-02 has been completed, merged or claimed by another window, select
MUI-03 / AF06: functional Chats search using the merged MUI-01 shared field
and canonical authorized inbox. Cover identifier/name/title matches, clear,
empty/offline/error, query/account fences and pin/read/archive/open.
Otherwise select next dependency-ready unclaimed item from the queue.

Preserve Chats · Status · Wallet · Calls · Rooms, Chats default, Masana-only
contacts, native/group/history/billing/incoming Calls, Status/media, Rooms,
authentication and financial work. No historical wholesale shell merge,
fabricated records/valuations, second ledger, Cr-to-MSN relabel, unsupported
Status publishing/Create Room. Retain all MUI-03…08 acceptance,
MUI-09 mobile/keyboard/large-text/RTL/account regression, MUI-10 signed
installed-app/source identity, and AF11 incoming-call/provider qualification.
Baseline failures and unavailable checks remain documented, not waived.

Claim exact paths; implement/test/review/commit/push/merge compatible source.
Update the selected milestone handoff with exact base/head/merge SHA, PR,
executed commands/results, remaining acceptance, smallest next action.
Release claim and print the next queue-aware prompt directly.
~~~
