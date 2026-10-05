# Masanawa Twin Transformation Integration Matrix

Status: live integration map, 2026-10-05.
Main baseline when created: `b27554f1f953d96d5e7d44727cd4f8fef170009f`.

This document tells integration windows which feature PR supplies each isolated contract
and what still must be wired into production. It does not transfer ownership away from
active workstreams.

## Shared production dependencies still active

| PR | Workstream | Current status | Why integration must coordinate |
| --- | --- | --- | --- |
| #126 | legacy billing hardening | open | do not overlap provider/billing-storage paths while it remains open; #136 owns current shared Twin/Gateway/mobile integration |
| #133 | production crypto integration | closed / superseded | its required production crypto line was reconciled into #136; do not revive the branch |
| #134 | customer billing integration | closed / superseded | billing work was reconciled into #136; do not revive this stale branch |
| #136 | production Gateway/APK readiness | open | single owner for shared Twin Gateway/mobile composition and production qualification |

All isolated Twin feature PRs listed below are now merged to `main`. The remaining Twin
work belongs to #136 unless a path is still explicitly owned by an active provider
workstream such as #126. Do not start another parallel Twin feature lane.

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

Current #136 implementation:
1. profile, Explore and My Twin are composed through the existing Gateway;
2. authenticated mobile transports are bound to the production platform session;
3. canonical HTTPS Twin share links and Android/app deep links resolve through the
   privacy-aware directory before opening chat;
4. free public text and paid-voice admission are integrated with the existing chat/Live
   runtime.

Remaining work is qualification plus any explicit legacy-clone identity adoption needed
by real production data; do not create replacement Character/Relationship identities.

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

Current #136 implementation:
1. Credit transfer/gift commands and receipts use durable replay-safe persistence;
2. abuse/circular-value guards are composed into the financial commands;
3. attribution and configurable commission policy are persisted;
4. commission settlement/reversal uses stable ledger plans and crash-safe replay;
5. durable Twin economy events feed Activity/Wallet.

Still unresolved: real Flutterwave/NOWPayments provider amounts cannot be passed directly
to the Credit-denominated commission engine. Canonical Commerce explicitly states NGN
billing amounts are not AI Credits, and the product docs keep fiat/crypto principal
separate from Credits/earnings. No approved NGN/crypto -> commission-Credit valuation
contract exists. Therefore provider-success attribution/commission hooks must remain
disabled/unwired until an explicit commercial valuation policy is introduced; never
invent an exchange rate in Gateway code.

### Phase 4 — Paid voice
Merged foundations: #139 trial/voice contracts + UI and #159 admission.

Current #136 implementation:
1. trial-policy revisions, quotes and admissions are durable;
2. personal-Twin Live token minting requires a valid admission;
3. token minting no longer starts billing: the mobile Live session waits for Gemini
   `setupComplete` plus microphone streaming, then sends an authenticated media-start
   signal and the server records the start timestamp;
4. settlement duration is server-timed, capped to the accepted quote duration and cannot
   exceed the reserved spend cap;
5. paid no-media/interrupted paths refund unused reservation, trial no-media consumes no
   units, and stable ledger plans make settlement replay-safe;
6. completion/refund/earning events and the quote/consent chat UI are wired.

Remaining work is compile/device/production qualification. The current Gemini direct-live
path does not expose an independent provider usage callback, so the evidence boundary is
an authenticated connected-media signal plus server timestamps rather than a claimed
provider metering feed.

### Phase 5 — Paid real-owner access
Merged foundation: #141 owner access contracts/runtime/UI.

Current #136 implementation:
1. owner offerings, quotes and requests are durable;
2. paid reservations are ledger-first, replay-safe and settle/refund through canonical
   Commerce;
3. request expiry and scheduled no-show state/refunds are implemented when lifecycle
   state is evaluated;
4. owner/requester FCM notifications reuse the existing mobile-push registration/sender;
5. owner-access events feed Activity with durable request references and latest-status
   deduplication;
6. Activity lets owners accept/decline/schedule/start/complete; chat lets requesters
   resume/cancel the latest durable request after restart;
7. Human Access configuration now lives in My Twin rather than legacy creator Settings.

Still required: proactive expiry/no-show sweeping (rather than relying only on reads),
stronger human attendance evidence if a real person-to-person media/session primitive is
available, dispute/reconciliation policy, and production/device qualification.

### Phase 6 — Mobile simplification
Current #136 implementation:
- root navigation is My Twin / Explore / Activity / Wallet;
- Creator economy, Agent Float and ordinary Skill-management controls are removed from
  customer Settings;
- Twin discovery and Human Access controls live under My Twin;
- billing/crypto remain Wallet capabilities;
- chat keeps the explicit AI-Twin identity and compact Twin actions while dead legacy
  Agents/video header controls were removed.

Remaining work is responsive/accessibility/low-end Android qualification and any cleanup
found by the exact-head Flutter analyzer/device run.

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
