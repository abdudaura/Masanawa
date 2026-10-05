# Masanawa Twin Transformation Integration Matrix

Status: live integration map, 2026-10-05.
Main baseline when created: `b27554f1f953d96d5e7d44727cd4f8fef170009f`.

This document tells integration windows which feature PR supplies each isolated contract
and what still must be wired into production. It does not transfer ownership away from
active workstreams.

## Shared production dependencies still active

| PR | Workstream | Current status | Why integration must coordinate |
| --- | --- | --- | --- |
| #133 | production crypto integration | open | owns crypto repository/provider/runtime paths |
| #134 | customer billing integration | closed / superseded | billing work was reconciled into #136; do not revive this stale branch |
| #136 | production Gateway/APK readiness | open | owns Gateway app/main, mobile router/chat/settings and production wiring |

All isolated Twin feature PRs listed below are now merged to `main`. Until #133 and
#136 merge or explicitly transfer ownership, the remaining Twin work is shared
integration/persistence/production qualification, not another parallel feature lane.

## Twin feature PRs

| PR | Capability | Main status | Shared integration still required |
| --- | --- | --- | --- |
| #138 | Activity | merged `cad1f2d` | event reader, Gateway composition, mobile transport/router |
| #139 | paid twin voice + configurable trials | merged `d6f2ee0` | persistence, live-token gate, usage evidence, ledger posting, chat wiring |
| #141 | paid real-owner access | merged `42495f8` | persistence, reservation adapter, timers, evidence, notifications, chat wiring |
| #142 | public Explore backend | merged `289659f` | profile/discovery persistence + Gateway composition |
| #145 | My Twin mobile | merged `f5f5cf5` | profile transport, onboarding migration, router/share action |
| #146 | Explore mobile | merged `16e1126` | directory transport + router/deep link |
| #147 | Wallet mobile | merged `fa40f67` | Wallet transport, transfer/gift endpoints, billing/crypto callbacks |
| #148 | public Twin profile + representational memory | merged `965008c` | identity/memory persistence/integration |
| #149 | twin-economy abuse/safety controls | merged `d68789b` | feature guard adapters and production limits |
| #150 | Credits transfers + gifts | merged `b927ada` | ledger persistence/idempotency, recipient resolver, Wallet/Activity wiring |
| #152 | originating-twin attribution + commission | merged `dd2f970` | funding/purchase hooks, persistence, ledger posting, reversal hooks |
| #155 | Wallet backend projection | merged `52e3728` | history readers, Gateway composition, authenticated mobile transport |
| #157 | twin-economy events | merged `8e5eb8e` | package export, outbox/persistence, emitters, Activity/Wallet readers |
| #159 | free text / admitted voice rule | merged `fcb3169` | existing chat runtime + voice token integration |
| #161 | AI-twin vs human-owner chat UI | merged `ea3e106` | existing ai_chat integration + real-owner presence events |
| #171 | My Twin backend projection | merged `5575889` | source adapters, Gateway composition, authenticated mobile transport |

## Verification evidence

The following isolated TypeScript modules have passed local strict compile checks using
`tsc --strict --noEmit` despite the repository GitHub Actions runner currently failing
before job steps execute:

- Credits transfer/gift domain modules (#150);
- attribution/commission domain module (#152);
- free-text/paid-voice admission module (#159);
- paid-feature trial, twin voice quote and twin voice settlement modules (#139);
- owner-access policy, offering and attendance-evidence modules (#141).

The architecture regression guard from PR #156 was locally tested with Node's test
runner: 5 passed, 0 failed, and has already merged to `main`.

Flutter/Dart is not installed in the current execution environment, so mobile compile
verification still belongs to the active APK/CI workstream.

## Canonical integration order

Do not integrate all files in one undifferentiated merge.

### Phase 1 — Identity/discovery base
Merged foundations: #148 profile/memory, #142 Explore backend, #145 My Twin mobile,
#146 Explore mobile, #159 admission rule and #171 My Twin backend projection.

Remaining shared-owner work:
1. compose profile and Explore services through the existing Gateway;
2. bind authenticated mobile transports;
3. add public link/deep-link -> Twin conversation;
4. invoke #159 admission from the existing chat/Live runtime;
5. preserve the existing Character/Relationship identity when adopting legacy clones.

### Phase 2 — Events and projections
Merged foundations: #157 event vocabulary, #138 Activity, #155 Wallet projection and
#147 Wallet mobile.

Remaining shared-owner work:
1. export/persist #157 through the canonical events/outbox path;
2. feed #138 Activity from the durable event reader;
3. feed #155 Wallet history from event + canonical funding/transfer/withdrawal sources;
4. bind authenticated transports and wire Activity/Wallet into the root shell.

### Phase 3 — Credits/gifts/commission
Merged foundations: #149 abuse guards, #150 transfers/gifts and #152
attribution/commission.

Remaining shared-owner work:
1. add append-only persistence for transfer/gift commands and receipts;
2. wire abuse guards into the financial commands;
3. persist attribution and configurable commission policy;
4. hook real external funding and eligible billing/crypto purchases to attribution;
5. post commission only after canonical provider success and reverse it on qualifying reversal;
6. emit durable events and expose them through Activity/Wallet.

### Phase 4 — Paid voice
Merged foundations: #139 trial/voice contracts + UI and #159 admission.

Remaining shared-owner work:
1. persist trial-policy revisions and paid-voice quotes/admissions;
2. gate existing Live token minting through #159 + valid #139 admission;
3. capture server/provider usage evidence;
4. settle verified usage through canonical Commerce;
5. emit voice completion/refund/earning events;
6. integrate the paid-voice quote sheet into existing chat.

### Phase 5 — Paid real-owner access
Merged foundation: #141 owner access contracts/runtime/UI.

Remaining shared-owner work:
1. persist owner offerings + request state;
2. connect canonical Commerce reservation/release/settlement;
3. add expiry/no-show timers using existing scheduling primitives;
4. connect verified attendance evidence and notifications;
5. emit owner-access events;
6. integrate Request Owner / manage/status sheets into chat and My Twin.

### Phase 6 — Mobile simplification
After active APK/billing/crypto ownership is reconciled:
- switch root navigation to My Twin / Explore / Activity / Wallet;
- remove creator economy / Agent Float prominence from Settings;
- remove ordinary Skill-management entry points;
- keep billing/crypto as Wallet/chat capabilities;
- add #161 identity banner + compact actions sheet to chat.

## Shared files — single-owner integration only

Do not have multiple windows edit these simultaneously:

- `services/gateway/src/app.ts`
- `services/gateway/src/main.ts`
- `apps/mobile/lib/src/router/app_router.dart`
- `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`
- `apps/mobile/lib/src/agents/masanawa_transport.dart`
- `packages/commerce/src/index.ts`
- `packages/commerce/src/model.ts`
- `packages/commerce/src/repository.ts`
- PostgreSQL Commerce repository implementation
- Commerce migration numbering
- `packages/events/src/index.ts`
- production environment/deployment configuration

## Integration acceptance

The integration window is not complete until these end-to-end paths work:

1. Create Twin -> share link -> another user opens -> free text works.
2. Voice trial quote -> admitted voice -> zero charge during trial.
3. Voice after trial -> verified usage -> charge + creator share.
4. Buy a real Masanawa service through a Twin -> provider succeeds -> owner gets configured commission.
5. Send Credits -> value moves exactly once -> no commission.
6. Gift Twin owner -> gift receipt -> no acquisition commission.
7. Request real owner -> reserve -> accept/schedule -> verified session -> settle.
8. Decline/expire owner request -> full qualifying refund.
9. Activity reflects events without exposing private transcripts.
10. Wallet shows simple balances/history without Agent Float.
11. AI Twin identity is visibly distinct from real-owner presence.
12. Restart/retry never duplicates money, commissions, reservations or sessions.
