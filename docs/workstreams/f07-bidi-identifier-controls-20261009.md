# F07 / R11 — bidirectional identifier display recovery (2026-10-09)

**Status: PARTIAL_IMPLEMENTATION for F07/R11; isolated source fix committed and static-reviewed, DRAFT / UNMERGED / NOT E2E VERIFIED / NOT DEPLOYED.**

## Ownership and immutable provenance

- Base `main`: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Exact-path five-minute CAS claim on `factory/claims`: `47d7ddc6bf8b930b664d1ab175400ec606495822`, claim ID `gpt6-f07-bidi-controls-20261009-0448`; this was committed **before source editing**.
- Branch: `work/f07-bidi-identifier-controls-20261009-gpt6` (draft PR; see branch/PR metadata for final HEAD).
- Source commit: `2dab528c871cb2e5f371fa954ae738e4aa6179b8`, blob `7454dc2af7ca28ef885502009e5fd7414feafaf0`.
- Test commit: `b93f69e7f2887ba0a3c389ac1d23c2e6ff37bfd3`, blob `0d0d87a52551ca829e44f1a89f4f7d39cb69a202`.
- Exact owned paths only:
  - `apps/mobile/lib/src/localization/bidi_display.dart`
  - `apps/mobile/test/localization/bidi_display_test.dart`
  - `docs/workstreams/f07-bidi-identifier-controls-20261009.md`

## Real change / requirement trace

**F07/R11 — safe multilingual and Arabic/RTL identifier presentation.** The existing `BidiDisplay.identifier` display projection removed embedding/override/isolate controls but left the implicit directional marks U+061C (ALM), U+200E (LRM) and U+200F (RLM). These also affect bidirectional ordering, even when the helper wraps an identifier with its own balanced LRI/PDI. The patch strips the **complete Unicode Bidi_Control property set** from the *display-only string* and then retains the established single balanced isolate pair for RTL contexts; unmodified LTR display remains unwrapped. It does **not** mutate request values, account references, financial authorization, phone numbers, provider payloads, user records or persisted identifiers.

The change follows Unicode Standard Annex #9 (Unicode 18.0, 2026-09-01): https://www.unicode.org/reports/tr9/ . Tests cover LTR and RTL handling for all twelve controls, safe preservation of Arabic/Hausa content and punctuation, existing email/phone cases, raw input immutability, empty identifiers and override removal. UI entry is the preexisting display helper; no new page, route, component or user action is introduced.

## Executed evidence / not executed

- **PASS — fetched-source structural check** using GitHub connector readback at exact blob SHAs above: the source regex matches **12/12** current Unicode Bidi_Control code points and does **not** strip three normal ASCII/Arabic identifier samples; source still strips into a separate `displayValue` and wraps only RTL nonempty output. This is a JavaScript regex projection of the Dart source pattern, **not a Dart or widget test**.
- **PASS — authored-test inspection:** six `flutter_test` Dart test groups present on the pushed branch. **NOT RUN**: the actual tests: no Dart/Flutter SDK installed in the available environment.
- **NOT RUN**: Dart formatting/analyzer, Flutter test runner, actual RTL font rendering/assistive technology, large text/device testing, release APK, Firebase, backend/auth/DB/migration, financial providers, physical device/CI #457. Static checks do **not** imply build/UX/E2E success.

## Integrator commands and remaining work

On a real checked-out **composed integration SHA**, after reconciling R11 PRs #426 (shell locale), #482 (Settings preference), #501 (financial text) and F07 #542 (catalog audit):

```sh
cd apps/mobile
flutter pub get
dart format --output=none --set-exit-if-changed lib/src/localization/bidi_display.dart test/localization/bidi_display_test.dart
flutter analyze
flutter test test/localization/bidi_display_test.dart
flutter test test/localization
```

Then inspect a real signed-in Arabic RTL experience on a supported low-end Android device (email, phone, account/operation reference), test accessibility and an LTR locale, and verify text copied or sent to APIs is the **original authoritative identifier**, never the display projection. Any observed live formatting disagreement blocks release. Re-run at merged SHA.

## Dependency and collision guard

This independent F07 recovery does not touch existing F07 #542 audit, R11 #426/#482/#501, five-tab Flutter root, shared Gateway auth/composition, databases/migrations, money/custody/providers, Firebase/native config, central CI, WhatsApp/Telegram or production. Final root app stays **Talks · Chats · Assistant · Wallet · Agents**. Preserve all those draft PRs pending the owner-controlled integrator and device acceptance. Do not conflate this patch with completion of R11 locale coverage or full F07 acceptance.
