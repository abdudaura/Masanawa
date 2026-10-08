# R11 localization integration recovery

- Owner: ChatGPT integration window 2026-10-08 Africa/Lagos.
- Branch: `work/r11-localization-main-integration-20261008`; base current canonical main `8100723f26ca32faabbeaf6e07bcaa27144013f9`.
- Reclaimed prior PR #407 head `e1e8d5e976f92eb33b52e083f8b6ee1137178f06`, inactive more than five minutes and currently conflicting with main.
- Scope: R11 resources, locale providers, l10n.yaml, auth/onboarding presentation files, pubspec, tests and `apps/mobile/lib/main.dart` exact merge. New claim path owned here.
- Only shared collision `apps/mobile/lib/main.dart`: retain R01 `ThemeMode.light` and white-first theme while integrating persisted UI locale. The latest main versus old PR version differs only in localization additions and explanatory comment on ThemeMode.light, as manually compared.
- Do not modify deployment, wallet/billing or migrations. Need Flutter/Dart analyzer and handset RTL/device verification when toolchain is available.
- Status: claim published; integration commit pending; old #407 will close only after successful reviewed replacement merge.
