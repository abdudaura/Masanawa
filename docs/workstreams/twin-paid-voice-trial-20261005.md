# Twin paid voice + configurable trial workstream

Owner/window: current ChatGPT implementation window
Branch: `work/twin-paid-voice-trial-20261005`
Base SHA: `584c75ec1f7be4b437040c2554d1afe03457509d`
Tasks: TWIN-040..045 plus trial-policy extension

## Scope

Implement Lane E without touching shared Live voice transport/composition:
- reusable admin-configurable paid-feature trial policy;
- initial default trial duration: 7 days;
- paid twin voice quote/admission contract;
- trial-aware quote result;
- explicit paid/trial consent model;
- isolated Gateway route/service contracts;
- mobile paid-voice quote/consent models and sheet as new files;
- focused tests.

## Owned paths

- new `packages/commerce/src/trial*.ts`
- new `packages/commerce/src/voice-product*.ts`
- new `services/gateway/src/paid_feature_trial*.ts`
- new `services/gateway/src/paid_voice*.ts`
- new `apps/mobile/lib/src/voice/**`
- new `apps/mobile/lib/src/screens/chat/components/paid_voice*.dart`
- this claim file
- narrow twin-economy docs updates for trial policy

## Explicitly not owned

- existing Commerce model/repository/settlement files
- Commerce migrations/active billing/crypto files
- `services/gateway/src/app.ts`, `main.ts`, `agent_shell_routes.ts`, `live_voice_token.ts`
- `apps/mobile/lib/src/router/app_router.dart`
- `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`
- existing Live voice transport/audio files

## Product decision

All paid twin features may expose an admin-configurable trial. Initial policy default:
7 calendar days from first qualifying use. Trial must be policy/version based, not a
permanent code constant, and may also carry usage caps. No paid charge may occur while
an admitted trial entitlement covers that usage.

Status: implementation started 2026-10-05.
