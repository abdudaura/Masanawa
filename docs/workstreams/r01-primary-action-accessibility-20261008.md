# R01 — Readable WhatsApp-green primary actions

- Owner/window: ChatGPT R01 follow-on, 2026-10-08.
- Branch: `work/r01-primary-action-accessibility-20261008`; base SHA `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
- Scope: R01 light-theme accessibility for reused onboarding/confirmation action; does not change tokens, root navigation or canonical theme.
- Exact owned paths: `apps/mobile/lib/src/ui/components/primary_button.dart`, `apps/mobile/test/primary_button_contrast_test.dart`, this claim.
- Nonoverlap: active PRs #438 wallet models, #435 avatar/profile, #433 Create, #430 deletion, #426 localization, #436 push, #440 funding. No changes to their paths.
- Confirmed defect: the shared PrimaryButton displays pure white glyphs on bright `#25D366` even though Material theme `onPrimary` deliberately uses dark `#111B21`; primary labels and icons are difficult to read.
- Implementation/test status: CLAIMED; Flutter tests, CI and screenshot/device matrix not yet verified.
- Last activity: claim commit on 2026-10-08 UTC.
