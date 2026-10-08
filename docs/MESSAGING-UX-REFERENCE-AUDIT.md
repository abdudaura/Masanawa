# Messaging UX reference audit and implementation contract (2026-10-08)

**Status:** research-derived engineering guidance; **NOT** implementation, APK qualification, or a new milestone. Applies through existing R01–R19 and C01–C08 gates. Canonical product decisions remain `CONTINUE-HERE.md`, `APP-SHELL-CONTRACT.md`, `END-TO-END-UX-ARCHITECTURE.md`, `COMMUNICATIONS-EXTENSION-PLAN.md`, `MOBILE-READINESS-PLAN.md`, traceability IDs and J01–J11. If this document conflicts, those canonical contracts win.

## Objective and non-goals

Deliver WhatsApp-like perceived speed, clarity, resilience and interaction polish **without** cloning WhatsApp, switching Masanawa's backend, introducing a sixth tab, moving finance into message send, or treating third-party example code as authoritative. Exactly **Talks · Chats · Assistant · Wallet · Agents**; Assistant centered; human DMs only in Chats; one switchable private Gwani/Gwana Assistant; public human-hosted Talks; financial authorization server-side; Expert/Twin conversations scoped separately. Voice, typing and taps must be genuinely functional; no auto mic or silent spend. WhatsApp and Telegram channel integrations remain distinct from in-app DMs.

## Source projects: what is transferable

1. **Flyer Chat**: https://github.com/flyerhq/flutter_chat_ui ; Apache-2.0 as checked October 8, 2026. Flutter's backend-agnostic modular `flutter_chat_ui` + `flutter_chat_core`, message-controller/model abstraction, theming/builders, performant lists, optional text, stream, image, file and system widgets and image cache. **Action:** inspect package versions/API and benchmark an isolated spike against existing Masanawa Flutter widgets before adopting or vendoring; choose incremental adapter over wholesale rewrite. Use custom Masanawa cards for action status, AI attribution, speech artifacts, receipts, file results, confirmations. No assumption a widget supplies persistence, message delivery, encryption, authorization or media security.
2. **Signal Android**: https://github.com/signalapp/Signal-Android ; AGPL-3.0; native Android, not a drop-in Flutter or server replacement. **Study patterns**, e.g. stable local message IDs, ordered timelines, durable send queue, retry/dedupe, reconnect/catch-up, read/delivery status, media lifecycle, permission flows, rendering and background notification boundaries. Independently implement suitable patterns against Masanawa's authoritative backend, auth and data policy. **Do not copy AGPL code into Masanawa** without explicit legal/licensing review and approval. Never claim Signal-equivalent E2EE; E2EE remains unapproved/unverified.
3. **GBMods**: https://github.com/rvarma007/GBMods ; unofficial WhatsApp modification, incomplete/noncanonical source and rights unclear. **Use only a conceptual review** of compact privacy/settings affordances and familiar interaction discoverability. Do not build on, redistribute, decompile or embed proprietary WhatsApp assets/modded APKs; no security or stability claims inferred from it.

For each feature below, create a small traceable decision: **existing implementation → reference pattern → adapt/reject rationale → affected file/contract → benchmark/test evidence → residual risk**. Avoid needless features that complicate Masanawa.

## UX/component checklist (implement where applicable; not a promise every feature exists in a reference)

| Area | Required Masanawa behavior | Source/pattern | Gates |
| --- | --- | --- | --- |
| Chats list | Fast first cached paint; avatar, display name, preview, time, unread/mute, stable ordering, accessible New message; search human identity with privacy controls | Flyer list UI patterns; Signal lifecycle | C01–C03/C05, R17 |
| DM thread | Virtualized message items, stable keys, incremental cursor pages, preserve scroll/position on back, date separators, selectable copy/reply where authorized, long-text/wrapping/links with safe handling | Flyer custom builders; Signal durability | C02/C05 |
| Composer | Compact growing text field, emoji/attachments outside cramped field, single context-sensitive send vs mic, deliberate record/stop/review/discard/send, correct keyboard safe area/focus, no accidental send or mic | Flyer composition patterns, familiar chat conventions | C04/C05/R17 |
| Message lifecycle | Client idempotency key and stable UUID mapped to server ID; queued/pending/sending/accepted/delivered/read/failed and retry without duplicate delivery; tombstones/edit only if authorized | Signal send lifecycle reference | C02/C03 |
| Offline/cache | Per-account encrypted/protected indexed storage, cached first screen; optimistic **honest** unsent drafts; bounded outbox, background delta sync, cursor catch-up, conflict rules, revoke/logout purge and corrupted cache recovery | Signal offline-first | C03/C05 |
| Attachments | Allowed MIME/size and content validation, upload retry/resume where supported, signed scoped reads, lazy images/thumbnail/cache caps, progress/cancel, cleanup/expiry; no public file URL | Flyer optional file/image renderers; secure media patterns | C04/C05/R12 |
| Voice note | Press/hold vs tap policy explicitly chosen and tested for accessibility, recorder permission/error/interruption/review, waveform or duration, playback speed only if valuable, zero public Talk leakage | Signal voice note UX concept | C04/R02 |
| Assistant | **One** Gwani/Gwana private thread, inline identity switch with per-message provenance and shared authorized task state; streaming partial replies with stable layout; interrupt/cancel/retry; result attachments and server-driven actionable cards; no cloned DM identity | Flyer streamed/custom widgets | C07/R17/R19 |
| Money cards | Exact quote, fees, currency/network, expiry, confirmation, immutable receipt, pending/reconciling/error; resumable task; DM Transfer opens Wallet authority only; no message-send transfer | Masanawa canonical server contract | R05–R08/C06/C07 |
| Talks | Keep public live mic/session separate; permission request, reconnect/pause/host presence and stage state; preserve listening when using private app screens without private audio leaking | Masanawa-specific, **not** chat widget functionality | R02–R04/R09/R13/R17 |
| Shell | Stable five-tab state/scroll/drafts, route aliases: legacy `/chats` is AI Assistant; human DMs `/messages`; correct back/deep links; no inert controls | canonical app shell | R17/C08 |
| Polish/accessibility | 320dp, large font, screen reader, RTL, reduced motion, loading skeleton vs empty/error, tappable affordances, haptics sparingly, smooth keyboard, white/green tokens and contrast, battery/data cap | Flyer flexible theme; Signal interaction reference | R01/R11/R16/C05/C08 |
| Safety | Block/report/rate limits, contact discovery consent, secure preview and notification content, DM vs public vs AI context isolation, no telemetry leakage of secrets or private media | Masanawa auth/privacy and Signal conceptual precedent | C01–C04/R12/R14/R15 |

## Non-negotiable architecture and interaction contracts

- Keep distinct typed references for human Person/DM, Expert/Twin Persona thread, public Talk, private Assistant and financial Task; server authorizes reads/writes and pushes at every boundary.
- Text and audio are transports for the *same* server-owned typed actions; a model cannot itself settle funds, join paid AI Seats or override consent. Persona switch must not duplicate pending financial execution.
- DM conversation and AI conversation caches may reuse widget rendering primitives, **never** message-authority, recipient identity or confidential context by accident.
- Refresh messages using event + cursor/catch-up rather than expensive whole-history polling; audit existing 12-second AI-chat wallet refresh before optimizing. Do not remove necessary financial reconciliation to improve animation.
- Do not ship group chats, direct P2P calls, unsupported privacy toggles, E2EE claims, custom modded APK code, unqualified wallets or fictitious successful delivery merely because referenced products have them.
- Evaluate dependency license, release maintenance, supply-chain risk, accessibility and binary size before changing `pubspec.yaml`; preserve third-party notices/attribution. Prefer learning techniques over direct source copying.

## Implementation window execution order (map work to *existing* lanes)

1. **Audit before editing**: fetch current `main`; read `CONTINUE-HERE.md`, ownership/traceability/J01–J11 and canonical UX documents; review current Flutter `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`, `ai_chat_state.dart`, composer/widget files, router, DM services (if landed), storage, server APIs, existing active PRs and five-minute leases. Create a per-file evidence matrix, identify existing completed work and non-overlapping candidate improvements; do not assume this research proves current code.
2. **C02/C03**: implement actual two-account server-backed authenticated DMs, stable message IDs, idempotent send, ordered cursor pages, delivery/read truthfulness, reconnect and push links. Preserve C01 authorization; test server rejection and rollback.
3. **C04**: record-review-send/play private voice notes and secure media with permissions/retries, without disturbing live Talks or Assistant audio sessions.
4. **C05**: benchmark current interface on a named budget Android device, then compare a small Flyer adapter/custom-widget prototype. Land only measured, accessible improvements to composer/list/history/local cache, separately from central navigation.
5. **C07**: reuse high-quality renderer primitives for streaming Assistant replies, stable cards and Gwani/Gwana identity attribution while retaining one private task authority. Test voice/text/tap parity and payment reconfirmation.
6. **R17/C08 integration owner only**: migrate final shared shell once; test all legacy routes, tab state, cross-tab returns and live Talk interruptions; avoid overlapping root router or global component work.
7. **R16/C08 release qualification**: run Flutter analyze, unit/widget/integration tests, Android build, authenticated multi-device test, real permissions and network chaos tests; inspect exact CI #457 executable steps and do not merge on zero-step results.

## Measured acceptance and proof required

- Provisional UX budgets from C05: warm cached Chats list **<1,000 ms p95** and cached thread open **<500 ms p95** on specified affordable Android phone; record hardware, OS, build, fixture size, samples and instrumentation. Benchmark **1,000 conversations/100,000 messages**, long threads, media, cold/warm start, low RAM, airplane/2G-like network, data bytes and frame jank. Do not mark achieved without measurements.
- Two authenticated devices: message send/retry/offline reconnect exactly once; scroll/pagination without jumping; kill/restart restores history; blocked user cannot write/read; account switch clears sensitive state.
- Voice notes: microphone permission grant/deny, background interruption, record cancel, upload retry, playback, deleted/revoked attachment, public Talk playing simultaneously; **no cross-stream audio or public transcripts**.
- Assistant: Gwani→Gwana→Gwani preserves attributed messages, drafts and permitted task context, no duplicate financial confirmation; alternate silent path succeeds with mic denied; streaming does not reorder messages.
- Money: one qualified quote/approval/ledger outcome and both receipts, plus pending/timeout/reconciliation; UI never implies success before authoritative result.
- Talk→Chats→Assistant→Wallet→Agents→Talk with live role, scroll, draft and state preserved; all paths, system back, deep links, 320dp/RTL/font scaling/screen reader and poor-network conditions verified.
- Publish exact SHA, changed files, test commands/results, device video/screenshot captures where possible, failed cases, qualified provider/account limitations and recovery notes in existing R/C workstream handoff. **No mocks, static screenshots or code existence count as completed production acceptance.**

## Research links and scope caveat

Source landing pages verified 2026-10-08: https://github.com/flyerhq/flutter_chat_ui ; https://github.com/signalapp/Signal-Android ; https://github.com/rvarma007/GBMods . This is a reference-pattern audit, **not** an exhaustive file-by-file third-party code inspection; windows must validate APIs/versions and inspect relevant examples before selecting dependencies. Production-grade quality comes from measured tests and integrations, not a promise that an APK will be flawless.

