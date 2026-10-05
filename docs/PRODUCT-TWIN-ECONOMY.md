# Masanawa Digital Twin Economy

Status: canonical product overlay, approved direction 2026-10-05.

This document simplifies Masanawa's user-facing product. It does not delete canonical
runtime, security, workflow, commerce, memory, billing or provider machinery. Those
systems remain implementation detail unless a user genuinely needs to see them.

## Product in one sentence

Masanawa gives each user one personal digital twin that other people can talk to for
free by text, pay to interact with by voice, buy Masanawa products/services through,
gift, and use to request a paid conversation with the real owner.

The twin is the user's presence on Masanawa. Masanawa supplies the shared AI engine,
Skills, commerce and safety infrastructure. The user supplies identity, personality,
knowledge, preferences and promotion.

## Simplicity rules

1. One Masanawa engine; do not build a separate runtime per twin.
2. One personal twin per ordinary user.
3. Text chat with public twins is free.
4. Voice notes/live AI voice are paid usage surfaces.
5. A visitor may request paid access to the human owner.
6. Masanawa products/services may be purchased from any twin conversation.
7. The originating twin receives configured attribution/commission on qualifying
   external inflow or real purchases.
8. Gifts/blessings may be sent to the owner through the twin.
9. Masanawa Credits may be transferred between users, but internal transfers do not
   generate acquisition commission.
10. Users customize their twin; they do not configure prompts, models, workflows,
    providers or Skill graphs.
11. No human social feed, posting system, likes or creator-content treadmill.
12. Internal concepts such as CharacterVersion, AgentRun, Workflow, reserve, provider
    routing and Agent Float stay hidden from ordinary users unless needed for support.

## What makes twins different

Twins share Masanawa's underlying intelligence and broadly available Skills. Their
differentiation comes from the owner:

- identity and presentation;
- languages and communication style;
- owner-supplied memories/knowledge;
- interests and expertise context;
- voice/appearance where enabled;
- boundaries and representational preferences;
- reputation and visitor relationships.

Do not market generic AI capability as scarce work unique to one twin.

## Owner customization

The primary customization interface is conversation with the owner's own twin.
The owner may teach it facts, preferences, style, interests, expertise and boundaries.

Low-risk descriptive memory may be learned naturally. Consequential changes such as
public claims, pricing, financial limits, sensitive disclosure or availability rules
require an explicit confirmation before becoming standing behavior.

Private owner memory and public/representational memory must remain separate.

## Public twin experience

A shareable twin route/profile is the main acquisition surface. Visitors can:

- text the twin for free;
- use paid voice/real-time voice when enabled;
- purchase eligible Masanawa products/services without leaving the conversation;
- gift/bless the owner;
- request a paid conversation with the owner;
- discover other relevant twins.

The twin must be clearly represented as the owner's AI twin, not falsely presented as
the human personally typing or speaking.

## Paid owner chat

A visitor may request a short text/voice/video session with the real owner if the owner
has enabled human access.

Canonical flow:

request -> quote/time window -> payment hold -> owner accepts -> scheduled session ->
verified attendance/completion -> settlement to owner.

If the owner declines, fails to accept within policy, or the qualifying session does
not occur, the held amount returns to the requester according to the published policy.

Human-session pricing may be owner-configurable within platform bounds. Masanawa owns
escrow/hold truth, expiry, refund, evidence and settlement.

## Economy

### Free
- twin text chat;
- discovery;
- basic twin creation/customization.

### Paid
- twin voice notes;
- live AI voice;
- paid human-owner sessions;
- Masanawa products/services;
- optional premium twin capabilities;
- gifts/blessings.

### Creator earnings
A twin owner may earn from:
- configured commission on qualifying external inflow attributed to the twin;
- configured commission on eligible product/service purchases through the twin;
- revenue share from paid twin voice usage;
- completed paid owner sessions;
- voluntary gifts/blessings.

Percentages are policy/configuration, not hard-coded product constants. The currently
discussed 1% acquisition commission is a proposed configurable default until explicitly
ratified in commercial configuration.

### Credit invariants

Masanawa Credits may be transferred user-to-user. Transfers move existing value only.
They do not create new commission, platform revenue or withdrawable earnings.

Self-funding, circular transfers, refunds, reversals, chargebacks and internal gift loops
must not manufacture commissions. Attribution must preserve the origin of external value.

Purchased/spendable Credits and withdrawable earnings remain distinct ledger truth even
if the normal UI presents a simple Wallet.

## Commerce attribution

Any eligible twin conversation can sell the same platform products: data, airtime,
electricity, supported crypto and future catalog items. The customer does not need a
special reseller flow.

The originating twin owns attribution. Fulfillment may be handled by Masanawa's shared
engine/provider infrastructure without pretending the twin uniquely performed the work.

## User-visible navigation

Keep the main app to four primary surfaces:

### 1. My Twin
- twin identity/profile;
- chat with and teach my twin;
- share link/QR;
- simple public/private availability;
- voice/human-access settings;
- concise performance summary.

Existing clone setup should be absorbed here after first creation.

### 2. Explore
- discover/search public twins;
- compact profile cards;
- open free text chat;
- no human-post feed.

Existing Character/agent lists should evolve into this surface.

### 3. Activity
- visits and conversations involving my twin;
- voice usage;
- purchases attributed to my twin;
- gifts;
- owner-chat requests/status;
- earnings events.

This is an event/activity view, not a social feed.

### 4. Wallet
- spendable Credits;
- add money;
- transfer Credits;
- available/pending earnings;
- withdraw earnings where eligible;
- purchases, commissions, voice revenue, gifts and owner-session settlements;
- billing/crypto entry points where appropriate.

Normal UI must not expose Agent Float as a primary concept. If execution reserves remain
necessary internally, manage them behind commerce policy and surface only actionable
funding problems.

### Secondary: Settings
Only account, privacy, notifications, security, language, help and advanced twin
preferences that do not belong on My Twin.

## Screen changes from current mobile app

### Keep and evolve
- `ai_chat_screen.dart`: becomes the universal twin conversation. Keep rich text/media
  behavior. Text with public twins is free. Add paid voice gating, gift, commerce and
  Request Owner actions without turning the composer into a dashboard.
- `clone_setup_screen.dart`: fold into **My Twin**. First-run creation remains short;
  afterward the owner customizes primarily by chatting with the twin.
- `masana_list_screen.dart` / current Character directory: evolve into **Explore**.
- `settings_screen.dart`: remove creator-economy/Agent-Float prominence; keep settings.

### Replace/merge
- current generic chat/agent list concepts should not expose platform/support Characters,
  personal clones and runtime classes as separate user mental models.
- creator economy cards should move into Wallet/Activity rather than Settings.

### New screens/surfaces
- **My Twin**
- **Explore**
- **Activity**
- **Wallet**
- **Owner Chat Request / booking sheet** (lightweight modal/sheet, not a permanent tab)
- **Gift/Send Credits sheet** (reusable transaction sheet)

Do not create separate top-level screens for Agent Float, Skill management, reseller
configuration, workflow management, provider selection or commission configuration.

## Backend capabilities required

Reuse existing canonical owners. Add only missing primitives:

1. public twin discovery/profile/share routes with privacy controls;
2. twin-attributed session/visitor identity;
3. configurable monetization policy for voice, acquisition and commerce attribution;
4. transferable Credits command with anti-loop provenance;
5. gift command/ledger reason;
6. paid voice metering and settlement;
7. owner-chat request, payment hold, acceptance, scheduling, attendance/completion,
   refund and settlement;
8. creator activity projection/analytics;
9. clear public-vs-private twin memory policy;
10. simple owner customization commands derived from conversation.

Do not build a new wallet, ledger, agent runtime, scheduler, Skill system, payment engine
or marketplace service for these features.

## Implementation order

1. Ratify this product overlay and update canonical docs.
2. Simplify information architecture/navigation and terminology.
3. Fold clone setup/customization into My Twin.
4. Build Explore + public share/deep link.
5. Build Wallet projection and Credit transfer.
6. Add attribution for real external funding and platform commerce.
7. Add gifts.
8. Add paid twin voice metering.
9. Add owner-chat escrow/request flow.
10. Add Activity projection and creator analytics.
11. Qualify abuse/fraud/refund/privacy paths and production economics.

Each step must preserve current production billing/crypto/auth work and reuse canonical
commerce/security/runtime contracts.

## Success test

A new user should be able to understand Masanawa in under one minute:

"Create your twin. Teach it about you. Share it. Anyone can text it free. People can pay
for voice, buy Masanawa services through it, gift you, or request a paid chat with you.
You earn when real value flows through your twin."

If a feature makes that explanation materially longer, it should probably stay internal
or be deferred.
