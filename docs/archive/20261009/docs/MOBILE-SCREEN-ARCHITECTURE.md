# Masanawa Mobile Screen Architecture

Status: **canonical screen plan — 2026-10-08**

Goal: design every consumer surface we expect to need without turning every state/action
into a separate screen.

## Design rule

**Prefer one adaptive screen + sheets over many pages.**

A “screen” below means a route or substantial full-screen surface. Sheets/dialogs are
listed separately so implementation does not accidentally create a huge navigation tree.

The consumer app does not expose Rooms, Skills, Workflows, AgentRuns, provider settings
or internal execution concepts.

The separate Masanawa Admin app is out of scope here.

The default is WhatsApp-style white/light with vibrant green, compact rows and sheets.
The existing app is already implemented; continue integration using
`MOBILE-READINESS-PLAN.md`, not a new mockup approval cycle. Locale, conversation
language, country and currency are independent; support localized/RTL layouts.

---

# A. Global shell

## Bottom navigation

**Owner-approved final target: exactly five bottom destinations, in this order**:

1. **Talks** — public Explore and Live Talks, replay and Host/speaker participation
2. **Chats** — authenticated human-to-human text and voice-note conversations only
3. **Assistant (CENTER)** — one private Gwani/Gwana chat with in-chat persona switch, voice/type/tap
4. **Wallet** — qualified money/services, distinct balances and receipts
5. **Agents** — full Masanawa Experts and Twins discovery, private persona chats and My Twin

Former Home Explore/Live content is inside **Talks**; there is **no separate Home tab**. The current Flutter APK has **not** yet migrated or passed device testing; R17/C08 owns the coordinated integration. Root header: Activity bell + profile avatar. Public **Start Talk** green FAB exists **only on Talks**, opening the composer but never immediately broadcasting; **New message** is Chats' primary action. Activity and You remain header destinations. Talks discovery remains one vertical column of full-width Talk cards, never horizontal Talk rails/grids/carousels.

## Global private Gwani/Gwana Assistant

A contextual 'Ask Assistant' affordance reaches the **same user-owned private Gwani/Gwana chat** from all normal screens. It opens a private sheet or expands full-screen. Switch **Gwani ↔ Gwana inside the chat** without creating a separate operator workspace or duplicating pending tasks/payments; mic activation is deliberate.

Examples:
- “Start a Talk about football.”
- “Find an economist.”
- “Buy me data.”
- “Convert my USDT.”
- “Explain this.”
- “Help me prepare for my Talk.”

The **Assistant center tab** is the private operator destination. Contextual entry preserves the authenticated task/history, back navigation and public/private isolation. An Expert/Twin's character chat is a separate, more limited Agents context.

## Global wallet entry

Wallet is a bottom-navigation destination. Compact balance links may also appear in
Profile/purchase contexts; do not duplicate financial clutter across every header.

---

# B. Entry and onboarding

### S01 — Bootstrap / Splash

Purpose: restore account/session, load minimum shell state, route quickly.

No marketing carousel.

### S02 — Welcome / Sign in

One clean authentication entry with the supported login method(s).

### S03 — Verify account

OTP/magic-code verification when required.

### S04 — Basic profile setup

Minimum:
- display name;
- handle/public identifier;
- profile photo optional.

Do not force Twin creation during onboarding.

### S05 — Interests

Optional lightweight chip/topic selection used to seed For You. Skippable.

Microphone/notification permission education should be contextual prompts, not permanent
standalone screens.

---

# C. Discovery

### S10 — Talks / Explore

Default **Talks** sub-tab and app landing destination; historical S10 route names are aliases, not a separate Home tab.

A TikTok-like **vertical** sequence of full-width Talk cards mixing:
- Live Talks;
- strong replays;
- followed creators;
- relevant topics.

One Talk follows another down the page. Never use horizontal Talk grids/carousels.
Primary action: **Listen**.

### S11 — Talks / Live Talks

Second **Talks** sub-tab. It uses the same vertical card language but contains only Talks happening now.

Compact filters/chips may include:
- Trending
- Following
- topics/categories

Filters may scroll horizontally; Talk content itself may not. No Room directory.

### S12 — Search

One global search surface across:
- Talks;
- People;
- Experts;
- Twins.

Results use lightweight segmented filters rather than separate search screens.

### S13 — Topic feed

This is a filtered state of For You/Live, not a unique visual product. It may use a
route for deep linking, but reuses the same feed components.

---

# D. Talk experience

### S20 — Talk

The most important screen in Masanawa.

One route supports:
- Live listener;
- Live Host;
- Live human Speaker;
- Twin owner/Director;
- replay listener.

The screen changes controls by role rather than navigating to different “host room” and
“audience room” pages.

Core visual structure:
- compact title/live status;
- Host + active Seat row/table;
- clear Human / Expert / Twin badges;
- subtle speaking indicator/waveform;
- small audience/reaction summary;
- role-specific bottom controls.

Listener controls:
- React
- Raise hand
- Ask
- Add AI
- Gift
- Share

Host/Speaker controls replace listener controls where appropriate.

Replay mode swaps live controls for playback, follow/save/share and timeline.

### S21 — Create Talk

One short composer:

- topic/title prompt with voice input;
- optional Talk template/tone;
- optional initial participants;
- visibility/replay setting if necessary;
- **Go Live**.

Add Expert, Invite person and Add My Twin open working sheets and preserve the draft;
no optional callback may leave a visible inert action. A missing Twin routes through
creation and returns. AI fees are explicitly confirmed at admission. Audio states and
recoverable permissions are part of this screen, not separate destinations.

The user should be able to say one sentence and launch.

### S22 — Ended Talk summary

After the Host ends a Talk:
- duration/listeners;
- followers/gifts/Seat revenue;
- replay status;
- Share;
- View replay;
- Edit metadata;
- View analytics.

Keep celebratory but compact.

### S23 — Talk analytics

Creator-only detailed performance:
- unique listeners;
- retained listening;
- peak concurrent listeners;
- follows gained;
- gifts;
- AI Seat purchases/revenue;
- replay listening.

Do not turn this into a general BI dashboard.

---

# E. People and persona profiles

### S30 — Person profile

One profile for a human creator/listener:
- photo/name/handle;
- Follow;
- current Live state;
- Talk replays/upcoming if later supported;
- Twin preview if they have one;
- follower/following counts;
- creator badges/reputation where useful.

### S31 — Edit profile

Name, handle, image, short bio and essential public settings.

### S32 — Persona profile

One reusable screen for both Expert and Twin, with clear type badge.

Expert:
- Masanawa verified;
- role/topics;
- Seat fee;
- Talk appearances.

Twin:
- owner;
- personality/topics;
- Seat fee;
- availability;
- Talk appearances;
- hire/add action.

### S33 — Followers / Following

One reusable list screen with a mode switch.

---

# F. Twin ownership

Twin is important but not a primary tab.

### S40 — My Twin

Owner view:
- current Twin identity;
- public persona preview;
- Seat price;
- availability;
- appearances;
- earnings summary;
- Edit;
- Test privately.

If no Twin exists, this surface becomes the Create Twin entry.

### S41 — Create / Train Twin

Keep the previously preferred voice-first philosophy but simplify it for the new purpose.

Minimum structured inputs:
- age/presentation where relevant;
- gender/presentation where relevant;
- image/avatar.

Then Gwani conducts a short voice interview to learn:
- personality;
- important views;
- interests/expertise;
- debate style;
- boundaries;
- how the Twin should represent the owner.

Do not ask for a fixed language preference. Language follows the current conversation.

### S42 — Twin settings

- identity details;
- behavior/boundaries;
- Seat price;
- available/unavailable;
- allow sponsorship/hiring;
- voice/presentation;
- delete/disable Twin.

Performance/earnings link back to Creator earnings rather than duplicating a dashboard.

---

# G. Activity

### S50 — Activity

One chronological, filterable stream.

Includes:
- Talk invitations;
- Raise Hand accepted/declined;
- AI Seat sponsorship requests/results;
- follows;
- gifts;
- Twin hired;
- creator earnings events;
- Talk replay milestones;
- platform notices.

Suggested chips:
- All
- Talks
- Money
- Social

No separate “notifications app” and “creator activity app.”

Detail actions open the relevant Talk/profile/transaction rather than another generic page.

---

# H. You / library / creator ownership

### S60 — You

Personal hub:
- profile header;
- Wallet;
- Creator earnings;
- My Talks;
- My Twin;
- Saved Talks;
- Services;
- Settings.

Avoid dashboard-style cards everywhere; use compact rows.

### S61 — My Talks

Tabs/chips:
- Live (normally zero/one)
- Replays
- Drafts if drafts are persisted

### S62 — Saved Talks

Simple listening list.

No separate “history” screen unless user research proves it necessary; recent listening can
be a filter/state inside Saved/For You.

---

# I. Wallet and creator money

Money concepts must stay distinct:
- qualified fiat balances by native currency (NGN is one market adapter);
- spendable Masanawa balance/credits if used;
- creator earnings;
- crypto assets.

### S70 — Wallet

A private conversational workspace: prominent Talk to Gwani, Type instead and compact
balance/history access. Spoken intents and server-driven cards replace mandatory form
navigation. Overview:
- each supported native fiat balance and optional labeled display-currency estimate;
- spendable Credits balance;
- creator earnings available/pending;
- working Add funds/Send/Withdraw based on exact server capability;
- Withdraw eligible earnings;
- Services;
- Transaction history.

Crypto is linked as a service/asset area rather than merged into a fiat/credit number.

### S71 — Add funds

A conversational funding state/card: native currency/amount + qualified region/funding
method + confirmation + resumable pending details. No promise that an unqualified currency can be funded.

### S72 — Withdraw earnings

Eligible destination/amount + fees + confirmation + status.

### S73 — Transactions

Unified non-crypto platform money history:
- funding;
- gifts;
- AI Seat fees;
- Twin revenue;
- Host revenue;
- refunds;
- withdrawals;
- Billing purchases.

### S74 — Transaction / receipt detail

Exact immutable receipt/status projection.

### S75 — Creator earnings

Simple breakdown:
- Talk hosting;
- Twin rentals;
- gifts;
- later subscription/sponsorship revenue;
- pending vs available;
- payout history.

---

# J. Services

There are exactly two standalone service families.

### S80 — Services

Two primary entries only:

1. **Crypto**
2. **Bills**

This page is reachable from You/Wallet and can also be opened by Gwani.

No Research, Teaching, News, Story, Work or “AI tools” cards.

---

# K. Billing

Billing is private even when launched while the user is listening to a Talk.

### S81 — Bills

Scoped private voice-first conversation with typed/tap parity. Compact intent shortcuts:
- Airtime
- Data
- Electricity
- TV

Recent/favorite recipients may appear below if safely implemented.

### S82 — Bill purchase

One conversation collects only missing details and offers versioned option/quote cards.
The same adaptive workspace may expand an optional manual editor by country/catalog/product:
- recipient/phone/account/meter;
- network/provider;
- plan/package where required;
- amount;
- voice-friendly option selection.

### S83 — Bill confirmation

A quote card reads/shows exact recipient/product/amount/fees/expiry, then accepts an
explicit authorized Confirm. Repeat/Change/Cancel work by voice or tap.

Prefer a confirmation sheet when possible rather than a full route.

### S84 — Bill receipt/status

Success / pending-checking / failed / refunded with provider-safe receipt details.

---

# L. Crypto

### S90 — Crypto

Private conversational asset workspace with immediately accessible portfolio/history:
- crypto balances;
- Deposit
- Buy
- Convert
- Withdraw
- History

No giant token grid.

### S91 — Asset search / select

Searchable eligible assets/networks with low-fee policy and operation availability.

### S92 — Crypto asset

One asset detail with balance and available operations.

### S93 — Deposit

Asset/network selection, deposit address/QR and status/history.

### S94 — Buy

Conversational eligible fiat/on-ramp intent, missing-details collection, exact quote and
provider constraints. Funding and receipt stay in the same durable task.

### S95 — Convert

Conversational selection of source/destination asset/network and amount, then fresh
quote and explicit confirmation. Manual fields are optional editing mode.

### S96 — Withdraw

Conversational asset/network, trusted destination/QR/paste, amount and fresh fees/minimum
quote, then authenticated explicit confirmation. Do not rely on dictated long addresses.

### S97 — Crypto transaction detail

Deposit/conversion/buy/withdraw status and reconciliation evidence.

Operation confirmation can be a sheet reused by Buy/Convert/Withdraw.

---

# M. Settings and safety

### S100 — Settings

Compact list:
- Account
- Privacy & safety
- Notifications
- Appearance/accessibility if required
- Help
- About/legal
- Sign out

Language is dynamic for AI conversation. A UI-language setting may exist but must not
become an AI language restriction.

### S101 — Account

Account identity, verified contact methods, security and account management.

### S102 — Privacy & safety

- profile visibility controls allowed by product;
- blocked accounts;
- Talk privacy defaults where applicable;
- data controls.

### S103 — Notifications

Talk/social/money/platform notification preferences.

### S104 — Blocked accounts

Manage blocks.

### S105 — Help & support

FAQ plus private Gwani support entry/contact escalation.

### S106 — Legal / About

Terms, privacy, community standards, version.

### S107 — Delete account

Accessible explanation, recent reauthentication and explicit destructive confirmation
with durable server request/progress. No reading/typing-only barrier.

---

# N. Sheets and overlays — not standalone screens

These should generally remain sheets/dialogs:

- Global Gwani private assistant
- React picker
- Raise Hand request
- Ask question
- Add AI / participant picker
- Expert/Twin search picker
- Sponsor Seat quote/confirm
- Host sponsor approval
- Human speaker queue
- Host participant management
- Invite/share human
- Gift picker
- Direct Twin
- Talk “More”
- Report
- Block/mute
- Follow list quick preview
- Wallet quick balance
- Billing confirmation
- Crypto quote confirmation
- Share/deep-link sheet
- Permission prompts
- Host reconnection state

Do not create routes for these unless mobile usability proves a sheet cannot handle them.

---

# O. Screens we explicitly do not build

The following old concepts must not return as consumer destinations:

- Home Rooms
- Teaching Room
- Research Room
- News Room
- Story Radio Room
- Work/Business Room
- Internet Cafe Room
- Skills browser
- Tools browser
- Workflow screen
- Agent directory as app home
- Clone marketplace
- My Twin as a bottom tab
- separate creator-economy dashboard full of internal balances
- Agent Float screen
- provider/model configuration
- general AI-only public radio

Teaching/research/news/story/search capabilities remain usable through Gwani/Experts and
inside Talks without their own app sections.

---

# P. Proposed primary routes

Exact identifiers can change, but the route hierarchy should remain small:

- `/talks` (Talks root; old `/home` goes to Talks Explore)
- `/messages` (private human Chats list)
- `/messages/:conversationId` (authenticated human DM)
- `/assistant` (single private Gwani/Gwana operator chat)
- `/agents` (Experts/Twins directory)
- `/talk/create`
- `/talk/:talkId`
- `/talk/:talkId/analytics`
- `/activity`
- `/you`
- `/u/:handle`
- `/persona/:publicId`
- `/twin`
- `/wallet`
- `/wallet/transactions/:id`
- `/services`
- `/services/bills`
- `/services/crypto`
- `/settings`

Most subordinate flows should be nested state/sheets instead of permanent new routes.

## Mockup priority

Design in this order because these screens define the whole product:

1. Talks — Explore / Live Talks (formerly Home)
2. Talk — listener
3. Talk — Host
4. Create Talk
5. Add AI / Sponsor Seat sheet
6. Talks / Live Talks state
7. Person profile
8. Persona profile
9. Activity
10. You
11. My Twin + Direct Twin
12. Wallet + Services
13. Bills
14. Crypto
15. Onboarding/settings

The Flutter shell still has the previous four-tab layout; **migrate once** to the five-tab target through the claimed R17/C08 integration owner while preserving working foundations. Finish the action/audio/services requirements in `MOBILE-READINESS-PLAN.md` with real verification; no additional mockup approval is required.

## Current settings, feedback and transaction states

Settings contains UI language/locale (device default + override), privacy/recording,
notifications, support/report feedback, account security/session controls and
**Account -> Delete account**. Use sheets within Settings for explanation, recent
reauthentication and request progress. Provide a working external deletion request
page without requiring reinstall; account/server cleanup and retention follow R12.
Conversation language remains dynamic, independent of Settings locale.

Billing/Crypto/Wallet reuse existing adaptive screens for exact quotes, funding,
confirmation, pending/unknown/final/refunded status and receipt. Restore owned funding
instructions after restart and hide them when terminal. Return to the active Talk;
private values never become public stage content.

Gift sheets show a localized server catalog with animation previews, exact price and
confirmation. Stage animation, activity and agent event agree on authoritative success;
reduced-motion users receive a static equivalent. Persona profiles use the full defaults
in `DEFAULT-AI-PERSONAS.md` without adding another root directory.

## Voice/text parity across screens

`VOICE-FIRST-INTERACTIONS.md` is canonical for applicable surfaces. Spoken topic creation,
persona discovery, invitations/questions, Direct Twin, Settings/support and financial
actions use contextual voice commands with complete silent alternatives. Keep public
speech and private commands distinct. Cards/states are not additional permanent routes.
Test permission denial, audio privacy, barge-in, low literacy, RTL, interruptions and
app restart; never require reading or typing to finish an advertised voice journey.

## Additive communication screens and performance (C01–C08)

Preserve S01–S107 **screen purposes**, while placing them under the **approved five-tab target**. **Chats is the human messaging root tab**, with adaptive Chats list and human DM conversation routed states; no duplicate voice/text UIs. A person profile gets a conditional **Message** action; contact lookup and privacy, unread state, mute/block/report, send text and record/play voice notes reuse existing compact chat styling. AI-character conversation, public Talk comments and private human DMs remain different data/security realms. Do not reuse AI chat local history as an unproven human DM store.

History is **server durable** with protected per-account **on-device indexed recent cache**, background delta sync, paginated older-message loading, lazy media, queued sends accurately marked pending and safe account-change cache clearing. Profile against provisional targets: cached Chats list under 1 second p95 warm navigation and cached thread under 500 ms p95 tap on representative low-cost Android; measure cold start, memory, frame times and network bytes. Do not block the first useful frame on wallet, AI or provider refresh. No manual backup/restore flow is demanded; history must still be accessible after restart and on another authenticated device. See C05.

A clearly labeled contextual **Transfer** from a human DM opens the *existing* eligible Wallet quote/confirmation/receipt journey. The message **Send** arrow sends text or voice notes only. Gwani/Gwana voice/typed commands reuse server-owned actions in one center Assistant chat (C06/C07). **Talks · Chats · Assistant · Wallet · Agents** is the approved five-tab design, not a conditional four-tab option; production needs real DMs, single Assistant persona switch, preserved Experts/Twins, R17/C08 route/Android/privacy acceptance. The former Home feeds and public FAB remain in **Talks**, with no sixth tab.

## Latest shell, profile and persona acceptance

APP-SHELL-CONTRACT.md supersedes older root placement in historical mockups.
Agents has Masanawa Agents/Twins tabs; service shortcuts initiate the private assistant
with the selected intent. Crypto comes first in Wallet, followed by Data bundles,
Airtime, Electricity and TV/Cable. Profile editing must upload/replace/crop/remove photo
and save name/handle/bio, with permission denial, progress, retry, validation, restart and
cross-surface propagation. Do not count a decorative edit icon as a working feature.

Distinct **public Talks** and **private Assistant** destinations replace ambiguous Talk naming. Keep existing routes
for Activity/Profile and deep-link targets. Avatar removal yields a fallback, not a broken
image. Full persona behavior acceptance is R19/DEFAULT-AI-PERSONAS.md.

## Approved final navigation and source precedence

The owner approved **Talks · Chats · Assistant · Wallet · Agents** on 2026-10-08: exactly five destinations with Assistant centered. `APP-SHELL-CONTRACT.md` and `END-TO-END-UX-ARCHITECTURE.md` own typed route names, per-screen actions, identity boundaries, back/deep-link rules and C01–C08/R01–R19 acceptance. Historical S-number descriptions above are **screen purposes**, not authority to restore the old four-tab Home/Agents/Wallet/private Talk layout.

Preserve `/home` (Talks), `/home?tab=talk` and `/chats` (private Assistant aliases), `/chat/:characterId` (legacy AI persona thread) via tested compatibility. New human DMs exclusively use `/messages` and `/messages/:conversationId`. **Start Talk FAB** belongs only on Talks; **New message** on Chats. One R17/C08 integration owner must perform the migration with C01–C07 owners. The current APK and production device acceptance are **OPEN/UNVERIFIED**.
