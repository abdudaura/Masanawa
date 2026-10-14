# Continue owner mobile corrections — 14 October 2026

## Objective and authority

Finish every item in `docs/superpowers/plans/2026-10-14-owner-mobile-corrections.md`, then compile and deliver a new Android APK. The owner explicitly requests execution without repeated planning or permission questions. Work through fixes sequentially, preserve identity/financial authorization and existing work, and never claim live/device verification from source tests. Green is the brand color; the rejected white-M/blue design must not return.

## Resume location

- Repository: `weavewellindustrieslimited/masanawa`, local `/workspace/masanawa`.
- Branch: `fix/owner-mobile-corrections-20261014`.
- Base main: `642c7d326ec46bb775b0486ce3bed4be8b395b46`.
- First tested checkpoint: `90f5b913f37e0532ea045b4a89a4c1b5d273138a`.
- This handoff is committed with a later **UNVERIFIED WIP checkpoint**. Inspect `git log -3` for its exact SHA. Fetch fresh main and preserve both checkpoints; do not reset or replace source wholesale.
- Read `AGENTS.md`, `CONTINUE-HERE.md`, `docs/MULTI-WINDOW-WORK.md`, and relevant contracts. Direct owner instructions supersede old integration freezes. Routine reviewed source integration/main CI is authorized.
- Claims live in branch `factory/claims`, `.factory/leases.json`. Claim `owner-mobile-portraits-20261014` now includes narrow owner-authorized profile/chat/voice/composition/financial correction paths. Latest registry checkpoint `9308a6a8a`; acquire/renew/transfer visibly before editing. Local registry worktree: `/workspace/masanawa-owner-claims`.
- UI continuation reference: `docs/workstreams/UI-CONTINUATION-QUEUE-20261012.md`; this owner checklist is the current priority.

## Verified source checkpoint

1. Configured `avatarUrl` now takes precedence over bundled name-matched SVG illustrations. Supports SVG URLs, preserves local fallback and uses green initials. This does **not** prove every created image is mapped/uploaded to the right profile.
2. Duplicate voice replies reproduced: Gateway marks a turn complete and emits its event before rendering audio; mobile status restoration can append a reply while media HTTP is pending, then HTTP appends it again. `_appendAi` now updates the assistant message with the same request ID and merges attachments instead of appending a duplicate. Local read receipts only update status in this reproduction.
3. Tests executed: `flutter test --no-pub test/voice_reply_deduplication_test.dart test/masana_professional_portraits_test.dart` → 3 passed; targeted late-response-after-thread-clear test → 1 passed. Physical device checks remain unrun.

## Unverified WIP: inspect and finish before using

- Added `screens/chat/masana_profile_screen.dart`; chat avatar and profile menu navigate there. Has portrait/about/message/call/classroom. Needs widget/navigation/small-screen verification and richer profile metadata if available.
- Converted `masana_list_screen.dart` to stateful search and removed contact message icon. Needs search/reset and regression checks.
- Moved voice composer from modal to inline via `_localRecorder` / `_recordingDone`; composer has optional `onDismiss` and smaller typography. **Not complete:** hold/release/slide-cancel gestures are not wired; fix account-ID fencing (current inline predicate only checks signed-in state), stale/unused `sameAccount` helper, cancellation/disposal, visibility during sending, and lock/unlock behavior. Do not ship this as finished.
- Emoji picker has explicit green configuration and larger emoji sizing. Emoji-only delivery failure is **not diagnosed/fixed yet**.
- Outgoing upload stages changed from `processing` to `sent`; review server-acceptance semantics and pending-turn reconciliation carefully.
- Rooms list spacing/card styling and search hint changed; original screen already had search. Needs layout and behavior checks.
- `LiveVoiceSession` now sends `sessionResumption:{}` matching server token constraints. This is a plausible compatibility correction, **not a verified diagnosis of Start Trial failure**.
- Added `services/gateway/src/google_voice_catalog.ts`: reads official authenticated `/v1beta/voices`, filters out the 30 legacy studio voices, selects 26 distinct catalog IDs by documented gender and persona metadata with Bodi/Fola anchors, caches and paginates. Needs schema validation, bounded pagination, correct persona field handling, stable assignment/custom-profile policy, tests and actual runtime catalog verification.
- Bootstrap can update existing profile voice assignments with optimistic revisions. `main.ts` attempts read-only catalog lookup at startup and logs a safe event on failure. **Catalog retrieval has not been executed with credentials.** Startup ordering/key-pool behavior and fail-safe behavior require review.
- `native_audio.ts` partially changed from Live-model `:generateContent` to `gemini-3.8-flash-tts` `/v1beta/interactions` with per-character voice and style metadata. **Known incomplete parser:** line around 113 still calls the old `audioPart(candidates)` parser; implement actual Interactions `steps[].content[]` / `output_audio` parsing. WAV output must not be passed as raw PCM to a PCM playback callback. Add current-schema tests, timeout/retry behavior and explicit audio failure handling.
- `agent_conversation.ts` passes presentation to renderer. Its `renderAudio` still swallows failures; voice inputs must receive recoverable audio output, not silently successful text-only output. Also review replay/persisted audio handling.
- Analyzer before latest voice edits: no compilation errors in edited chat/profile/rooms files, but unused `sameAccount` warning and existing lint info. Latest TS/audio changes have **not been compiled or tested**.

## Complete feature checklist (nothing may be dropped)

1. Attach the already-created Masana images to every matching profile and show them consistently in list/chat/profile, including offline fallback.
2. Chat avatar opens professionally designed profile details for the exact Masana.
3. Diagnose and fix call failure after Start Trial; redesign intrusive trial sheet with compact sizing, correct position, dismissal and recoverable errors.
4. Remove recording popup; familiar inline hold-to-record/release-to-send/slide-to-cancel, deliberate lock/review, working stop/unlock and guaranteed microphone cleanup.
5. Show playable outgoing audio as sending/sent/failed; keep internal transcription processing out of ordinary user flow.
6. Voice input always gets a playable voice reply with attached transcript; audio failures remain recoverable.
7. Current Google extended voices, a distinct voice per Masana, documented male/female metadata (owner says Bodi male/Fola female), personality/role-specific delivery. No old Zephyr/Kore fallback or guessed IDs.
8. Rooms: decongest, improve hierarchy/spacing, visible working search.
9. Masana: visible working search, remove message icon from cards.
10. Attachments: compact composer-adjacent panel, familiar placement/dismissal, actual delivery.
11. Emoji-only delivery, Unicode/combined sequences, polished colorful rendering, green accents.
12. Remove all new bill-payment products except data bundles, from UI and server catalog/quote/execution; preserve historical records/reconciliation.
13. Data-bundle entry in conversation header **between avatar area and search**; remove billing from Wallet. Chats header wallet icon opens main Wallet.
14. Merge Wallet and Crypto into one compact main screen; remove verbose crypto descriptions; verify supported actions, status, account fencing and errors.
15. Remove video TikTok/YouTube/Facebook filter chips; retain meaningful content/sort filters. Current `ExternalVideo` lacks duration, so do not fabricate short/long metadata; use a useful sort or add authoritative duration.
16. Preserve/finalize one-reply-per-audio-turn across status events, retries, history sync and final audio response.
17. Review complete coverage, run checks, review final diff, compile/version/signature-check APK, provide usable HTTPS download with clear expiry/install instructions.

## Financial investigation (read-only findings)

- Chats wallet icon incorrectly pushes `CryptoWalletScreen`: `screens/chat/chat_list_screen.dart` around 387. Route to canonical `/wallet`.
- Billing shortcuts exist in `screens/wallet/wallet_screen.dart`, `shell/five_tab_shell.dart`, `router/app_router.dart`.
- Extract reusable embedded crypto content from `finance/crypto_wallet_screen.dart`; avoid nested scrolling/Scaffold. Remove verbose `_CapabilityNotice`, retain capability-controlled actions. Keep existing `/crypto` links compatible with merged wallet.
- Billing picker: `screens/billing/billing_screen.dart`; make data-only and searchable, retain canonical quote/confirm/history flow.
- Server: `financial_billing.ts` catalog methods around 259; `billing_checkout.ts#createQuote` around 637; `financial_billing.ts#purchaseForIdentity` around 184. Validate actual biller membership in live `MOBILEDATA`, not merely user-supplied category; reject spoofed/omitted categories safely for new spending.
- Restrict new execution from saved non-data quotes; do not break already-dispatched webhooks/settlement/reconciliation.
- `agent_billing_assistant.ts` still advertises airtime/electricity/TV; restrict billing directives while preserving wallet funding.
- Tests: financial_billing/billing_checkout/agent_billing_assistant; Flutter wallet_service_shortcuts, home_billing_intent, UI wallet/crypto/chat/router. Existing AIRTIME success fixtures need deliberate data conversion; retain historical AIRTIME recovery fixtures.

## Google research and live access

Official documentation fetched 14 October 2026:
- https://ai.google.dev/gemini-api/docs/live-api
- https://ai.google.dev/gemini-api/docs/live-guide
- https://ai.google.dev/gemini-api/docs/speech-generation#voices

Docs confirm `gemini-3.8-live`; native Live supports TTS voices. Live config uses `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`. Extended catalog `GET /v1beta/voices` has hundreds of voices, `gender`, accent, pitch, persona/context filters and pagination. TTS current Interactions API uses `gemini-3.8-flash-tts`, `generation_config.speech_config:[{voice:id}]`, and turn-level `speech_metadata.style`. Bodi/Fola are not in the public 30-name table: retrieve real catalog IDs/metadata using server credentials.

Railway production Gateway already has `MASANAWA_GEMINI_API_KEY`, but connector values are redacted and no local credential exists. Do not print secrets or invent successful catalog verification. Read-only catalog lookup can run server-side using existing credential. Diagnose trial/token/WS failures with safe status/stage logs; do not downgrade valid current model names blindly.

Railway project `f6d9af7c-5be4-457b-9614-936687391aea`; prod environment `24403de4-aa8d-42a2-8da9-838e98cdb9e1`; Gateway `c90abb29-f649-4c65-a7b4-333f8056227b`; same Primary and Railway aliases. Existing Gateway public origin **https://masanawa-gateway-production-338f.up.railway.app**. Retired origin without `338f` must not return.

## Tooling, checks and final delivery

- Flutter `/workspace/toolchains/flutter/bin/flutter`; Android SDK `/workspace/toolchains/android`; JDK17 `/workspace/toolchains/jdk17`. Flutter 3.47.7 / Dart 3.13.5. Prefer `--no-pub` when dependencies are already resolved.
- Prior full Flutter baseline had 30 unrelated failures reproduced on unchanged base; evidence `/workspace/shared/downloads/masanawa-verification.txt`. Do not hide regressions, and do not claim every new failure is baseline without comparison.
- Previous successful APK workflow: `.github/workflows/mobile-build.yml`; prior run `38514882185`, artifact `11872256594`, old app version `1.0.2+3`. That old APK does **not** contain these corrections. Increment version for new build.
- Old test APK used Android Debug signing. Verify new signature and explain uninstall requirement only if certificates differ; do not claim store signing.
- APK sharing: `/workspace/...` links failed on owner's phone. GitHub connector artifact download returns temporary ZIP URL (~5 minutes). Higgsfield general file sharing accepts ZIP, rejected APK extension. Working method: `media_upload(filename:zip)` before remote `sandbox_exec` command that downloads CI artifact ZIP and PUTs it to presigned upload URL in the same command, then `media_confirm(type:file)` after HTTP200. It provides permanent HTTPS ZIP URL; verify HEAD/download and explain Android Files extraction to APK. Never rename ZIP bytes as APK, use fake sandbox paths, or claim old build contains new fixes.
- Preserve real checks/branch protections. Review before merge and let authorized routine main CI deploy. Confirm deployed commit, readiness and authenticated capabilities separately from build success. Do not send test emails/messages or execute real financial/provider purchases without applicable authorization.

## Immediate next action

Inspect the WIP diff and fix the known audio response parser first, then finish source tasks sequentially with focused tests and recorded results. Do not compile or announce completion while known incomplete WIP or any checklist item remains. No further confirmation is needed to continue the owner's authorized task.


## Verification and implementation update — 14 October, current GitHub-connected session

This section supersedes the old "Immediate next action" checkpoint above. **Preserve this branch and its complete prior implementation.** The session started from commit `57f5e4ccdcb66d8fd922e729dca7668c95185477` and PR #738. Source changed through GitHub Contents API because the old /workspace working directory and local Flutter toolchain were unavailable in this runtime; production-code checks were delegated to immutable GitHub Actions revisions.

### Confirmed source commits (in order)

- `02df069862358e951545fa8f995fa5f835114054`: Gateway Gemini Interactions output now wraps authenticated headerless mono 16-bit / 24 kHz PCM in a real RIFF/WAV container before returning a single downloadable voice-reply attachment; raw PCM callback remains unchanged. No fallback to fabricated speech.
- `ef99d40c47af098b7b515acd431daf3a7b035844`: native audio test proves WAV signature, format, sample rate, length, payload and raw PCM callback; malformed formats remain rejected. Official Google documentation for explicit `audio/l16` confirmed 14 October.
- `a5772da6d2611f10883e1941e9a4b6f8e2a1d6ec`: increment app `1.0.2+3` to `1.0.3+4`.
- `81249092c1bce6d69ad2317268ae352002315525`: add owner acceptance workflow for full Flutter tests, production Gateway compile and native audio/catalog/live-token regressions.
- `f779f5f9d79d294b7bb00f952b92cef9e0cc162c`: independently inspect APK with Android `apksigner` and `aapt`, verify version `1.0.3+4` and preserve build provenance incl. explicit Gateway origin; signed may mean **debug certificate**, not Play Store certificate.
- `a79bedb39bc445cfc1ccc909c39c714680ac6082`: fix the **two remaining** full-suite Talk Sponsor/Add AI regressions by explicitly setting `isAvailable: true` on the intended successful mock candidate in `apps/mobile/test/talk_screen_test.dart`. Production model intentionally defaults missing `isAvailable` to false, and UI must not permit purchases when availability is unproven. Do **not** alter this safeguard or replace with optimistic availability.

### Executed CI and production evidence (do not infer what is not tested)

- Source snapshot `f779f5f`: Owner Mobile Corrections Acceptance run `38536391517`: Gateway build + Google voice/audio/token tests **SUCCESS**; full Flutter suite **749 passed, 2 failed**. Both failures in Talk screen tests (expected Sponsor/Add, hidden due to unavailable mock), investigated and source-corrected in `a79bedb`; **follow-up full-suite success requires run 38537077478 to pass**.
- Voice Note Regression run `38536391658`: **SUCCESS**; Masana Professional Roster Integration run `38536391817`: Gateway/server-roster and Flutter-roster jobs **SUCCESS**, 26 offline SVG avatars and 26 SVG banners exist in indexed `apps/mobile/assets/masana/{avatars,banners}/`. These pass bundled-asset tests, NOT an external originality/artistic review of 26 owner-requested images.
- Full Mobile Build run `38536391603` **FAILURE** at whole-project Flutter analyze (old infos/warnings). Foundation CI `38536391692` **FAILURE** at older `packages/agents` `TalkId` export test. Status Video Integration strict TypeScript checks also have multiple old Talk-module test errors. These are **not green**, do not misreport or bypass them. Reconcile against base before touching shared modules.
- Railway production Gateway `c90abb29-f649-4c65-a7b4-333f8056227b` deployment `48e5ff5e-0772-4f4b-9f9d-ad4e08e1f835` is SUCCESS but uses **old main SHA `642c7d326ec46bb775b0486ce3bed4be8b395b46`**, not these owner corrections. Read-only HTTPS `/readyz` was independently checked at `https://masanawa-gateway-production-338f.up.railway.app/readyz` and returned HTTP 200 with `database-schema` ready. Neither proves the owner branch deployed nor Gemini authentic TTS voice IDs / Start Trial provider session successful. The available Railway connector redacts the Gemini secret.
- New APK run `38537077391`, app version `1.0.3+4`, **requires completion, signature output, exact-build artifact, download test and handset/provider acceptance**. GitHub artifact ZIP is not automatically a public permanent mobile HTTPS link. Do not supply old `1.0.2+3` APK.
- No financial purchases executed. Data-bundle-only catalog/execution fences from the preserved branch have not been live provider-qualified. Keep MSN monetary activation gates off until independently qualified.
- PR #738 remains **draft/unmerged** pending full-suite, APK checks, signed verification, and owner acceptance. Do not merge failing/unsafe work for the sake of handoff.

### Remaining acceptance priority

1. Verify `38537077478` runs full Flutter successfully after corrected seat mock, and compare `38537077391` release build signature/version; inspect job logs.
2. Exercise Google /v1beta/voices using an authorized server-side credential (never copy or reveal it) to confirm Bodi male, Fola female, and 26 genuinely distinct usable IDs; prove authenticated voice and Start Trial end to end on a device where provider access exists.
3. Verify full 17 owner items **as behaviors**, including media gestures, account switch cleanup, distinct portraits, Rooms searching, finance product restrictions and one playable reply for each voice turn. Source/widget tests are insufficient for handset and provider claims.
4. If qualified, upload precisely the matching new version APK as a ZIP container to phone-accessible HTTPS via controlled artifact transfer, verify GET/HEAD and expiry, then merge tested compatible changes to main through PR with reconciled file claims and branch policies. If not qualified, leave PR draft and state exact blockers.
