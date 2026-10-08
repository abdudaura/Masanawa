# R17 — Wallet to private Talk service-intent handoff (2026-10-08)

Owner/window: ChatGPT R17 private service handoff, isolated branch.
Branch: `work/r17-wallet-private-intent-handoff-20261008`
Base main SHA: `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`
Task references: R17 P0 (and R06–R08 dependencies). This is a bounded client handoff, **not** a claim to monetary transaction execution or voice-first full acceptance.

## Exact intended owned paths
- `apps/mobile/lib/src/screens/twin/twin_home_shell.dart` — only Wallet shortcut callback / private Talk handoff; existing R11 localization work must be preserved on integration.
- `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart` — typed one-time private service-intent initiation, no auto microphone/charge.
- `apps/mobile/lib/src/services/private_service_intent.dart` — strict intent identity, unambiguous plain-language presentation / safe handoff.
- `apps/mobile/test/private_service_intent_test.dart` — mapping / duplicate/reselection/recovery regression coverage.
- this claim file.

Do **not** edit `app_router.dart` (R04 #433), `wallet_screen.dart` (R06 #438), `billing_screen.dart` or provider/quote/funding code (R05 #440), R11 ARB files or any server commerce or task authority.

## Preflight and dependencies
- Current main verified at base SHA, read `CONTINUE-HERE.md`, `MULTI-WINDOW-WORK.md`, all current product/voice-first contracts and R01–R19.
- Active PR file ownership checked for #442, #441, #440, #439, #438, #435, #433, #426. #426 shell localization was last updated 2026-10-08T05:28:52Z and has an expired five-minute lease at the time of claim. Preserve its useful changes and avoid its changed regions.
- Existing Wallet root actions currently open separate Billing/Crypto screens, while private Chat auto-sends `initialPrompt`; the new path must **not** auto-send a financial confirmation or start the microphone.
- R06/R07/R08 own durable quote/task/payment workflows. A client-only handoff cannot authorize payment or replace that contract.

## Current step
Claim created before implementation. Evidence not yet available; tests, deployment and device verification all NOT RUN. This document will be updated with actual commit, checks and next steps.
