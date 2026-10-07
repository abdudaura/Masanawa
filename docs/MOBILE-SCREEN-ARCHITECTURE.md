# Masanawa Mobile Screen Architecture

Status: **canonical screen plan — 2026-10-07**

Goal: design every consumer surface we expect to need without turning every state/action
into a separate screen.

## Design rule

**Prefer one adaptive screen + sheets over many pages.**

A “screen” below means a route or substantial full-screen surface. Sheets/dialogs are
listed separately so implementation does not accidentally create a huge navigation tree.

The consumer app does not expose Rooms, Skills, Workflows, AgentRuns, provider settings
or internal execution concepts.

The separate Masanawa Admin app is out of scope here.

---

# A. Global shell

## Bottom navigation

Exactly five primary destinations:

1. **For You**
2. **Live**
3. **Create** — visually prominent center action
4. **Activity**
5. **You**

Create opens the Talk composer rather than requiring a persistent blank tab.

## Global private Gwani

A small Gwani affordance is reachable from every normal screen. It opens a private
assistant sheet that can expand full-screen when needed.

Examples:
- “Start a Talk about football.”
- “Find an economist.”
- “Buy me data.”
- “Convert my USDT.”
- “Explain this.”
- “Help me prepare for my Talk.”

Gwani is not another bottom-navigation destination.

## Global wallet entry

A compact balance/wallet entry may appear in You and relevant purchase contexts. Do not
place wallet clutter in every header.

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

### S10 — For You

Primary app home.

Vertical/simple feed mixing:
- Live Talks;
- strong replays;
- followed creators;
- relevant topics.

Cards are compact and audio-first.

Primary action: **Listen**.

### S11 — Live

Intentional browsing of Talks happening now.

Compact filters/chips:
- Trending
- Following
- topics/categories

No Room directory.

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
- spendable Masanawa balance/credits if used;
- creator earnings;
- crypto assets.

### S70 — Wallet

Overview:
- spendable balance;
- creator earnings available/pending;
- Add funds;
- Withdraw eligible earnings;
- Services;
- Transaction history.

Crypto is linked as a service/asset area rather than merged into a fiat/credit number.

### S71 — Add funds

Amount + supported funding method + confirmation.

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

1. **Bills**
2. **Crypto**

This page is reachable from You/Wallet and can also be opened by Gwani.

No Research, Teaching, News, Story, Work or “AI tools” cards.

---

# K. Billing

Billing is private even when launched while the user is listening to a Talk.

### S81 — Bills

Compact actions:
- Airtime
- Data
- Electricity
- TV

Recent/favorite recipients may appear below if safely implemented.

### S82 — Bill purchase

One adaptive screen changes fields by product:
- recipient/phone/account/meter;
- network/provider;
- plan/package where required;
- amount;
- voice-friendly option selection.

### S83 — Bill confirmation

Exact recipient/product/amount/fees, then explicit Confirm.

Prefer a confirmation sheet when possible rather than a full route.

### S84 — Bill receipt/status

Success / pending-checking / failed / refunded with provider-safe receipt details.

---

# L. Crypto

### S90 — Crypto

Portfolio/service home:
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

Eligible fiat/on-ramp flow with exact quote and provider constraints.

### S95 — Convert

From asset -> to asset -> amount -> quote -> confirm.

### S96 — Withdraw

Asset/network -> address -> amount -> fees/minimum -> confirm.

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

High-friction destructive confirmation with clear consequences.

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

- `/for-you`
- `/live`
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

1. For You
2. Talk — listener
3. Talk — Host
4. Create Talk
5. Add AI / Sponsor Seat sheet
6. Live
7. Person profile
8. Persona profile
9. Activity
10. You
11. My Twin + Direct Twin
12. Wallet + Services
13. Bills
14. Crypto
15. Onboarding/settings

Do not implement the new mobile shell until the first ten mockups prove the hierarchy is
clear and visually simple.
