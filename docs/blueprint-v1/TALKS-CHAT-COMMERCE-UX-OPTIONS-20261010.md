# Masanawa v1 — Talks, branded art, chat composer and commerce UX design review
Status: **HISTORICAL DESIGN OPTIONS — TALK/USER-PUBLISHING PARTS SUPERSEDED**, 2026-10-10. Retained only for composer/blue brand/independent Billing/Crypto source findings. Current **confirmed** authority: [Masana-only mixed-media Home](MASANA-CREATOR-NETWORK-20261010.md). NO member posting, NO public Talk composer, NO audio-only full-screen default, NO Twins. Home replaces root Talks. Old draft options in this file MUST NOT be dispatched into code.

## Executive recommendation
**Historical/superseded Talk option:** former one-audio-post Explore is NOT the new Home default. New Home has Masana-only text/image/audio/video-ready cards with For You/Following. Shared playback state means swiping, comments, tab changes and deep links preserve progress predictably.
**Cover art:** optional creator upload; attractive blue/waveform default; thumbnail variants and short-lived upload; no dependence on generative-image API.
**Brand:** replace legacy WhatsApp greens with a consistent Masanawa blue/neutral design token system; reserve a single green only for confirmed success.
**Chat:** one stable text input and attachment tray; dedicated mic for recorded voice notes and separate optional live Gwani voice; send always present when draft is nonempty, even while previous agent response is pending.
**Billing & Crypto:** retain existing independent screens and routes, redesign with clear in-screen navigation and ledger-backed review/receipt; same canonical purchases available via Gwani/Chats as OPTIONAL conversation-entry paths. No automatic redirect to chat.

## Research and evidence
- Spotify's current episode-preview pattern combines artwork, short sound previews and waveforms for audio-only content. https://support.spotify.com/uk/creators/article/episode-previews/ (retrieved 2026-10-10).
- Spotify allows episode thumbnails and custom audio/video clip visual discovery; this supports optional cover artwork, **not** the conclusion that every audio post must contain video. https://creators.spotify.com/resources/how-to/optimize-your-spotify-show-page and https://creators.spotify.com/resources/news/the-new-home-of-podcasting-on-spotify (retrieved 2026-10-10).
- SoundCloud's visual player emphasizes per-track artwork. https://help.soundcloud.com/hc/en-us/articles/115003566828-The-Visual-embedded-player-/ (retrieved 2026-10-10).
- Flutter `PageView.builder` is lazily built, page-oriented; use item identity callback if ordering changes, bounded image/audio prefetch and single player. https://api.flutter.dev/flutter/widgets/PageView/PageView.builder.html
- Flutter recommends localizing `setState` to small subtrees, not rebuilding large scenes for each small state change. https://docs.flutter.dev/perf/best-practices
- Flutter `TextEditingController` warns about selection/composing-region modification and input-method feedback loops. https://api.flutter.dev/flutter/widgets/TextEditingController-class.html
- Android requires explicit audio-focus behavior on supported OS versions. https://developer.android.com/media/optimize/audio-focus
- Android layout guidance uses up to five primary destinations, additional features as subroutes/tabs. https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-and-nav-patterns

## Observed Masanawa source findings — main SHA 7c443966...
- `apps/mobile/lib/src/screens/talks/talk_home_screen.dart`: old `Explore | Live Talks` double feed and `TalkFeedKind { explore, live }`, incompatible with the new published Talk / Following direction. **Do not redesign this legacy widget in place** without reconciling AF09 new audio-post work.
- `apps/mobile/lib/src/talks/talk_models.dart`: old live Talk DTO has `heroImageUrl`, but that does NOT prove that new published audio-post models or upload API support cover artwork.
- PR #609 (`work/af09-published-audio-20261010-gpt6`): new `apps/mobile/lib/src/audio_posts/audio_post_feed_screen.dart`, `audio_post_composer_screen.dart`, media/upload, worker, repository/schema. Existing new composer exposes audio and title; **no verified cover-upload contract** was identified in the inspected composer/schema. Add cover to *this* source, not legacy live-Talk creator.
- `apps/mobile/lib/src/tokens/masanawa_tokens.dart`: explicitly WhatsApp-green light token `#25D366`, strong `#075E54`, dark `#00A884`, and gradients; theme receives tokens. This explains mixed green. Also update matching shared `packages/tokens` parity as required by architecture tests.
- `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`: one `_Composer` with a `TextField`, but the action icon becomes **Stop** whenever `sending=true`, even with unsent text. The input listener calls `setDraft` on every edit. There are additional inline voice/emoji/Twin/Study panels. `_walletRefreshTimer` refreshes balance every 12s while chat is open; investigate actual rebuild cost. The emoji toggle allocates `FocusNode()` without managing its lifecycle. Root build watches broad chat and wallet state.
- `apps/mobile/lib/src/state/ai_chat_state.dart`: `sendText` checks `sendingIn`; it awaits `_offlineNow()` *before* inserting visible message, and `_dispatchUserMessage` uses `sendingIn` until the full response/audio completes, so subsequent Send actions are blocked. `setDraft` calls `_save()` on each character. These are **concrete source-level causes for missing Send and perceived lag**, though device freezing/duplicate widgets still require runtime profiling and source reconciliation.
- `apps/mobile/lib/src/router/app_router.dart`: routes `/billing` and `/crypto` already exist and construct dedicated screens; there is no mandatory chat redirect in those route builders. The root `/chat` aliases and older shell/invocation paths are inconsistent. The user's observed redirect could be in a caller/new draft/local APK, not established by these two routes themselves.
- `apps/mobile/lib/src/screens/billing/billing_screen.dart`: authenticated catalog, provider/item selectors, direct create quote / wallet confirmation and history exist, but the form is one long generic dropdown flow with no dedicated service dashboard.
- `apps/mobile/lib/src/finance/crypto_wallet_screen.dart`: own real screen and capability-gated Buy/Receive/Convert/Withdraw, but most operations are modal sheets with limited contextual guidance and no obvious in-screen asset/detail route contract. Keep its transport and authoritative receipts; redesign the shell.

## HOME-UX — supersedes former TALK-UX-01/02
**Confirmed owner requirement:** only Masana agents originate text, image and audio public posts. Root is **Home**, not Talks. Mixed variable-height For You / Following feed cards, single audio player, optional immersive audio listening view, reaction/comment/follow/save/share, no user plus/record/post entry. Masana profile opens portrait/banner/story/skills/unique personality/post library, Chat and Call.

**Cover/imagery:** the platform/admin or Masana worker selects/uploads optional authored image for audio covers and original image posts, or renders a deterministic blue branded default. The image crop, thumbnail optimization, EXIF stripping, background processing, safety and MIME validation research remains useful; it belongs in **admin/worker** media tools only. User image uploads remain possible in **private chats** if authorized but not to public Home. Persist nullable media IDs in AF09's published-audio extension after shared contract review and account-role tests. See [current design, data contracts, canonical ACL and acceptance tests](MASANA-CREATOR-NETWORK-20261010.md).

## BRAND-UX-01 — unify blue
The mixed greens are *intentional in old code* but **no longer fit the chosen blue direction**. Define one semantic palette, not ad-hoc per-screen fixes; proposal:
- Primary: Masanawa Blue `#2466CD` (provisional; contrast-check and owner signoff).
- Dark primary: `#17458D`; supporting bright tint `#DCEBFF`, text `#16243A`, dark canvas `#101B2E`, light canvas `#F7F9FC`, white cards.
- Gradient limited to deliberate cover default and a few hero surfaces, not every button.
- Green `#16804A` only for **confirmed success**, not default chips/navigation; amber only warning, red only error; neutral gray for unselected.
- One token source updates `apps/mobile/lib/src/tokens/masanawa_tokens.dart`, `apps/mobile/lib/src/theme/masanawa_theme.dart`, shared package-token parity, Android launch/dark resources, logo/assets, admin tokens where reused, all active new screens. Preserve semantic role names to minimize impact; introduce accent if needed instead of redefining `verified` as identity provenance badge.
- Test dark/light Android splash, navigation, composer, Talk cover and receipts; minimum WCAG AA contrast where relevant, dark/light dynamic type, screen readers. No unqualified claim that the suggested hex ratios have already passed.
Proposal requires approval of blue shade using actual brand hero and device preview before changing production tokens.

## CHAT-UX-01 — one reliable shared composer
**Layout (one row):** left `+` attachment opener OUTSIDE field; one flexible rounded TextField in center (placeholder "Message"), expands one to max five lines; right circular **microphone when genuinely empty** or **send when nonblank or attachment staged**. Keyboard's standard emoji picker avoids second permanently visible emoji button; attachment sheet provides Camera, Photo, Document, optional Location only if supported. Reply preview and staged files above single input only when present. Recorded voice-note mic supports press/lock/cancel/preview/delete/send; accessible tap-to-record alternative. Live Gwani voice is a distinct header "Live" / headphones action, not the composer microphone. A streaming reply has its Stop control **in its reply bubble/header**, never in Send's place.

**State machine:** EMPTY -> DRAFT -> LOCAL_QUEUED -> SENDING -> SERVER_ACCEPTED -> AGENT_PROCESSING -> COMPLETED/FAILED. Editing a new draft remains allowed through the prior reply. Do not tie Send visibility to agent thinking/slow speech. On tap Send, commit draft to bounded local outbox and render user bubble synchronously BEFORE async connectivity check; then submit using stable `messageId + idempotencyKey`. Distinguish server ACK from answer completion and human delivered/read. If server supports only one agent turn at a time, serialize queued turns server-side while keeping Send responsive; UI does not silently drop messages. Clear field only after durable local commit, otherwise preserve text and show retry.

**Flutter ownership:** single `TextEditingController` and `FocusNode` per stable chat composer instance, not recreated or reprogrammed during rebuild. Draft text stays local while typing; debounce asynchronous disk save and rebuild only the Send/Mic region via `ValueListenableBuilder` or focused state selector. Avoid full 4,403-line chat screen reconstruction on every character and on 12-second wallet polls. Move wallet refreshing to entering Wallet or after a financially relevant event, not a blanket periodic chat refresh. Move voice picker/attachments and Live panel out of text field; remove Twin interview, old café and teaching cloning branches under approved legacy cleanup. Avoid reading/writing selection/composing mid-build. Account-switch teardown explicitly cancels autosaves/listeners and preserves drafts only under their correct account.

**Acceptance tests:** text typed while previous agent audio/text streams still shows Send and queues; offline bubble appears instantly then retries; typing 500 chars with rapidly updated agent deltas/emoji/keyboard does not freeze; keyboard show/hide and focus stable; attach+send and voice record works; failure does not delete draft; repeated tap does not duplicate; user reply reference retained; server ACK before slow AI; background-resume retains state. Profile cold/warm frame build/raster timings on low-end Android, latency first keystroke -> caret, send tap -> bubble (target immediate, verify), send -> durable ACK and AI first text separately. Run real Flutter widget/integration tests, not just static analysis.

## COMMERCE-UX-01 — independent Billing
Current `/billing` exists; **retain route** but rebuild screen with real service categories. Entry points: `Gwani > Services`, Wallet's `Pay Bills`, or a supported legacy link; **no automatic Chats transition**. Inside:
1. **Services home**: compact balance/eligibility summary and four category cards Airtime, Mobile Data, Electricity, TV/Cable; Recent Purchases and "Ask Gwani" optional button.
2. **Category details**: live provider catalog, saved/last recipient optional (consented), recipient/customer input, dynamic amount/bundle selectors with actual server schema and validation. Back preserves selections.
3. **Quote/Review**: amount, MSN debit, fees, recipient/service, expiry, authorize/cancel/change. If inadequate funds, explicit Add Funds -> return to same draft, not a new chat.
4. **Processing/Receipt**: queued/pending/uncertain/success/failure; status lookup, retry safe after reconciliation, receipt persists in Wallet and purchase history.

Menus in Gwani text/voice/chips submit exactly the SAME canonical `PurchaseDraft` and executor, with optional `Open details` taking the existing `taskId` to Billing; no parallel billing logic. Approval remains explicit and route-independent. Need published versioned catalog validation, no hardcoded unsupported products. No company names/commission screens from old Twin economy.

**UX acceptance:** from Wallet -> Airtime -> select contact number -> quote -> authorize -> process -> receipt -> Back to Wallet; NEVER opens chat unless "Ask Gwani" tapped. Same task via Gwani text/menu/voice shares original authorization and receipt, Back retains draft; retry after uncertain provider does not charge twice. Offline catalog projection may display unavailable but cannot authorize expired quote.

## COMMERCE-UX-02 — independent Crypto
Current `/crypto` exists; retain it as `Wallet > Crypto` subroute. Split complex page into manageable screens (no extra bottom tab):
1. **Crypto overview** — supported holdings, balance revision/as-of, recent transactions, Receive, Send/Withdraw, Buy, Convert.
2. **Asset detail** — selected asset + network, available/pending, eligible actions, history.
3. **Deposit/Receive** — server-generated address/memo and network, copy/QR, confirmations, pending status.
4. **Send/Withdraw** — internal recipient vs external address clearly separated, asset/network limits and fees, review/step-up, status.
5. **Convert** — from/to supported assets or MSN, amount, live quote, expiry, authorization, progress/receipt.
6. **Buy** — supported fiat checkout where provider eligible, hosting URL only from backend; return to status independently of Chats.
7. **Transaction detail** — immutable receipt/ledger operation and support/status refresh.

Do NOT default-navigate to chat after selecting crypto asset, bill service, quote or completing a transaction. Optional `Ask Gwani about this` passes a **context reference** (asset, quote/task/receipt ID) to Gwani with user consent; no assumed wallet spend from a model response. A Gwani command can navigate to the existing Crypto quote/review screen via `operationId`, then return to previous chat when Back is pressed.

**States/negative tests:** unsupported token/network disabled with explanation; wrong chain/memo risk, deposit under minimum, onramp provider down, quote expired, insufficient liquidity, partial provider settlement, withdrawal unknown, payout duplicate, incorrect account, session revocation, stale cached balance, weak network/timeout/restart. No real-money activation until qualified provider/legal, accounting, reconciliation, reserve and receipt gates pass. Simulated tests must not be called live transaction proof.

## Proposed implementation order and source owners
A. **Fix composer behavior FIRST** (AF06 + AF00 scoped composition): break send/stop coupling, put bubble before network check, remove per-character disk write / broad rebuild; run real Flutter + Gateway ACK tests.
B. **Brand token parity** (one UI/design owner, AF00/native agreement): approve blue palette, change once across tokens/themes/assets and parity tests.
C. **Masana-only mixed-media Home** (AF09 + AF05/AF12/AF15/AF00): extend published audio into typed text/image/audio posts, with admin+worker publishing only, full profiles, follow/comment/reaction and optional image covers. User publisher + old live-stage screens excluded.
D. **Independent Billing/Crypto** (AF04/AF01/AF03 + AF00 routes): leave existing finance authority, design service/asset details and receipts; Gwani is OPTIONAL invocation into same typed task.
E. Qualify Android low-end, data usage, capture/playback, account switching, all quote/provider failure cases and safe integration baseline; preserve old APK/local fixes before any UI overwrite.

## Updated decision status
- **HOME-01 Confirmed:** Center tab now Home, only platform Masana posts; mixed text/image/audio feed in variable-height cards. Old OPT-01 one-Talk-per-screen audio-only Explore is **REJECTED/SUPERSEDED** for default Home; optional immersive Listen can snap vertically.
- **HOME-02 Confirmed:** Agent/admin image-post and optional audio cover support, with brand default. Former OPT-02 **user** cover uploader is **REMOVED**.
- **OPT-03 Blue branding:** still recommended; exact color palette requires approved visual and contrast qualification.
- **OPT-04 Chat composer:** retain fix recommendation, recorded voice note in composer; Live voice separate. Supports human and Masana DM/calls.
- **OPT-05 Independent Billing/Crypto:** unchanged, no automatic chat redirect; Gwani remains optional task entry.
No code in this file is claimed implemented.
## Definitive current chat/Rooms direction (new owner override)
Composer advice in this file applies **only** to fan-to-Masana direct chats and Gwani; no human-to-human chat/contact/calls exist. Rooms are **staff-created and owned by professional Masana** with announcements/questions, free/paid subscriptions and automatic Masana teacher replies, not group DMs. Home video-ready, admin-managed content only; full new scope in [canonical Rooms/admin plan](MASANA-ROOMS-ADMIN-ARCHITECTURE-20261010.md). Do not implement obsolete creator/human Chat instructions from historic design options.
