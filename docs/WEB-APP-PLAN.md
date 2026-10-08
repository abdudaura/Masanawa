# Consumer Web App Plan

Status: **approved planning scope — DEFERRED implementation, 2026-10-08**
Priority: complete current mobile R01–R19 and shared service/runtime readiness first.
This plan reserves no implementation paths and does not authorize web launch/deployment.
Read CONTINUE-HERE.md, APP-SHELL-CONTRACT.md, VOICE-FIRST-INTERACTIONS.md,
DEFAULT-AI-PERSONAS.md and MULTI-WINDOW-WORK.md before later implementation.

## 1. Purpose and current state

Provide a full responsive Masanawa consumer experience on phone, tablet and desktop:
discover/listen to human-hosted Talks, participate, browse/chat with Agents and Twins,
manage a global wallet and use private conversational Billing/Crypto.

Current source at 14983022f40e3d7f070b72d6823793b58858d58b includes apps/web with a
Next.js/React scaffold and a foundation page only. It is not a working consumer app.
Reuse and inspect that scaffold when work starts; do not create another repository or
duplicate domain authority. Dependency versions must be rechecked then, not changed
merely to write this plan. The separate Admin app is outside this consumer scope.

The browser is a first-class client of the same account, Gateway, identities, personas,
Talks, ledgers, quotes and provider qualification as Android. No separate web wallet,
credit system, AI persona registry or browser-held provider secret.

## 2. Responsive shell

| Surface | Phone | Tablet / desktop |
| --- | --- | --- |
| Root navigation | Home · Agents · Wallet · Talk bottom bar | The same four destinations in a compact side navigation |
| Header | Activity bell + profile avatar | Activity bell + profile avatar; contextual search where useful |
| Public creation | Green Start Talk FAB | Accessible Start Talk action in persistent chrome; same composer |
| Home | Explore / Live Talks, one vertical card column | One readable vertical feed; no desktop card grid/carousel |
| Agents | Masanawa Agents / Twins tabs | Same tabs, compact searchable list with optional detail pane |
| Wallet | Balances, service intents and history | Balance/transaction pane beside the private conversation when useful |
| Talk | Private voice-first assistant | Conversation/cards with roomy controls; text is equally complete |

White/light surfaces and vibrant green inherit shared tokens, not a new web brand.
Use comfortable reading widths, short labels, keyboard accessibility and touch targets.
Do not force a full-height desktop dashboard into a phone screen.
Public Talk stage is one adaptive surface for Host/Speaker/Audience/replay, with comments,
questions and secondary sheets/panels. Private root Talk always identifies itself as
private; Start Talk opens public creation and never instantly broadcasts.
Avoid ambiguous links named Talk without explaining private/public context.

## 3. Page and state inventory

| Page / state | Required behavior |
| --- | --- |
| Public landing | Clear product explanation, listen/discover and sign-in entry; no invented usage statistics or synthetic live inventory |
| Home | Explore/Live feeds, topic filters, loading/empty/error/retry and preserved scroll |
| Public Talk link | Real title/Host/live or replay state; join/listen; clear public/recording notice |
| Public Talk stage | Authorized audio, role-aware controls, free hands/invites, questions/reactions/polls/comments, AI Seat/gift confirmation, safety and lifecycle |
| Create | Spoken/typed topic, working Expert/person/Twin selectors, draft recovery and explicit Go Live |
| Agents | Masanawa Agents/Twins discovery with real roles, availability and private Talk/Type actions |
| Agent/Twin profile | Approved identity, role/style, owner when applicable, private conversation and separately priced public Seat action |
| Private Talk | Deliberate microphone start, native live audio, typed fallback, assistant responses and interactive cards |
| Wallet | Separate native fiat/Credits/earnings/asset-network balances, funding/qualified actions and history |
| Billing/Crypto | Scoped private conversational state, not mandatory form funnels; exact quote, consent, recovery and receipt |
| Activity | Canonical events, unread state, filters and correct deep links |
| Header profile / Settings | Upload/crop/replace/remove photo, name/handle/bio, language/privacy/security/notification/support and deletion |
| My Twin / Direct Twin | Existing voice-first creation and owner-only live direction; no public leakage |
| Saved / My Talks | Owned library, replay publication/status and permitted management |
| External account deletion | Functional branded request path usable without reinstalling Android |
| Support / legal | Clear private support escalation, policies, recording/financial disclosures and app/version status |

These are logical surfaces. Use sheets, drawers, panels and nested state where possible,
not one new page for each transaction step. Route names reuse canonical URLs/contracts.
Old deep links and browser Back/Forward must work; refresh restores an owned durable task.
SEO applies only to actually public permitted content, never private conversations/wallets.

## 4. Browser audio and voice-first behavior

Use qualified Gemini Live/native audio through existing authenticated server composition;
do not replace it with browser TTS. Keep the microphone off until intentional activation.
User gesture/autoplay rules, HTTPS/permission, device selection, echo cancellation,
Bluetooth/headphones, mute and reconnect states require explicit browser acceptance.

Users can host/listen and admitted speakers publish only with current server grants.
Host absence pauses/stops AI; no browser tab or background task becomes a replacement Host.
Refresh, tab suspension, device sleep and network changes must respect bounded reconnect
policy and avoid duplicate participants or continuing unauthorized generation.

Provide typing/taps on every voice task, spoken terms/receipt for low-literacy users,
Repeat/Slower/Explain/Cancel and barge-in. No automatic garbled user transcript display.
Private assistance while in a public Talk must never publish into the public track.
If the browser cannot safely isolate concurrent sessions, explicitly suspend public
publication before opening private voice and restore it only through a clear user action.
Capability limitations must be visible; do not claim background audio works universally.

Initial qualification matrix: current Chrome/Edge/Firefox/Safari desktop and relevant
Android/iOS browsers, keyboard/screen-reader and denied permissions. Supported minimum
versions are set from real testing at implementation time. Unsupported voice still has
usable text/listening where eligible, not an endless permission loop.

## 5. Conversational wallet and services

Wallet orders Crypto first, then Data bundles, Airtime, Electricity and TV/Cable.
Each shortcut initializes a private assistant task with that intent already selected;
it does not pay, activate a microphone or expose financial details to a public Talk.

Balance/recipient/option/quote/funding/pending/receipt cards follow
VOICE-FIRST-INTERACTIONS.md. Voice/text/taps share one task/operation identity and fresh
server quote. “Second one” binds to a stable option version. Misheard currency/amount,
expired quote and ambiguous recipient require correction, not model guessing.

Native balances/rails are qualified per country/provider/account; preferred display
currency remains an estimate. QR/paste/trusted destinations support crypto addresses.
Typed edits are optional manual mode. Explicit authenticated confirmation is mandatory;
unknown outcomes reconcile the same operation. Never retry a charge just because the
browser lost its connection. Backend recovery gaps must be fixed before enabling web
financial operations; a polished new browser checkout is not a substitute.

## 6. Identity, profile and privacy

Reuse customer auth and authorization. Select browser session transport with security
review: appropriate secure HttpOnly cookie/BFF or existing vetted strategy, CSRF where
applicable, cross-origin rules, logout/revocation and short-lived media grants.
Do not copy native token storage assumptions into localStorage or expose server secrets.
No cached unauthenticated response may reveal another user's wallet or private chat.

Profile editing uses the same canonical image storage and validation as Android.
Verify file format/size/orientation, upload progress/retry, crop, cancellation, remove,
cache refresh and access controls. International names/handles/bio are supported.
Private assistant memory is consented/editable/deletable and separate from public stage.

Deletion is a durable server request with recent authentication, processor cleanup,
session/channel/push revocation, balance resolution and disclosed minimal retention.
Shared public recordings/content and immutable financial evidence follow established
policy. The website provides the external deletion route required by the release plan.

## 7. Agents, social interaction and quality

The seventeen approved personas retain distinct roles, humor and multilingual identity.
Natural performance is useful and entertaining, with clear AI labels and respectful exits.
Reuse the bounded context/event adapter: verified public reactions, questions, hands,
admissions, gifts and moderated comments reach appropriate Seats; private data does not.

Gift animations synchronize with canonical confirmed settlement, never optimistic money.
Honor reduced motion, cap event bursts and avoid obstructing controls/audio.
Report/block/mute/platform enforcement applies across feeds, profiles, stage and replays,
not only the browser view. Activity/push links preserve authority after sign-in.

## 8. PWA and global accessibility

PWA installation is optional later enhancement, not a prerequisite or substitute for
working web journeys. Cache static public assets only by default; financial actions,
private transcripts and credentials are not offline-ready cached content.
Offline mode may preserve permitted structured drafts, never execute payments or approve
stale quotes. Clear sensitive local caches on logout/deletion/shared-device exit.

Browser notifications need deliberate opt-in and verified support; Activity remains
usable without push. No promise of native-equivalent background microphone/push.
Support UI locales/RTL, international formats, code-switching and screen readers.
Do not infer jurisdiction from language or accent. All core journeys support both
voice-only low-literacy use and silent keyboard/tap use.

## 9. Implementation phases — all DEFERRED

| Phase | Later scope | Exit evidence |
| --- | --- | --- |
| W01 | Responsive shell, auth, header profile/Activity, routes and public link landing | Working responsive/keyboard navigation, secure sessions and canonical API bindings |
| W02 | Home discovery, Agents/profiles, library and profile editing | Actual catalog/content, permissions, upload/remove persistence and deep-link continuity |
| W03 | Public Talk audio/creation/participation plus private voice workspace | Real multi-user browser/device audio, human Host policy, permissions/reconnect and privacy isolation |
| W04 | Global wallet and conversational Billing/Crypto | Shared mobile/backend recovery qualified; actual advertised provider operations with one execution and receipts |
| W05 | AI Seats/gifts/context, Twins/Direct Twin, recording/replay and notifications | Confirmed settlement/context convergence, authorized recordings, moderation and opt-in delivery |
| W06 | Localization, deletion/support, security/accessibility/performance and optional PWA | Target-browser acceptance, privacy controls, release evidence and operational monitoring |

Order may be adjusted for dependencies, not to bypass authorization or qualification.
W03 private read-only assistance can be prepared before W04 real financial operations.
Reuse earlier mobile tests/contracts where possible; browser behavior needs its own tests.

## 10. Release gate and continuation

Do not start implementation during a mobile lane merely because this plan exists.
When scheduled later, recover current main and apps/web, inspect active claims and shared
API/ledger/runtime changes, and claim one bounded W-phase. No broad permanent web ownership.
Shared auth/events/router contracts and migrations require coordinated integration.

Release evidence includes build/typecheck, relevant route/component/API and browser tests,
real Host/listener/AI audio, interrupted/duplicate financial recovery, profile persistence,
multi-language/RTL, privacy isolation, deletion, notification/replay, responsiveness and
production logs. Set measured latency/performance targets after an initial browser baseline.
Do not call a scaffold, mocked API or registered worker a working web platform.

Use staged environment qualification and feature capability gates, with safe rollback
and exact deployed SHA. Do not deploy or enable financial capabilities based on a plan.
Current first priority remains mobile R01–R19; this file records later web work.
