# R11 — Authenticated Settings language preference (2026-10-08)

Window: ChatGPT GPT-6 isolated R11 Settings-access lane; claim recorded by this branch commit. Five-minute activity lease; refresh on each pushed source/handoff commit. Branch: `work/r11-settings-language-preference-20261008`. Base: `main` at creation (initial observed `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`).

## Exact owned files
- `apps/mobile/lib/src/screens/settings/settings_screen.dart` (only additive language entry, preserve all existing Settings behavior)
- `apps/mobile/test/localization/settings_language_preference_test.dart` (new regression suite)
- `docs/workstreams/r11-settings-language-preference-20261008.md` (this claim and final handoff)

No shared Gateway, PostgreSQL, API, identity, theme, root router, ARB, mobile localization core, R17/C08 shell, CI or Android release files. Reuse existing `LocalePreferenceScope`, `LanguagePickerButton`, encrypted device-language preference storage and root `MaterialApp.router` listener. Scope is a **local device UI-language selector in authenticated Settings**, not global R11 localization acceptance; UI locale must not mutate account market, currency, server locale or speech preference.

## Collision/dependency review
- Open R18 avatar PR #435 also changes `settings_screen.dart` but its last visible update was stale when inspected. Preserve and reconcile avatar edit in final Work integration; do not replace or force-push #435. Our change is additive to Settings currently on main; root localization is already merged, R11 root-shell draft #426 edits other files.
- Other C and R lanes own Gateway, contacts, communications, shell, finance, Firebase and release verification.
- Shared CI incident #457 is reserved for owner Work; GitHub Actions quota/runner is externally blocked.

Status at claim: PARTIAL_IMPLEMENTATION. Implementation and verification evidence will be appended before checkpoint. Applicable data migration/DB/API/auth: **N/A** — existing preference is intentionally encrypted *on device*, not an account/profile field or financial-market setting; all language selection is deterministic local state and survives app restart via existing secure storage.

## Pushed implementation checkpoint / final single-Work handoff

Updated (UTC): 2026-10-08 11:29; owner: GPT-6 R11 Settings window
Status: **IMPLEMENTED_UNVERIFIED for this bounded Settings language-entry feature only. R11 as a whole remains PARTIAL_IMPLEMENTATION/OPEN.** Do not mark feature DONE or merge until actual executable evidence.
Claim activity: last source push commit `18786c56c3c13976ffe9f2bb22a12450a7c9b358`; this documentation commit will follow. No ownership claim over #435 avatar changes.
Base main: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`.
Branch: `work/r11-settings-language-preference-20261008`; draft PR: https://github.com/Baatiku/masanawa/pull/482; source head before this checkpoint: `18786c56c3c13976ffe9f2bb22a12450a7c9b358`; current pushed HEAD available from the linked PR.
Requirement/acceptance: R11 international language/manual override requirement in `MOBILE-READINESS-PLAN.md`, multilingual/silent user journey J11, privacy/language separation in `APP-SHELL-CONTRACT.md`. This is a localized Settings entry, not claims about all 77 requirements or full global-localization readiness.

### Source layers and integration

- UI: `apps/mobile/lib/src/screens/settings/settings_screen.dart` has an additive, visible, authenticated Settings entry using the production `LanguagePickerButton`, inside existing white/light themed preferences section.
- State/restart: existing `LocalePreferenceScope` is already above the real application router; existing encrypted on-device `SecureLocalePreferenceStore` writes before UI selection changes and reloads on restart; device-language reset removes the saved override. The Settings entry adds **no parallel state or persistence**, no app-router replacement or background mic.
- Language/RTL/error: existing picker lists only framework-supported en/ar/fr/es/pt, shows Hausa as unavailable pending a proper native framework delegate, exposes partial-translation notice, reports encrypted-store failure and preserves old preference. RTL goes through existing Flutter localization delegates.
- Tests authored: `apps/mobile/test/localization/settings_language_preference_test.dart` (3 signed-in Settings widget cases with test-only controlled session/directory and in-memory fault-injecting store): French write/reset, Arabic restoration/RTL after restart, and fail-closed storage write. Test fakes are **only in the test**, not production.
- Database/migrations, Gateway/API/auth mutations, media/event/outbox/finance: **N/A** for this deliberate device-local UI-language preference. The app keeps existing canonical account auth and no server profile/locale, spoken-language, region or currency are changed.

### Verification

- **Actually executed:** GitHub API readback after pushes: both changed source paths exist; localized Settings imports and renders `LanguagePickerButton`; test file contains three `testWidgets` cases. GitHub compare on branch before documentation update: exactly two mobile source/test files plus this claim, 3 commits ahead and 0 behind the observed main SHA. GitHub PR #482 created in **draft** state. These are static/commit checks, **not Dart tests**.
- **NOT executed** because Dart/Flutter toolchains are absent and direct `github.com` clone DNS fails in this isolated container. Shared GitHub Actions #457 has independently confirmed quota/zero-step problems. No repeated CI triggers; do not interpret runner failures as code failures or passes.
- **Work commands after checkout at exact PR HEAD:** `cd apps/mobile && flutter pub get && dart format --output=none --set-exit-if-changed lib/src/screens/settings/settings_screen.dart test/localization/settings_language_preference_test.dart && flutter analyze && flutter test test/localization/settings_language_preference_test.dart test/localization/language_picker_button_test.dart test/localization/locale_preference_test.dart && flutter test`. Then `cd ../.. && git diff main...HEAD -- apps/mobile/lib/src/screens/settings/settings_screen.dart`, inspect R18 #435 and combine both independent changes. Run Android debug/release build and real authenticated Settings screen on a budget Android handset with no network, French selection, Arabic RTL, restart and failed/locked secure storage.
- **Backout:** revert this isolated Settings card/import and test without touching encrypted saved preference or financial data; there is no schema migration, new key or remote side effect.

### Cross-PR overlap and Work next actions

1. **R18 #435** currently changes this same Settings screen's public-profile avatar image and name only. Its addition of `talk_social_profile_state.dart` and avatar `NetworkImage` must be retained when integrating #482; the two edits address disjoint hunks. Reconcile using the actual latest diff and tests, not cherry-picked replacements.
2. R11 #426 touches `twin_home_shell.dart` and ARB resources, not this Settings entry. Root `LocalePreferenceScope` and `LanguagePickerButton` used here are already on main. Do not duplicate locale controllers, generate a second Settings language API, or enable unsupported Hausa native framework widgets.
3. Owner Work must recover #457 runner quota and execute **actual** Flutter analyzer/widgets/full test/build and RTL/low-data device checks. If tests fail, fix on this branch or a clean integration branch before merge.
4. Verify Android preference surviving process death and restored old preference on encrypted-store write failure, as well as nonmutation of account/financial locale. Validate that all other Settings functionality and R18 avatar still operate.
5. Only merge a conflict-reconciled and genuinely verified implementation. Global R11 still requires complete app translation and native language review.

Release evidence flags:
- SOURCE_WRITTEN: yes (Settings/real controller path); LOCAL_TESTED: no; CI_EXECUTED: no; DB_INTEGRATED: N/A; APP_INTEGRATED: source path wired, runtime unverified; DEVICE_VERIFIED: no; PROVIDER_QUALIFIED: N/A; DEPLOYED: no; MERGED: no.
- Missing code *within this bounded feature*: none identified after source review; missing broader R11 production scope: full-screen translated copy, supported Hausa Material/Cupertino delegates, complete screen-reader and RTL language QA, mobile SDK/device verification. Do not misclassify broader R11 as complete.
