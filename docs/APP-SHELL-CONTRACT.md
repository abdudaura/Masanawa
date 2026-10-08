# App Shell Contract

Status: **canonical consumer shell — 2026-10-08; latest user-approved navigation**
Supersedes the previous Create/Activity/You bottom-navigation arrangement.

## Bottom navigation
Exactly four destinations: **Home · Agents · Wallet · Talk**.
Use **Talk**, never “Talk to AI”, as the private assistant tab label.
A public Talk and private Talk tab have explicit mode labels within their respective
screens; this tab never starts a public broadcast or silently enables the microphone.

- Home: Explore and Live Talks, each a single vertical column of full-width cards.
- Agents: two tabs, **Masanawa Agents** and **Twins**, with compact searchable profiles,
  role/type/availability and private Talk/Type actions. Public paid Add/Sponsor Seat is
  a separate explicit confirmed action; browsing/chatting does not purchase a Seat.
- Wallet: separate native fiat, Credits, pending/available earnings and asset/network
  crypto balances; immediate history plus voice-first financial assistance.
- Talk: private Gwani/Gwana voice-first workspace, with Type instead and deliberate
  microphone start. Continue the same private task when entering from a service shortcut.

## Header and creation
Header right: Activity/notification bell beside profile avatar.
Bell opens the existing Activity screen with useful unread state and accessible label.
Avatar opens the upgraded You/profile hub and Settings. A three-dot menu, if needed,
contains contextual actions only; do not duplicate Profile/Activity/Settings everywhere.
Both are reachable on normal root screens; immersive Talk may use a compact overflow.
Provide a default avatar, loading/error handling, back-navigation and restored tab state.

A green **Start Talk** FAB opens the public Talk composer. It does not instantly broadcast.
Avoid covering cards, bottom navigation, microphone controls or keyboard. Show on appropriate
root surfaces; hide during immersive public audio or active private transaction/recording.
Use one composer and existing human Host, free human Seat and paid AI Seat authority.

## Wallet service ordering and handoff
Show **Crypto** first (Buy/Deposit/Convert/Withdraw), then **Data bundles**, **Airtime**,
**Electricity**, and **TV / Cable**, followed by supported funding/send/withdraw and history.
Eligibility depends on actual market/provider/account capability; no fabricated global rails.
These are shortcuts for the two Billing/Crypto families, not extra root service products.

Selecting a shortcut opens the private assistant with that validated intent selected.
Do not ask which service the user already selected; ask only missing details. Selection
never pays, authorizes a withdrawal, enables the microphone or publishes private speech.
Preserve balance/task state and return navigation. Read-only balances/history work without AI.

## Profile completeness
Header profile is a fully editable hub, not a read-only identity card.
Upload/replace/crop/remove photo; edit display name, handle and bio; validate clearly,
show upload/save/retry states and retain changes across restart and cross-device refresh.
Public profile, Talk stage, comments and Twin owner presentation converge on canonical
saved identity. Default avatar works after removal. See R18 in MOBILE-READINESS-PLAN.md.

## Existing boundaries
No Rooms/Skills/Workflows/provider internals as consumer destinations. Retain human-led
public Talks, private assistant isolation, compact sheets, white surfaces and vibrant
green. Root Agents is a supported discovery surface, not a replacement for Home Talks.
Financial flows follow VOICE-FIRST-INTERACTIONS.md, with spoken terms and silent parity.
Profile carries account, language, privacy, support and deletion; no fifth root tab.

## Route continuity
Keep existing deep links for Activity/You/Profile/Create/Talk/Wallet/services/Settings.
Add or reuse an Agents root and private assistant route as implementation requires.
Do not confuse a private assistant route with /talk/:talkId public participation.
Changing navigation must not break notification, receipt or invitation links.

Acceptance: all four destinations, header actions, FAB, both agent tabs and every
advertised profile/service action work after login, restart, permissions failure and
back navigation. Record implementation/build/deployment/device evidence separately.
