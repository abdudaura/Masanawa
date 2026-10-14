# Owner Mobile Corrections Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Track each checkbox separately; the owner requests sequential fixes and an APK only after the full list is addressed.

**Goal:** Correct every issue reported by the owner on 2026-10-14 and deliver a verified downloadable Android build.

**Architecture:** Retain Flutter screens and the canonical Gateway/worker, identity, media and financial contracts. Repair connected behavior before visual polish. Split the work into the independently verifiable milestones below; keep one master checklist so no request disappears between milestones.

**Tech Stack:** Flutter/Dart, TypeScript Gateway and worker, existing media storage and Google audio integration.

**Spec:** The owner's 2026-10-14 mobile feedback, fully mapped below. Status: PLANNED; no implementation or device qualification claimed.

## Global Constraints

- Use the existing green brand palette; do not introduce blue accents.
- Work through the milestones sequentially. Document source changes, executed checks and remaining device/provider checks for each.
- Inspect fresh main, open PRs and exact-path claims before coding; preserve other windows' work and acquire the relevant lane before edits.
- Keep the canonical wallet, authorization, idempotency, receipts, escrow and recovery. Removing products must not erase historical financial records.
- Use existing created Masana artwork, correctly matched to profile identity; do not substitute newly generated generic portraits.
- Build the APK only after all requirements have been addressed and relevant checks completed. Report external verification limits honestly.

## Review Focus

1. Portrait mapping must survive remote directory refresh, cached/offline data and unknown IDs without displaying another person's image.
2. Recorder cancellation, denied permission, backgrounding and navigation must release microphone resources.
3. Trial retry and network loss must not duplicate activation, reservations or charges; rejected calls must release resources.
4. Emoji-only and mixed Unicode messages must survive validation, transport, persistence and reload unchanged.
5. Data/crypto retries must not duplicate purchases or transfers; account switching must fence balances and cached transactions.

## Ordered Milestones

### 1. Attach the created Masana portraits

**Files:** `apps/mobile/lib/src/agents/masana_portrait_avatar.dart`, `agent_directory.dart`, `apps/mobile/assets/masana/`, `services/gateway/src/platform_agent_bootstrap.ts`, directory projection and associated tests.

- [ ] Inventory the created artwork and authoritative profile IDs; record the exact mapping.
- [ ] Attach the matching images consistently in the contacts list, chat header and profile page, including cached/offline views.
- [ ] Verify every listed Masana, missing-image fallback and remote-refresh behavior.

### 2. Open a professionally designed Masana profile

**Files:** `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`, existing profile screen, directory model and router discovered during implementation.

- [ ] Make the chat avatar/name open that exact Masana's detail page.
- [ ] Design a clean portrait, name, expertise, biography, languages and available chat/call/room actions with appropriate spacing and green branding.
- [ ] Verify correct identity, back navigation, loading/error states and small-phone layout.

### 3. Repair calls after Start Trial

**Files:** `apps/mobile/lib/src/screens/chat/components/paid_voice_quote_sheet.dart`, `src/voice/paid_voice_state.dart`, `src/core/live_voice_session.dart`, `services/gateway/src/paid_voice_routes.ts`, `live_voice_token.ts`, trial/admission contracts and their tests.

- [ ] Reproduce and trace trial activation through admission, token issuance, microphone setup and provider connection; fix the demonstrated failure.
- [ ] Replace the intrusive trial notice with a compact, safely positioned sheet: clear duration/terms, primary action, dismiss control and inline recoverable errors.
- [ ] Verify first start, retry, unavailable/expired trial, insufficient funds, permission denial and cleanup after connection failure.

### 4. Replace the voice-recording popup with an inline recorder

**Files:** `apps/mobile/lib/src/ui/components/voice_note_composer.dart`, `src/core/voice_note_recorder.dart`, chat composer and recorder tests.

- [ ] Remove the recording popup. Use familiar press/hold recording, release to send, slide to cancel and deliberate lock/review controls where supported.
- [ ] Keep timer/waveform and actions within the composer; ensure stop/cancel/unlock always work.
- [ ] Verify rapid gestures, interruption, backgrounding, navigation, permissions and disposal release the microphone.

### 5. Send voice messages as voice messages

**Files:** `apps/mobile/lib/src/state/ai_chat_state.dart`, chat message rendering, media upload/delivery APIs and worker voice-note handling.

- [ ] Show a playable outgoing voice bubble with ordinary sending/sent/failed state; remove user-facing transcription-processing and mandatory transcript review from ordinary chat voice sending.
- [ ] Keep transcription internal to agent understanding; only report sent after server acceptance and make failed delivery retryable without duplicate messages.
- [ ] Verify playback, delayed upload, failed upload, retry and persisted/reloaded messages.

### 6. Always reply to voice notes with audio and an attached transcript

**Files:** agent response generation, Google speech adapter, worker jobs, message/media contract and Flutter audio rendering discovered during tracing.

- [ ] Preserve voice-input modality through agent execution so voice input produces a playable audio response with an attached text transcript.
- [ ] Ensure audio failure offers a recoverable status rather than silently treating a text-only response as successful voice delivery.
- [ ] Verify voice-to-audio reply, accurate transcript attachment, playback and retry behavior.

### 7. Verify and adopt the current Google voices

**Files:** `services/gateway/src/live_voice_token.ts`, `platform_agent_bootstrap.ts`, provider adapters and voice configuration tests.

- [ ] Research official current Google Live/Dialog API, model release documentation and supported voice catalog; record dated URLs and distinguish Live voices from TTS-only voices.
- [ ] Confirm Bodi and Fola support for the selected current model and project before configuring them; do not invent model IDs or silently fall back to Zephyr/Kore.
- [ ] Align profile assignments, token configuration, call audio and voice-note replies. Remove obsolete defaults from the active paths.
- [ ] Give every Masana a distinct voice from the current supported catalog; maintain an explicit profile-ID → voice mapping and a uniqueness test across the complete roster.
- [ ] Research Google's recommended character/personality configuration: distinguish fixed voice identity from prompt-controlled accent, tone, pace and delivery. Match each agent's role and character using documented controls.
- [ ] Identify male/female presentation through official descriptions where available and auditioned voice samples where documentation is silent; do not infer it from names alone. Record the owner's Bodi=male and Fola=female guidance and validate compatibility. Do not silently reuse voices if the selected model's catalog is too small.
- [ ] Verify real provider compatibility where credentials permit; record unsupported combinations and unavailable live checks explicitly.

**Initial evidence:** Google Live documentation fetched on 2026-10-14: https://ai.google.dev/gemini-api/docs/live-api and https://ai.google.dev/gemini-api/docs/live-guide . The guide still includes Kore examples; those examples alone do not establish Bodi/Fola support. Existing profile bootstrap uses Bodi/Sulafat; token helper fallback uses Kore.

### 8. Improve Rooms and add search

**Files:** `apps/mobile/lib/src/screens/rooms/rooms_screen.dart`, `src/features/rooms/rooms_screen.dart`, directory/client and room tests. Confirm which screen is active before changing either.

- [ ] Reduce congestion using clear title/subtitle hierarchy, balanced spacing and concise room metadata.
- [ ] Add visible room search by name, topic and host with clear/reset and no-results behavior.
- [ ] Verify narrow phones, long names, loading/offline states and search results.

### 9. Improve Masana contacts and add search

**Files:** `apps/mobile/lib/src/screens/chat/masana_list_screen.dart`, directory state and list tests.

- [ ] Add visible search by name and expertise with clear/reset and no-results behavior.
- [ ] Remove the message icon from contact cards; retain understandable tap navigation and clean portrait/name/expertise layout.
- [ ] Verify search, accessible card taps and compact layout.

### 10. Make attachments compact and anchored to the composer

**Files:** attachment controls in `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart` and extracted composer components as needed.

- [ ] Replace the oversized popup with a compact composer-adjacent attachment panel using familiar icon actions, safe-area spacing and green accents.
- [ ] Verify keyboard interaction, dismissal, permissions, selection and actual attachment delivery.

### 11. Fix emoji delivery and presentation

**Files:** chat emoji picker/composer, `src/state/ai_chat_state.dart`, Gateway message validation and associated transport tests.

- [ ] Reproduce emoji-only delivery failure and repair Unicode/validation/transport handling.
- [ ] Replace blue picker accents with brand green; render polished full-color emoji consistently without breaking skin tones, combined sequences or accessibility.
- [ ] Verify emoji-only, mixed text, flags, skin tones, family/ZWJ sequences, persistence and agent response.

### 12. Keep only data bundles as bill-payment products

**Files:** `apps/mobile/lib/src/screens/billing/billing_screen.dart`, `src/core/api/billing_models.dart`, Gateway billing catalog/checkout, `packages/commerce/src/billing-*` and financial tests.

- [ ] Remove airtime, electricity, TV and every other non-data bill-payment product from active menus, catalogs and new checkout paths.
- [ ] Retain historical receipts, reconciliation and recovery for existing transactions; retain wallet/crypto operations and call admission separately.
- [ ] Verify only data bundles can be newly purchased and removed product IDs are rejected safely.

### 13. Move data bundles into the chat header

**Files:** chat/list headers, `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`, shared header/router and data purchase screen.

- [ ] Remove bill-payment shortcuts from Wallet.
- [ ] Add the data-bundle entry between the Masana avatar area and search icon in the conversation header; prevent crowding on small phones.
- [ ] Connect the entry to the working data-bundle purchase flow with network, recipient, plan, confirmation and receipt.
- [ ] Connect the wallet icon in the Chats header to the main Wallet screen.
- [ ] Verify both navigation paths and data purchase authorization/retry semantics.

### 14. Merge Wallet and Crypto into one compact screen

**Files:** `apps/mobile/lib/src/screens/wallet/wallet_screen.dart`, `src/finance/crypto_wallet_screen.dart`, `src/state/wallet_state.dart`, `src/commerce/wallet_models.dart`, router and wallet/crypto tests.

- [ ] Design one main Wallet with a clear balance area, wallet actions, crypto holdings/actions and concise transaction history.
- [ ] Remove verbose crypto descriptions and redundant navigation; use short labels and progressive disclosure for details.
- [ ] Reuse the existing financial services and authorization; verify funding, supported crypto actions, transaction status, errors and account fencing.
- [ ] Verify readable small-screen layout and access from the Chats header.

### 15. Replace Videos platform filters

**Files:** `apps/mobile/lib/src/features/videos/videos_screen.dart`, `video_models.dart`, `video_repository.dart` and video tests.

- [ ] Remove TikTok/YouTube/Facebook platform filters from the interface.
- [ ] Provide useful content filters such as All / Short / Longer using actual duration metadata; keep official platform playback requirements intact.
- [ ] Verify filtering, missing-duration handling, empty results and playback.

### 16. Prevent duplicate replies after audio messages

**Files:** Flutter voice send and receipt handling, Gateway chat/channel ingestion, worker reply dispatch and message idempotency tests, narrowed after tracing.

- [ ] Reproduce the reported two replies and trace audio upload/send, transcription completion, read receipts, polling and worker retries using message/event IDs without logging private content.
- [ ] Keep read/delivery receipts as status events; they must never become user turns or trigger model execution.
- [ ] Ensure audio and its internal transcript represent one user turn, with one reply operation and stable idempotency across transport/worker retries.
- [ ] Verify one audio message plus read/delivery receipts produces exactly one agent reply; verify repeated callbacks/retries and two genuinely distinct messages.

### 17. Integrated verification and APK delivery

- [ ] Review coverage against all 16 feature milestones; record each as implemented, verified or precisely blocked rather than claiming blanket completion.
- [ ] Run affected Flutter tests/analyzer, Gateway/worker/provider/financial checks; separate existing failures from new regressions.
- [ ] Inspect representative small-screen layouts and exercise connected profile, voice, call, search, emoji, data and wallet journeys where a device/provider is available.
- [ ] Review the final diff and ensure no blue styling or removed bill-payment products remain in the touched active flows.
- [ ] Build and verify the Android APK from the reviewed final source; confirm version, signature and embedded backend origin.
- [ ] Supply a working HTTPS download with clear installation instructions and explicit expiry information.

## Evidence Record

For each milestone append: source base/head, changed files, executed commands/results, screenshots/device evidence if available, live provider checks, remaining limitations, PR/merge and deployment state. Documentation status never implies the feature works.

### Investigation started — 2026-10-14

- Fresh `origin/main`: `642c7d326ec46bb775b0486ce3bed4be8b395b46`. Existing owner plan is preserved locally.
- Google speech-generation documentation describes an Extended Voice Library with hundreds of voices, `GET /v1beta/voices`, pagination, and `gender`, `pitch`, `accent`, `persona`, and `context` filters. Source: https://ai.google.dev/gemini-api/docs/speech-generation#voices . Use returned voice metadata/IDs, not guessed names. Catalog access and Live compatibility still require checking.
- The same documentation distinguishes identity selection from speech delivery: turn-level `speech_metadata.style` controls emotion, pacing and delivery for the documented TTS API. Live configuration must be checked independently before reusing TTS fields.
- Local `_markUserMessages` only updates local delivery status; no model dispatch is called in that helper. This does not yet establish the cause of duplicate audio replies. Next trace media-turn endpoint and agent response ingestion by stable request ID.
- The avatar component currently prioritizes name-matched bundled SVG illustrations over `avatarUrl`. The contacts and conversation headers already use this component. This can prevent server-configured created portraits from being shown; inspect actual artwork and remote profile values before fixing precedence.

### First source corrections — 2026-10-14

- **Portrait precedence: PARTIAL_IMPLEMENTATION.** Configured directory images now take precedence over bundled illustrations, with SVG support and local fallback on errors. Initial fallback is dark green. Regression reproduced the original precedence bug and passes after the change. Matching/uploading every created portrait and installed-device inspection remain open.
- **Duplicate audio replies: IMPLEMENTED_UNVERIFIED on device.** Reproduced the race between completion-event/status restoration and the later media HTTP response: one request produced two assistant messages. `_appendAi` now updates the assistant message with the same request ID, preserving its identity and existing attachment and allowing the final audio attachment to be added. Read-status updates are local; they were not the model trigger in this reproduction.
- Executed: `flutter test --no-pub test/voice_reply_deduplication_test.dart test/masana_professional_portraits_test.dart` → **3 passed**. Provider/device checks and full remaining milestone coverage are not complete. No new APK compiled.
