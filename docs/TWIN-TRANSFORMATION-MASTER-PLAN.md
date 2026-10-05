# Masanawa Twin Transformation Master Plan

Status: canonical execution plan, 2026-10-05.
Depends on: `docs/PRODUCT-TWIN-ECONOMY.md`.
Coordination: `docs/TWIN-MULTI-WINDOW-EXECUTION.md`.
Task ledger: `docs/TWIN-TRANSFORMATION-TASKS.md`.

## Goal

Transform the current technically rich Masanawa build into a simple consumer product
centered on one personal digital twin per user.

The transformation is primarily a product/UI/economy simplification. It must reuse
existing canonical identity, agent runtime, memory, Skills, Workflows, Commerce, billing,
crypto, security, provider and recovery systems rather than replacing them.

## Final user mental model

A normal user should understand only:

1. **My Twin** — create, teach, customize and share my digital twin.
2. **Explore** — discover and talk to other people's twins.
3. **Activity** — see what happened around my twin and what earned money.
4. **Wallet** — money/Credits, transfers, earnings, purchases and withdrawals.
5. **Settings** — account/privacy/security/help only.

Everything else is implementation detail.

## Final product rules

- One shared Masanawa AI engine and Skill system.
- One personal twin per ordinary User.
- The twin is clearly an AI representative of its owner.
- Public twin text chat is free.
- Twin voice notes/live AI voice are paid where enabled.
- Any eligible Masanawa product/service can be bought from any twin conversation.
- The originating twin receives deterministic configurable attribution on qualifying
  real money inflow or purchases.
- Gifts/blessings can be sent to twin owners.
- Credits can transfer between users without creating new commission.
- Visitors may pay to request a scheduled conversation with the real owner.
- Human-session funds are held until qualifying completion or returned under policy.
- Owners customize twins conversationally; no prompt/model/workflow/provider UI.
- No human social-media feed, posts, likes, reposts or engagement-farming system.
- No claim that one twin has scarce generic AI labor that other twins lack.

## Preserve

Do not discard these existing foundations:

- Character/User identity and one-clone custody;
- CharacterVersion and Relationship internals;
- AgentSession/AgentRun/runtime;
- Memory and provenance;
- Skills/Tools/Providers;
- durable Workflows and recovery;
- ShellDocument/action protocol;
- canonical Commerce ledger/settlement;
- Flutterwave billing;
- NOWPayments crypto;
- current auth/session model;
- rich WhatsApp-style chat;
- Gemini Live/native audio plumbing;
- audit, idempotency, reconciliation and approvals;
- WhatsApp/Telegram channel work;
- Ops/admin machinery.

They should become invisible infrastructure behind the simple product.

## Retire from ordinary user language

These terms must not be primary consumer concepts:

- Character;
- CharacterVersion;
- AgentRun;
- Workflow;
- SkillVersion;
- Provider;
- Agent Float;
- Fulfillment Reserve;
- execution executor;
- reseller configuration;
- support Character selection.

They may remain in operator/admin/debug surfaces.

## Current implementation -> target

| Current concept/surface | Target |
| --- | --- |
| clone setup in Settings | My Twin first-run setup + conversational customization |
| Character/agent directory | Explore twins |
| generic chat | universal twin conversation |
| creator economy inside Settings | Wallet + Activity |
| Agent Float | internal reserve policy; hidden from ordinary UI |
| creator Skill management | automatic/shared Skills; advanced policy only if later justified |
| Gwani/Gwana selection in Settings | platform help/internal support, not core user journey |
| billing screens/routes | commerce available in Wallet and twin conversations |
| crypto wallet | Wallet capability, not separate product identity |
| paid-work clone framing | attribution/commerce/voice/gifts/human-access economy |

## Required new domain/product capabilities

### Identity/profile
- public twin profile projection;
- unique share/deep-link identifier;
- discoverability/privacy status;
- representational profile fields;
- private-vs-public memory boundary;
- conversational owner customization with confirmation for consequential changes.

### Discovery
- public twin search/discovery;
- deterministic privacy filtering;
- recommendation may be added later, but search/recent/popular must work without opaque
  social ranking.

### Attribution
- originating twin/owner attached to qualifying visitor/funding/purchase flows;
- attribution expiry and replacement policy;
- self-attribution prevention;
- refund/reversal-safe commission reversal.

### Credits
- user-to-user transfer command;
- immutable source/provenance;
- no commission on internal movement;
- recipient notification/receipt;
- idempotency and reversal policy.

### Gifts
- explicit gift/blessing transaction reason;
- direct owner attribution;
- anti-self-gift and abuse policy;
- clear platform fee policy if any.

### Voice monetization
- price quote before paid voice;
- usage/metering;
- spend cap;
- settlement/reconciliation;
- no accidental paid voice from free text mode.

### Owner access
- owner availability/preferences;
- request;
- quote;
- payment hold;
- accept/decline/expire;
- scheduling;
- attendance/completion evidence;
- settlement or refund;
- dispute/reconciliation.

### Activity
- normalized creator activity projection for:
  visitors, conversations, voice usage, purchases, gifts, owner requests and earnings;
- privacy-safe summaries rather than raw private visitor conversations by default.

## Mobile information architecture

Primary bottom navigation:
`My Twin | Explore | Activity | Wallet`

Settings is reached from avatar/menu, not a fifth competing product tab.

A visitor entering a share link may land directly in that twin's conversation without
opening My Twin first.

## Minimal first release of the transformed product

Release candidate does not require every advanced idea. Minimum coherent release:

1. one-clone onboarding;
2. My Twin profile/customization/share;
3. Explore/public twin chat;
4. free text;
5. Wallet/funding/billing already supported by production providers;
6. deterministic twin attribution on qualifying commerce;
7. Credit transfer;
8. gifts;
9. paid twin voice;
10. paid owner-chat request/escrow;
11. Activity;
12. abuse/privacy/refund controls.

## Transformation strategy

Do not attempt a giant rewrite.

### Stage A — freeze product truth
Merge the canonical docs and multi-window plan.

### Stage B — contracts before shared UI
Implement isolated domain contracts/projections for discovery, transfers/gifts,
attribution, voice billing and owner access.

### Stage C — mobile shell simplification
Build My Twin, Explore, Activity and Wallet against stable contracts. Keep the existing
rich chat screen and add small contextual actions.

### Stage D — integration
A single integration owner updates shared Gateway composition, mobile router/navigation,
migration discovery and environment wiring.

### Stage E — production qualification
Run provider, finance, abuse, privacy, restart/recovery and APK/device acceptance.

## Non-goals

Do not build during this transformation:
- human posting/feed system;
- followers/likes/reposts;
- standalone marketplace service;
- another wallet/ledger;
- separate AI runtime per clone;
- clone-specific generic AI work marketplace;
- user-facing workflow builder;
- user-facing Skill graph;
- complex gamification;
- speculative token/crypto currency replacing Credits.

## Product acceptance sentence

A first-time user should be able to explain Masanawa after one minute:

> Create your twin, teach it about you and share it. People can text it free. They can
> pay for voice, buy Masanawa services through it, gift you, or request a paid chat
> with you. You earn when real value flows through your twin.

Any new consumer-facing feature that makes this materially harder to explain requires
explicit product approval.
