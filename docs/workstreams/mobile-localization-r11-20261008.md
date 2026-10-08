# R11 localization — professional infrastructure checkpoint (2026-10-08)

Owner: ChatGPT R11 localization window
Branch: `work/mobile-locale-foundation-r11-20261008`
Base main SHA: `265f2c5f6db81d076f57ca32dd47db3ff7fb0ad6`
Last code commit: `53b3600fec3a9812452e67c204eb9ec258bbb91c`
Owned: `apps/mobile/l10n.yaml`, `apps/mobile/lib/l10n/app_*.arb`, `apps/mobile/lib/src/localization/*`, `apps/mobile/lib/main.dart`, `apps/mobile/pubspec.yaml`, `apps/mobile/test/localization/*`, this claim.
Out of scope: theme R01 (#406), router/shell, shared backend, finances, migrations.

## Implemented (not yet released)
- Switched away from the 14-label hardcoded Dart lookup to official Flutter gen-l10n typed generated resources. Removed previous handwritten lookup and its test.
- ARB sources for English, Hausa, Arabic, French, Spanish and Portuguese. English template contains translation context, ICU pluralization, typed money-label placeholders; each locale contains corresponding translations. Initial vocabulary only, not full app localization.
- `generate: true`, `intl`, `l10n.yaml`, and generated delegate wired into `MaterialApp`.
- Device-locale negotiation with English fallback; Arabic RTL uses Flutter Widgets delegate.
- Added secure persisted manual UI locale selection controller, null=follow OS locale, save-before-apply semantics, graceful storage-read failure, and lifecycle-safe MaterialApp rebuilding without resetting router. This is infrastructure only: settings selector has not yet been wired.
- Added focused controller tests for restart persistence, clearing overrides, corrupt storage, write failure, unsupported locales.
- Added ARB integrity test for exact key parity, required template metadata and interpolation identifiers; corrected missing unchanged-brand key in all five non-English ARB catalogs. The test exists but execution remains unverified.
- Added generated-resource, ICU plural, formatting and RTL tests.
- Presentation-only formatters for numbers/dates/native financial amounts; never convert balances or decide currency based on language.
- Deliberate Hausa restriction: stock Flutter Material/Cupertino localizations lack Hausa. Its ARB app-language messages exist but native dialog/calendar controls require a correctly audited Hausa framework delegate. Current MaterialApp supportedLocales remain en/ar/fr/es/pt; Hausa is **not** claimed working.
- Legacy `MasanawaStrings` lookup removed. No screens have yet been migrated to `AppLocalizations.of(context)`.

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

Status: implementation partial, tests unexecuted, deployed NO, device acceptance NO. Five-minute lease applies.
