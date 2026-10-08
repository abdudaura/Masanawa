# R11 localization — professional infrastructure checkpoint (2026-10-08)

Owner: ChatGPT R11 localization window
Branch: `work/mobile-locale-foundation-r11-20261008`
Base main SHA: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`
Last code commit: `53b3600fec3a9812452e67c204eb9ec258bbb91c`
Owned: `apps/mobile/lib/src/screens/splash/splash_screen.dart` (splash tagline only, first bounded user-facing localization integration), `apps/mobile/l10n.yaml`, `apps/mobile/lib/l10n/app_*.arb`, `apps/mobile/lib/src/localization/*`, `apps/mobile/lib/main.dart`, `apps/mobile/pubspec.yaml`, `apps/mobile/test/localization/*`, this claim.
Additional bounded R11 ownership: `apps/mobile/lib/src/ui/components/onboarding_scaffold.dart` (RTL back-control positioning/tooltip only), `apps/mobile/lib/src/ui/components/phone_field.dart` (decimal digit input normalization and localized dial-code status; no country/provider policy edits). Additional bounded ownership for next R11 implementation: `apps/mobile/lib/src/screens/onboarding/{phone_login_screen,otp_screen,name_screen}.dart` and localization-focused onboarding widget tests. These screen files are not owned by the currently open R01/R02/R03/R12/R16/R17 PRs. Out of scope: theme R01 (#406), router/shell R17 (#411), Settings R12 (#409), shared backend, finances and migrations.

## Implemented (not yet released)
- Switched away from the 14-label hardcoded Dart lookup to official Flutter gen-l10n typed generated resources. Removed previous handwritten lookup and its test.
- ARB sources for English, Hausa, Arabic, French, Spanish and Portuguese. English template contains translation context, ICU pluralization, typed money-label placeholders; each locale contains corresponding translations. Initial vocabulary only, not full app localization.
- `generate: true`, `intl`, `l10n.yaml`, and generated delegate wired into `MaterialApp`.
- Device-locale negotiation with English fallback; Arabic RTL uses Flutter Widgets delegate.
- Improved locale matching to use the complete ordered OS language list (e.g., German then Arabic chooses Arabic instead of English), plus regression test.
- Added secure persisted manual UI locale selection controller, null=follow OS locale, save-before-apply semantics, graceful storage-read failure, and lifecycle-safe MaterialApp rebuilding without resetting router. This is infrastructure only: settings selector has not yet been wired.
- Added focused controller tests for restart persistence, clearing overrides, corrupt storage, write failure, unsupported locales.
- Added ARB integrity test for exact key parity, required template metadata and interpolation identifiers; corrected missing unchanged-brand key in all five non-English ARB catalogs. The test exists but execution remains unverified.
- Added generated-resource, ICU plural, formatting and RTL tests.
- Presentation-only formatters for numbers/dates/native financial amounts; never convert balances or decide currency based on language.
- Deliberate Hausa restriction: stock Flutter Material/Cupertino localizations lack Hausa. Its ARB app-language messages exist but native dialog/calendar controls require a correctly audited Hausa framework delegate. Current MaterialApp supportedLocales remain en/ar/fr/es/pt; Hausa is **not** claimed working.
- Legacy `MasanawaStrings` lookup removed. The actual splash screen now uses `AppLocalizations.of(context).splashTagline` rather than an English hardcoded slogan. New translation reflects human/AI live conversations across six ARBs; tests assert English, Hausa, Arabic generated strings. Other screens remain unconverted.

## Required validation before merging
```sh
cd apps/mobile
flutter pub get
flutter gen-l10n
flutter analyze
flutter test test/localization/
flutter test
```
All commands still **NOT RUN** in this connector-only session. Generated localization Dart output has not been committed; Flutter tool generates it from ARB inputs at pub-get/build time.
Potential generator issue: confirm ICU plural syntax in all six bundles and resource attributes against installed Flutter SDK; repair before merging.
Merge with theme PR #406 carefully: both PRs touch `main.dart` while owning different sections. Theme owns `ThemeMode.light`; R11 owns localization delegates. Preserve both, not a last-writer overwrite.

## Completion requirements (R11 still OPEN)
1. Proper Hausa Material/Cupertino translations and locale delegate tests; do not alias Hausa to a different language silently.
2. Move entire UI to generated typed keys (including auth, Talk/Seats, profiles, finance, errors, permissions, receipts, privacy and support), avoid untranslated fallback in release.
3. Add a working Settings language selector wired to the persisted controller (currently controller exists but no user-facing selection route), and verify runtime OS locale changes on device.
4. Unit/RTL/golden/widget/device tests for long strings, dynamic currency/date formats, bidi identifiers, screen reader/accessibility and large text.
5. Native translators review copy, including Hausa terminology and safety/financial consent phrases. Confirm correct plural/RTL in context.
6. Keep UI language, conversation/code switching, account jurisdiction and provider currencies completely separate.
7. Run actual package resolution/tests and APK verification before claiming production quality.

CI workflow creation attempted but blocked; do not claim workflow installation or CI coverage. Focused test code committed but execution still unverified.

Most recent implementation SHA: `f033d5f84eb21878e8ca8cc5ea11ff31bab371f5`. Flutter gen-l10n, analyzer, widget tests and runtime localization still unexecuted in this environment. R11 is PARTIAL, unmerged, deployed NO, device acceptance NO. Update resource descriptions and translated terminology with professional translator review before marking fully localized. Five-minute lease applies.
