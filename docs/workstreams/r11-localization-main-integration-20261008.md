# R11 localization integration recovery

- Owner: ChatGPT integration window 2026-10-08 Africa/Lagos.
- Branch: `work/r11-localization-main-integration-20261008`; base current canonical main `8100723f26ca32faabbeaf6e07bcaa27144013f9`.
- Reclaimed prior PR #407 head `e1e8d5e976f92eb33b52e083f8b6ee1137178f06`, inactive more than five minutes and currently conflicting with main.
- Scope: R11 resources, locale providers, l10n.yaml, auth/onboarding presentation files, pubspec, tests and `apps/mobile/lib/main.dart` exact merge. New claim path owned here.
- Only shared collision `apps/mobile/lib/main.dart`: retain R01 `ThemeMode.light` and white-first theme while integrating persisted UI locale. The latest main versus old PR version differs only in localization additions and explanatory comment on ThemeMode.light, as manually compared.
- Do not modify deployment, wallet/billing or migrations. Need Flutter/Dart analyzer and handset RTL/device verification when toolchain is available.
- Status: claim published; integration commit pending; old #407 will close only after successful reviewed replacement merge.

## Conflict-resolved integration evidence

- Built one Git tree atop claim branch's original latest-main tree, using all 33 exact blob SHAs from prior PR #407; commit `f803132ba4d0100cf7fc8690a8bec520cb42ba9b`. This preserves newer canonical code rather than replacing the main tree with a stale branch.
- Compared `main.dart` before integration: expected additions are locale imports, preference controller lifecycle, `ListenableBuilder`, `LocalePreferenceScope`, and locale/delegate negotiation. Light-mode selection is semantically identical, differing only in its explanatory comment.
- Checked unrelated critical blobs in integration branch match canonical `main`: `app_router.dart` (R17), `masanawa_theme.dart` (R01), `billing_wallet.ts` (R05), and `talk_live_audio_session.dart` (R02).
- Parsed all six ARB resources (`en`, `ha`, `ar`, `es`, `fr`, `pt`) as valid JSON; they each contain the same 66 translatable keys. Hausa UI remains an explicit fallback where stock Flutter Material delegates lack Hausa, not a claim of full UI qualification.
- Flutter CLI not installed; generated Dart localizations, analyzer and RTL/device screenshots unverified. This is source integration, not R11 release acceptance.
