# U09 — private Gemini Live voice operator | SHA-specific implementation handoff

**Updated:** 2026-10-09 UTC. **Status: PARTIAL_IMPLEMENTATION / UNVERIFIED / DRAFT / NOT DEPLOYED.**
**Base main:** `5e758673ae91082520b21b3153da53791ae2cbf3`.
**Branch:** `work/u09-private-voice-operator-20261009-gpt6`.
**Pushed source checkpoint (before this handoff):** `70366269bf78729bf9a74bc588d375fa35656c49`.
**Claim commit:** `98f148ee1786426b1c828d24773c906f433709c0`. First commit was a claim recorded in this exact handoff path *before source edits*. This is a five-minute activity lease, not an indefinite lock.
**PR:** [#534 — U09 private Gemini Live voice operator](https://github.com/Baatiku/masanawa/pull/534) — OPEN / DRAFT / UNMERGED. Do not merge before final qualified integration.

## Why U09, and collision avoidance

Inspected fresh `main`, the two required re-audits, `CONTINUE-HERE.md`, U09 in the twenty-window execution guide, current open PR titles, U08–U20 branch claims and the existing `LiveVoiceSession`, PCM audio bridge, Agent Shell/token service, agent session repository and paid voice transport. U01–U07 and U21–U30 already have draft PRs; U08 and U20 have source branches. U09 had no branch/PR before the unique U09 claim. No existing shared files were modified.

**Exact owned paths only:** `apps/mobile/lib/src/operator_voice/**`, `apps/mobile/test/operator_voice/**`, `services/gateway/src/operator_voice/**`, this handoff. No database migration, registry, shared Gateway composition, existing audio runtime, LiveKit, Firebase, finance, 5-tab Flutter router, global package manifest or production infrastructure changes.

## Source actually implemented and pushed

### Flutter / native voice access

- `private_voice_operator.dart` composes **existing** `AgentShellTransport.mintLiveVoiceGrant`, existing native `LiveVoiceSession` (Gemini PCM/recorder) and an exclusive app-scope `PrivateVoiceFocus` lease. Explicit user-initiated start, short-lived `wss://generativelanguage.googleapis.com` grant/expiry validation, stop/mute and audio-focus release, closure on error, public Talk/DM preemption hook, account/persona/session epoch fencing on async grant/stream callbacks and context switch.
- Voice transcripts delivered by the existing Live class are **agent output only**. They render as such and **cannot** become action/input text automatically. The existing Twin-interview input-transcription mode is intentionally not misused. A future approved native ASR/audio transport must provide correctly attributed user transcripts without weakening privacy.
- Typed/tap mode and future attributed speech drafts share review state. Explicit editable pre-send dialog; no side-effect until canonical Assistant callback; single-flight submit, fail-closed stale account/session/revision checks, no unknown-result replay. Persisted task/turn reconciliation is delegated to existing `AgentShellTransport.turnStatus`; no fake success or local task ledger.
- `private_voice_assistant_panel.dart` is a nested Assistant widget, not a sixth tab, with start/stop/mute, live status, private-context disclosure, agent-output label, text composer, explicit user review, and an honest discard control after a submit outcome becomes uncertain.

### Gateway/API/auth/database

- `private_voice_service.ts` verifies **canonical** CharacterId and CharacterSessionId, calls the **existing** user/relationship authorizer and account-scoped CharacterSessionRepository, refuses closed/expired/foreign persisted sessions, then delegates to the canonical paid Gemini `LiveVoiceTokenService.mint`; authoritative turn status delegates to `AgentShellService.turnStatus`. No new DB, no grant/cache store, no new payment logic, no second agent conversation.
- `private_voice_routes.ts`: isolated `registerPrivateOperatorVoiceRoutes` exposes strict-keys `POST /agent/operator/voice/grant` and scoped `GET /agent/operator/voice/turns/:requestId/status`, with HTTP 400 on malformed/actor-forged input and no-store response. **Not registered on the shared Gateway yet**; requires F18/Work coordination.
- Existing user-facing `AgentShellTransport` still mints through the currently composed live-token endpoint, **not the new exact-session route**. The new server route and Flutter transport must be composed together by the shared Gateway/Flutter integration owner before the extra server fence can be claimed live.

## Tests added (written, NOT executed in this window)

- `apps/mobile/test/operator_voice/private_voice_operator_test.dart` — exclusive focus preemption/stale lease, no-mic typed mode/account switch, stale approval, uncertain submit quarantine, concurrent approve single-flight, invalid grant/no media, agent output not submitted.
- `apps/mobile/test/operator_voice/private_voice_assistant_panel_test.dart` — typed send requires review (edit cancels), and account change removes another user's draft.
- `services/gateway/src/operator_voice/private_voice_service.test.ts` — canonical authorization, exact active session + token mint, closed/unauthorized/expired and forged character rejection, safe persisted status, hostile-field rejection at Fastify boundary.

**CI follow-up:** GitHub reported failed pull-request workflows at source/handoff SHA `dcaedf47c425b0e62cdf8f747f77b00c56ac20b8`: Mobile Build run `37865050824`, Foundation CI run `37865050700`. Job logs could not be retrieved (GitHub returned `BlobNotFound` 404), so the cause is **unknown**, not a proven test failure or quota failure. Separate Vercel commit status was `failure` with a build-rate-limit/upgrade URL. No rerun attempted; no CI PASS claimed.

**Executed verification:** GitHub compare `main...branch` showed 8 touched paths only (7 source/test files plus this handoff), no shared path; it was ahead of the claimed main and behind by zero at source checkpoint. Fetched server source and verified explicit persisted-scope and expiry guards. **This is a source-level inspection, not Vitest, typecheck, Flutter test or device pass.**

**Test commands to run in complete workspace** (not run here: connected GitHub code API has no executable checkout and local container has no Dart/Flutter SDK, root project checkout or installed workspace node_modules):
```sh
pnpm --filter @masanawa/gateway-service exec vitest run src/operator_voice/private_voice_service.test.ts
pnpm --filter @masanawa/gateway-service exec tsc --noEmit
cd apps/mobile && flutter test test/operator_voice/
cd apps/mobile && flutter analyze lib/src/operator_voice test/operator_voice
```
Use actual package scripts if the filter differs; exact CI/Gateway, Android device, Gemini provider, paid admission, WebSocket/audio focus, Talk/DM concurrency, offline and multi-device tests remain **UNVERIFIED**. GitHub Actions #457 quota is already recorded; no green status inferred.

## Blocking integration and ownership requests

1. **F18/C07/U01–U04/U03:** compose existing Agent Shell and U02 task receipt/approval as the only effect authority; implement true input-ASR-to-reviewed-task bridge with meaningful request ID and speaker attribution, agent transcription vs caller transcription clearly separated. No money/send/recipient inferred from raw Gemini audio. Wire `PrivateVoiceAssistantPanel.onSubmitReviewed` to canonical persisted idempotent conversation/task operation, and provide action status/recovery UI.
2. **F18/Work Gateway owner:** instantiate `createPrivateOperatorVoiceService` with canonical `AgentConversationAuthorizer`, persisted `CharacterSessionRepository`, `AgentShellService`, and live token mint **configured with the existing paid voice admission verifier**; register isolated routes in shared app only after authentic integration tests. Update U09 Flutter transport to call exact-session route while preserving canonical auth refresh/no credential prompts.
3. **F02/R02/F17/R17:** provide a **single** app-scoped `PrivateVoiceFocus` with Talk LiveKit and DM recorder start/stop/preemption notifications, mic permission and actual Android audio focus cleanup; do not fork the native Gemini/LiveKit clients. U09's isolated arbiter cannot independently observe public audio yet.
4. **C07/R03/R19/R11:** supply current authenticated Gwani/Gwana character/session, server-authoritative Bodi/Sulafat voice profile, language-code switching and native ASR attributed user-input support. Current Gemini Live voice conversation works only after the existing grant/mic provider succeeds; spoken operator tasks are not wired.
5. **Paid voice/finance owner:** invoke existing `PaidVoiceController` quote/admit/mediaStarted/complete/uncertainty; ensure admission is required in the runtime token service, and reconcile cost/termination. U09 does not alter settlement or claim voice is free.
6. **Qualification:** run focused tests/typecheck, complete mobile composition and exact Android routes, denial/offline/interruption/reconnect/BT/earpiece/2-device/kill-reopen/provider end-to-end proof. Until then status is **PARTIAL_IMPLEMENTATION**.

## Safety and final disposition

No Firebase/native manifest edits, no DB migrations or new financial authority. No browser TTS or synthetic audio placeholders. **No production changes, no branch merging/deletion.** The branch is intended for a draft, unmerged PR and final Work/F18 integration; it does **not** warrant DONE, VERIFIED_E2E, or DEPLOYED_VERIFIED.
