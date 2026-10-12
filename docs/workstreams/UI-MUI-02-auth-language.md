# MUI-02 — AF08 authentication language alignment: merged source and executed Flutter checks

## Identity and current state

- **Milestone:** MUI-02 / AF08. Fresh starting `main` / implementation base: `ada66c61ce7e34393aa452487da079cfb1d65fc1`. Previously delivered MUI-01: PR #678 source `3076b26056e6c1ad4e3958f1126e193198409b76`, merged at `18bdd8140a2bdf78b8cccfdb42a8030a5452d52c`, handoff final main `ada66c61c`; its presentation/tests remain untouched.
- **MUI-02 implementation/test SHA:** `651b857d2d5de56f7c40db1095745ab5c36887be`; initial handoff SHA `52d60f3b74cc51baf8cb9991b92dd5fad7abc4f2`; responsive button fix and final source PR head `5cb21b1f1f219f8477eeb6869ef217ce2c07d2b3`.
- **Development source merge:** [PR #680](https://github.com/weavewellindustrieslimited/masanawa/pull/680), merged 2026-10-12 at **`8bc782c2659973f43c6e6e248540c6b16b2a3106`** (actual source-main merge SHA). The PR was reviewed on GitHub before merge (review ID 5493503804). Any later docs-only merge adds a commit on top without changing this source identity.
- **Owner/claims:** original exact-path AF08 claim `af08-mui02-auth-language-20261012-gpt6` was released after its unrun source handoff. Follow-on verification/repair claim `af08-mui02-executable-validation-20261012-gpt6` in `factory/claims` covers all changed source/tests/handoff and an isolated verification workflow. Release when this final handoff is published.
- **Implementation:** INTEGRATED on main for the specified mounted routes and responsive control change. **Verification:** PASS_SIMULATED_WIDGET for the mounted Flutter widget matrix and existing regressions; PASS_REAL for hosted Dart static analysis only. Not a real phone or live-auth provider run. **Release:** NOT_RELEASED, no signed installed build inspected.
- **Merged source/test paths:** `apps/mobile/lib/src/screens/onboarding/{phone_login_screen,password_screen,otp_screen,name_screen}.dart`, `apps/mobile/lib/src/ui/components/primary_button.dart`, `apps/mobile/test/ui/mui02_auth_language_test.dart` and this milestone handoff. The separate `validation/mui02-flutter-20261012-gpt6` branch contains a temporary workflow `.github/workflows/mui02-validation-20261012.yml` **not merged into main**. `phone_field.dart` was inspected/claimed but not changed. No canonical CI, router, ledger, auth contracts or domain Calls/Status/Rooms files were edited.

## Delivered behavior and acceptance

- **Closed in executed widget scope:** language picker centered on mounted `/phone-login`, `/password`, `/otp`, `/name` independently of text direction. Assertions cover each route at 320/390 logical pixels, English/Arabic RTL, 1×/2× text: 32 cases. Picker key, language icon, Material tap semantics and controller persistence unchanged. A 33rd mounted journey chooses French, persists and retains localized label after navigating between auth routes.
- **Closed in executed widget scope:** 320px code boxes are bounded with `LayoutBuilder` on OTP and password without modifying digit input, focus/verification or session handling. A real failure in the first hosted run exposed long `PrimaryButton` labels overflowing at large text; the shared button now wraps expanding label text via `Flexible`, uses min-height and retains the minimum touch target. Rerun confirms no widget overflow in the tested viewport matrix.
- **Existing regressions preserved:** onboarding keyboard-scroll fixture, picker saved-language/error handling and RTL labels, six-field password repeat/entry, and MUI-01 shared header/navigation/search presentation pass on reviewed source.
- **Open beyond simulated widget scope:** on-device rendered 320/360/390/430px screenshots, actual soft keyboard/IME and a complete live authentication/provider journey are not evidenced by simulated widget runs. Signed app/source identity remains MUI-10. These are qualification gaps, not proof that the code change failed.
- Preserved Chats · Status · Wallet · Calls · Rooms (Chats default), Masana-only contacts, existing native/group/history/billing/incoming Calls, Status/media, Rooms, auth, wallet and crypto. No historical shell merge, invented contacts/valuation, duplicate ledger, Cr-to-MSN relabel, unsupported publishing or Create Room.

## Executed checks with SHAs and scope

- **PASS**, [hosted Flutter run #38276920855](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38276920855), validation commit `7ad7e2d2468e6ad0db0d0c88513faa7900b2f122` (Flutter stable 3.47.7, ubuntu-latest):
  - `cd apps/mobile && flutter pub get` — PASS.
  - `flutter test --reporter expanded test/ui/mui02_auth_language_test.dart` — **33 passed**.
  - `flutter test --reporter expanded test/onboarding_scaffold_test.dart test/localization/language_picker_button_test.dart test/password_screen_test.dart test/ui/mui01_presentation_test.dart` — **22 passed**.
  - `dart analyze lib/src/screens/onboarding/name_screen.dart lib/src/screens/onboarding/otp_screen.dart lib/src/screens/onboarding/password_screen.dart lib/src/screens/onboarding/phone_login_screen.dart test/ui/mui02_auth_language_test.dart lib/src/ui/components/primary_button.dart` — **PASS, no issues found**.
  - Exact GitHub blob SHAs of all six app/test source paths in validation commit `7ad7e2d` were compared with PR final source head `5cb21b1` and **all six match**. The validation runner differed only in branch and temporary workflow/history, not executable source.
- **Detected then fixed:** initial validation [#38275153592](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38275153592) executed the 33 tests and found 7 overflow failures in 320/390 2× and language-switch cases. `PrimaryButton` responsive fix subsequently made the same matrix pass. Another validation run [#38276377495](https://github.com/weavewellindustrieslimited/masanawa/actions/runs/38276377495) failed because temporary workflow accidentally appended `primary_button.dart` to `flutter test` positional arguments, **not** because of an app test failure; validation YAML was corrected and final run #38276920855 passed. The temporary workflow is not merged.
- **Baseline unrelated failures, not waived:** standard Mobile Build still reports 329 existing whole-project analyzer diagnostics and skips its later test/build steps; Foundation CI fails with the existing `TalkId` TS2459 in `packages/agents/src/talk-replay.test.ts`. Prior MUI-01 whole-suite result had nine unrelated Flutter failures on its earlier source; this milestone does not claim a new whole-suite pass.
- **Not run:** installed Android/iOS UI, real IME, live account/provider registration/login, production gateway authorization, signed APK/source identity, AF11 incoming-call/device/provider flows. No simulated success is called a production pass.

## Remaining queue and smallest action

MUI-02 source is merged and scoped Flutter verification passed. Next **MUI-03 / AF06**: implement and execute canonical authenticated Chats inbox search using MUI-01 `ConversationSearchField`, including contact/title/supported identifier matches, dynamic query/clear, no-results/loading/offline/error, stale query and account fencing and unchanged pin/read/archive/open actions. Claim exact paths, avoid AF00 router/common composition without an explicit transfer, test against real authorized inbox DTOs. If MUI-03 has an active owner or is already complete, choose the next dependency-ready, unclaimed MUI-04…08 milestone from `UI-CONTINUATION-QUEUE-20261012.md`.

**Keep open:** MUI-04 live Status/media, MUI-05 paginated real Calls-history search without losing native/group/history/billing/incoming, MUI-06 persistent Rooms/unavailable-vs-empty/entitlements, MUI-07 truthful MSN wallet/funding/send, MUI-08 crypto quote/receipts/uncertain status, MUI-09 integrated mobile/keyboard/large-text/RTL/account visual and functional regressions, MUI-10 signed installed-app-to-source identity and AF11 device/provider incoming call qualification. No external missing input should stall independent source work.

## Next queue-aware continuation prompt

~~~text
Continue weavewellindustrieslimited/masanawa from fresh origin/main.
Read AGENTS.md, CONTINUE-HERE.md,
docs/workstreams/UI-CONTINUATION-QUEUE-20261012.md,
docs/workstreams/UI-NEXT-WINDOW-PROMPT-20261012.md,
docs/workstreams/UI-MUI-02-auth-language.md,
and docs/workstreams/UI-MUI-01-foundation.md.

MUI-01 PR #678 source 3076b2605 merged 18bdd8140, handoff main ada66c61c.
MUI-02 PR #680 final source 5cb21b1f1f219f8477eeb6869ef217ce2c07d2b3
merged into main at 8bc782c2659973f43c6e6e248540c6b16b2a3106.
Hosted isolated validation run #38276920855 at 7ad7e2d (six exact
app/test blobs equal PR source) passed 33 new auth language widget tests,
22 existing auth/MUI-01 tests and focused Dart analysis (zero issues).
Preserve four centered auth selectors, persisted locales, primary button
large-text wrapping, OTP/password input and authentic session handlers.
Keep whole-repo 329 analyzer diagnostics, TalkId TS2459 and prior nine
unrelated whole-suite failures separate; none is waived or passed.
No signed-device or live-provider verification is claimed.

Prefer MUI-03 / AF06: functional Chats search using MUI-01
ConversationSearchField and canonical authenticated inbox. Search
real authorized name/title/supported identifiers across appropriate
data, dynamic typing and clear; no results, loading, offline and error;
fence stale query and account transitions; preserve pin/read/archive/open.
Inspect fresh main, relevant source/PR heads and factory/claims, select
only unclaimed exact paths, coordinate AF00 protected root hooks.
If already merged/actively owned, choose earliest ready unclaimed
MUI-04…08 from the queue. Do not repeat MUI-02 source work.

Preserve Chats · Status · Wallet · Calls · Rooms with Chats default,
Masana-only contacts, native/group/history/billing/incoming Calls,
Status/media, Rooms, auth and finance. No historical shell replacement,
fake records/valuations, second ledger, Cr-to-MSN relabel, unsupported
Status publishing or Create Room. Keep remaining MUI-03…08 acceptance,
MUI-09 integrated 320/360/390/430px, keyboard, large-text, RTL,
account regression, MUI-10 signed installed-app/source identity and
AF11 device/provider incoming-call qualification explicitly open.

Claim exact paths in factory/claims. Implement connected code; execute
relevant tests, fix regressions, review, commit, push and merge safe
source into main with branch protections. Distinguish baseline failures,
unavailable external checks, source integration and release.
Update selected milestone handoff with base/source/merge SHAs, PR,
changed paths, executed results, remaining acceptance, smallest next
action. Release ownership. Print the next queue-aware prompt directly.
~~~
