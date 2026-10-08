# R01 — Readable WhatsApp-green primary actions

- Owner/window: ChatGPT R01 follow-on, 2026-10-08.
- Branch: `work/r01-primary-action-accessibility-20261008`; base SHA `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
- Scope: R01 light-theme accessibility for reused onboarding/confirmation action; does not change tokens, root navigation or canonical theme.
- Exact owned paths: `apps/mobile/lib/src/ui/components/primary_button.dart`, `apps/mobile/test/primary_button_contrast_test.dart`, this claim.
- Nonoverlap: active PRs #438 wallet models, #435 avatar/profile, #433 Create, #430 deletion, #426 localization, #436 push, #440 funding. No changes to their paths.
- Confirmed defect: the shared PrimaryButton displays pure white glyphs on bright `#25D366` even though Material theme `onPrimary` deliberately uses dark `#111B21`; primary labels and icons are difficult to read.
- Implementation/test status: CLAIMED; Flutter tests, CI and screenshot/device matrix not yet verified.
- Last activity: claim commit on 2026-10-08 UTC.

## Implementation checkpoint — 2026-10-08 UTC

- Code `8836065f5c2e82c9db954302f5e0be6a290c253c`: PrimaryButton foreground is now the theme's semantic onPrimary for enabled green button labels/icons, while disabled and loading remain muted. No raw white foreground remains in this shared component.
- Regression `f7ee98635f215eeb8fb001855d5cfefd8f809c63`: computes WCAG luminance contrast, checks enabled button tap and dark foreground, disabled/null no-action paths, and loading spinner/no-resubmission.
- Static GitHub readback checked: semantic onPrimary path and 5 authored widget/unit tests present. **Flutter test/analyze/build NOT EXECUTED** in this environment (Flutter SDK unavailable). Foundation CI check may fail without runner steps; inspect before merge.
- Scope remains R01 PARTIAL. No screenshot matrix, handset verification or deployment; do not claim that all app surfaces are light/readable. Theme factory and native Android resources were merged before this lane and were not overwritten.
- Handoff: `cd apps/mobile && flutter test test/primary_button_contrast_test.dart test/masanawa_light_theme_test.dart`; `flutter analyze`; build/screenshot sign-in + OTP + critical shared confirmations on compact devices and high text scale. Release only after evidence.

## Expanded R01 unclaimed library/Activity surfaces

- Fresh open PR collision review (#445, #444, #443, #441, #440, #439, #438, #436, #435, #433, #430, #426) shows no ownership of `apps/mobile/lib/src/screens/activity/activity_screen.dart`, `apps/mobile/lib/src/screens/you/saved_talks_screen.dart`, `apps/mobile/lib/src/screens/you/my_talks_screen.dart` or new `apps/mobile/test/r01_white_secondary_surfaces_test.dart`.
- Expand this R01 claim to those four exact paths. These normal screens currently explicitly replace the canonical white Material theme scaffold with the grey `surfaceBg` token. Switch the whole screen scaffold to `surfaceCard` (white) without changing individually muted interactive cards, empty states, network logic or navigation.
- Add Riverpod-overridden widget regression verifying real screens render white surfaces and remain accessible in loading/error state. Keep offline/device verification distinct from source changes.

## Expanded R01 white surface paths

- Further audit of main confirmed exactly one explicit `backgroundColor: u.surfaceBg` scaffold in each of the six routes below, overriding the white global ThemeData. These locations were checked against current open PR changed-path lists; no active PR is editing these exact files.
- Additional owned paths: `apps/mobile/lib/src/screens/wallet/wallet_screen.dart`, `apps/mobile/lib/src/screens/talks/talk_home_screen.dart`, `apps/mobile/lib/src/screens/profile/person_profile_screen.dart`, `apps/mobile/lib/src/screens/profile/persona_profile_screen.dart`, `apps/mobile/lib/src/screens/chat/chat_list_screen.dart`, `apps/mobile/lib/src/screens/chat/masana_list_screen.dart`.
- Restrict to replacing the normal scaffold background with the white semantic surface token. Do not edit financial authority, route selection, chat permissions or persona profile business behavior.
