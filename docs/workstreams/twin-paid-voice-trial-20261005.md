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

Status: isolated feature implementation complete; persistence/shared integration pending.

Implemented:
- reusable paid-feature trial policy with default 7 days;
- admin-configurable enablement, duration and optional usage cap contracts;
- trial eligibility/exhaustion/expiry evaluation;
- trial-aware twin voice pricing;
- deterministic zero-charge trial settlement;
- verified paid-usage unit charging and owner/platform split;
- ambiguous usage fails to reconciliation instead of guessing;
- failed-before-media consumes no trial and charges nothing;
- isolated paid voice quote/start Gateway service + route registrar;
- isolated admin trial read/update service + route registrar;
- explicit quote acceptance before voice admission;
- mobile paid-voice quote/admission models;
- Riverpod paid-voice state seam;
- trial/paid quote bottom sheet;
- focused TS and Flutter model tests.

Canonical documentation for the trial rule was separately merged to main in PR #140,
commit 65a801fbd96e53c803ab7d79a00b7ac6588c7e74.

Not yet integrated:
- trial-policy persistence/repository adapter and migrations;
- admin app UI for changing policy;
- Gateway app/main route composition;
- binding paid voice admission to live-token minting;
- server/provider usage-evidence adapter;
- Commerce ledger posting for final voice settlement;
- authenticated mobile transport and ai_chat entry point;
- Activity event emission.

CI:
- GitHub Foundation/Mobile jobs continue to fail before execution with zero steps;
  no compile/test success is claimed from those runs.

Integration rule:
A Live token must not be minted for paid twin voice until a valid trial/paid admission
exists. Client duration is never canonical billing evidence.


## Local verification

Local strict TypeScript verification: `trial.ts`, `voice-product.ts`, and `voice-settlement.ts` compile cleanly with `tsc --strict --noEmit` in isolation.
