# Masanawa Twin Transformation Integration Matrix

Status: live integration map, 2026-10-05.
Main baseline when created: `b27554f1f953d96d5e7d44727cd4f8fef170009f`.

This document tells integration windows which feature PR supplies each isolated contract
and what still must be wired into production. It does not transfer ownership away from
active workstreams.

## Shared production dependencies still active

| PR | Workstream | Why integration must coordinate |
| --- | --- | --- |
| #133 | production crypto integration | owns crypto repository/provider/runtime paths |
| #134 | customer billing integration | owns billing Commerce + Gateway + mobile shared paths |
| #136 | production Gateway/APK readiness | owns Gateway app/main, mobile router/chat/settings and production wiring |

Until those shared owners merge/transfer paths, twin feature PRs should stay additive.

## Twin feature PRs

| PR | Capability | Ready? | Shared integration still required |
| --- | --- | --- | --- |
| #138 | Activity | yes | event reader, Gateway composition, mobile transport/router |
| #139 | paid twin voice + configurable trials | yes | persistence, live-token gate, usage evidence, ledger posting, chat wiring |
| #141 | paid real-owner access | yes | persistence, reservation adapter, timers, evidence, notifications, chat wiring |
| #142 | public Explore backend | draft | profile/discovery persistence + Gateway composition |
| #145 | My Twin mobile | yes | profile transport, onboarding migration, router/share action |
| #146 | Explore mobile | yes | directory transport + router/deep link |
| #147 | Wallet mobile | yes | Wallet transport, transfer/gift endpoints, billing/crypto callbacks |
| #148 | public Twin profile + representational memory | draft | identity/memory persistence/integration |
| #149 | twin-economy abuse/safety controls | yes | feature guard adapters and production limits |
| #150 | Credits transfers + gifts | yes | ledger persistence/idempotency, recipient resolver, Wallet/Activity wiring |
| #152 | originating-twin attribution + commission | yes | funding/purchase hooks, persistence, ledger posting, reversal hooks |
| #155 | Wallet backend projection | yes | history readers, Gateway composition, authenticated mobile transport |
| #157 | twin-economy events | yes | package export, outbox/persistence, emitters, Activity/Wallet readers |
| #159 | free text / admitted voice rule | yes | existing chat runtime + voice token integration |
| #161 | AI-twin vs human-owner chat UI | yes | existing ai_chat integration + real-owner presence events |

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
1. Reconcile #148 public Twin profile/memory.
2. Reconcile #142 Explore backend.
3. Integrate #145 My Twin and #146 Explore mobile.
4. Add public link/deep-link route.
5. Confirm free text path invokes #159 admission rule.

### Phase 2 — Events and projections
1. Integrate #157 event vocabulary into events exports/outbox.
2. Feed #138 Activity from event reader.
3. Feed #155 Wallet history from event reader plus canonical funding/transfer/withdrawal sources.
4. Wire #147 Activity/Wallet tabs into mobile shell only after shared router ownership is transferred.

### Phase 3 — Credits/gifts/commission
1. Reconcile #149 abuse guards.
2. Add append-only persistence for #150 transfer/gift commands and receipts.
3. Wire transfer/gift guard adapters.
4. Add #152 attribution persistence and admin commission policy store.
5. Hook real external funding and eligible billing purchases to attribution.
6. Post commission ledger entries only after canonical provider success.
7. Emit #157 events and expose them through Activity/Wallet.

### Phase 4 — Paid voice
1. Persist trial-policy revisions from #139.
2. Persist paid-voice quotes/admissions.
3. Gate existing Live token minting through #159 + valid #139 admission.
4. Capture server/provider usage evidence.
5. Settle verified usage through canonical Commerce.
6. Emit voice completion/refund/earning events.
7. Integrate paid voice quote sheet into existing chat.

### Phase 5 — Paid real-owner access
1. Persist owner offerings + request state from #141.
2. Connect canonical Commerce reservation/release/settlement adapter.
3. Add expiry/no-show timers using existing scheduling primitives.
4. Connect verified in-app/provider attendance evidence.
5. Connect notifications.
6. Emit owner-access events.
7. Integrate Request Owner / manage/status sheets into chat and My Twin.

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
