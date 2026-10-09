# F02 — Fail-closed Live Talk response model recovery (2026-10-09)

## Ownership and exact checkpoint

- **Owner/window:** independent ChatGPT F02 recovery of existing R02 live audio source.
- **PR:** [#549](https://github.com/Baatiku/masanawa/pull/549), **DRAFT / OPEN / UNMERGED**.
- **Branch:** `work/f02-live-response-fail-closed-20261009` from latest `main` `5e758673ae91082520b21b3153da53791ae2cbf3`.
- **Implementation commits:** `869e1afa7dae2aa83f6131f3d0cfa375171fdd8d` (state & grants); `e27b939a3aff50eb144801755a396859fdb96573` (media envelope); `ead0b9f3115aba6e40b0763a832cc04a7d872f57`, `63b94d10f8efa3d9273d4578ad11e02e00b795fd` (regression tests). The PR head after this handoff commit is authoritative.
- **Owned exact paths:** `apps/mobile/lib/src/talks/talk_live.dart`, `apps/mobile/lib/src/talks/talk_live_http_transport.dart`, `apps/mobile/test/talk_live_response_safety_test.dart`, `apps/mobile/test/talk_live_http_transport_test.dart`, this handoff.
- **Status:** `PARTIAL_IMPLEMENTATION` overall R02/F02; bounded source fix and authored tests committed, **not executable-verified**, not deployed. No mic/live-audio acceptance may be marked DONE.
- **Lease:** claimed in GitHub commit `a61a93703d9b8cced70690438530c40e74d7dffa`, expanded exact paths before modification `cb7abdb789a145cbd662a8e5404c20f561310533`. Last visible activity is this handoff commit, 2026-10-09.

## What actually changed (existing contract, no new runtime authority)

1. Flutter live session JSON models no longer promote missing/unknown state to `live` or missing hearing grant to true. A session needs an actual server-issued Talk/session identity, recognized Host/Speaker role, state=`live` and positive, explicit `canHearAudio`/`canPublishAudio` before the UI/controller can grant microphone publication. `reconnecting`, `ended`, unknown role, missing identifiers and absent grants cannot enable publishing. Host-only `aiGenerationAllowed` also requires active state and hearing grant.
2. Room state uses conservative Host/AI visibility and nonnegative listener counts; missing Host connection cannot imply active AI generation. This is presentation-level narrowing, not a replacement for server checks.
3. LiveKit media response is checked before connection: actual `room_name` must equal requested Talk; `participant_identity` must be a nonempty user identity suffixed by the requested canonical session; token must be present, unexpired and use an appropriate WebSocket endpoint without URL userinfo/fragments. Existing Gateway issuer on `main` and R02 #439 uses `userId:sessionId` and the Talk ID for its room. Invalid/cross-session/expired response throws a typed `FormatException` and the existing audio-session failure recovery releases its lease; it never creates a second wallet/payment/AI authority.
4. Added `talk_live_response_safety_test.dart` with positive Host/Speaker grants and negative unknown-state, missing-grant, revoked/reconnecting, unknown role, missing session and malformed room-state cases. Extended existing HTTP transport test to cover credential cross-talk, cross-session, bad identity, invalid URL, token and expiry, plus an authoritative happy-path response.

## Verification matrix — make no fake pass claims

- **Executed:** reread exact branch files via GitHub, verified content invariants for four source/test paths (all static checks true); GitHub `compare_commits` reported only the five owned paths changed in the six-commit implementation/claim diff. These are **static checks, not Dart execution**.
- **Not run:** `cd apps/mobile && flutter test test/talk_live_response_safety_test.dart test/talk_live_models_test.dart test/talk_live_http_transport_test.dart test/talk_live_audio_session_test.dart` — the tool container has no Flutter or Dart SDK. `cd apps/mobile && flutter analyze lib/src/talks/talk_live.dart lib/src/talks/talk_live_http_transport.dart` — same blocker. Dart project requires SDK `^3.12.2`; the new tests use Dart record syntax supported by that constraint.
- **Not run:** authenticated Gateway + PostgreSQL + LiveKit Host/Listener/Speaker tests; real connection, speaker/earpiece/Bluetooth, denied mic permission, reconnect/lease, muted track, second low-end Android device and Gemini audio focus. No LiveKit/provider credentials or devices are connected here.
- **CI:** Issue #457 reports exhausted GitHub Actions quota and zero-step CI failures; CI status is **NOT VERIFIED**, not evidence of source test pass/fail. Do not trigger billed runners or weaken checks.

## Collision and release safety

- Inspected draft #439 touched `services/gateway/src/talk_live/livekit_media.ts` and Postgres/route tests; #448/#449 own the AI worker, #408/#456 own `talk_live_audio_session.dart`. None own this change's exact files. #439's participant identity remains `userId:sessionId`. These drafts are unmerged and must be reconciled semantically by F02 integration rather than force-applied.
- Work #497, Firebase #461, R17/C08 five-tab shell and wallet/ledger/provider paths are deliberately untouched; app remains Talks · Chats · Assistant · Wallet · Agents as its target architecture.
- No auth bypass, new API, database migration, privileged action, financial execution, secret, signed app, production change, merge, deletion, or other PR modification occurred.
- **Residual risk:** media token expiration may race arrival; the existing audio session handles validation failure by closing media and best-effort server disconnect. Real race/room and native audio tests are mandatory; a signed token cannot be revoked merely by this DTO filter. As with all offline/unknown responses, the UI may show a safe ended/retry state rather than optimistic audio.

## Handoff to next verifier/integrator

1. Review this exact draft against current main and any subsequently active exact-path claims; use one F02 owner to reconcile #408/#439/#448/#449/#456 and this branch without overwriting security tests.
2. Run the four Flutter tests above, full Flutter analyzer and relevant Talk/Gateway Vitest/Postgres suites. Repair actual discovered failures; don't guess from zero-step Actions.
3. Run LiveKit two-device Host/Listener/Speaker, interrupted Host lease, denied permission, microphone audio route and reconnection tests on an actual signed Android install; gather sanitized evidence and verify state after restart.
4. Qualify real provider credentials, trusted HTTPS/WSS, server token authorization, participant removal, single-session policy and model-native Gemini isolation before a verified merge or release. Record SHA-specific test results and remaining blockers in PR #549.
