# Twin economy abuse/security controls workstream

Owner/window: current ChatGPT implementation window
Branch: `work/twin-economy-abuse-controls-20261005`
Base SHA: `c00de8cf7845c3a4caa39f088539c547e6a76b87`
Tasks: TWIN-090, TWIN-091, TWIN-092, TWIN-094, partial TWIN-095

## Scope

Implement additive, reusable economy-abuse policy logic without touching active Commerce,
billing, crypto, shared Gateway composition or mobile router files.

## Owned paths

- new `packages/security/src/twin-economy-*.ts`
- narrow export additions to `packages/security/src/index.ts`
- new `services/gateway/src/twin_economy_guard*.ts`
- new `apps/mobile/lib/src/safety/twin_safety*.dart`
- new `apps/mobile/lib/src/screens/chat/components/twin_safety*.dart`
- focused mobile tests
- `test/architecture/twin-product-simplicity.test.ts`
- focused tests
- this claim file

## Explicitly not owned

- Commerce repositories/migrations/ledger posting
- billing/crypto code
- public twin profile/memory work
- shared Gateway app/main composition
- mobile router/chat integration

## Controls

- reject self-attribution/self-gift/self-transfer where policy requires;
- detect obvious circular transfer/gift farming;
- configurable per-operation amount/rate limits;
- pending/chargeback-aware earning withdrawal holds;
- block/report/discoverability policy contract;
- launch-age/identity policy seam without embedding legal guesses in UI.

Status: isolated abuse/security policy implementation complete; feature integration pending.

Implemented:
- configurable per-operation amount/hour/day guard policy;
- self-transfer rejection;
- self-gift rejection;
- self-attribution rejection for funding/purchase commission;
- direct return-loop, three-user short-cycle and repeated-pair detection;
- chargeback/refund-aware earning withdrawal holds;
- account restriction handling;
- block/suspension/discoverability/owner-access safety decisions;
- normalized twin report reasons without pretending report == moderation outcome;
- launch eligibility seam that preserves basic use while gating withdrawal/owner access;
- isolated Gateway preflight service combining active policy + recent operation counts;
- Security package exports;
- focused tests.

Also implemented:
- mobile safety transport/state;
- Block / Unblock action sheet;
- bounded Report flow with explicit reasons;
- isolated Gateway block/unblock/report service and routes;
- report submission never implies automatic guilt/moderation outcome.

Not yet integrated:
- policy persistence/admin configuration;
- real transfer/gift/attribution history adapter;
- actual block/report repository;
- Commerce command admission hooks;
- withdrawal admission hook;
- Explore/chat filtering;
- moderation pipeline and operator review;
- age/identity source adapter.

CI:
Foundation CI run 37289723507 failed before execution with zero job steps; no test result
is claimed from that runner.


Architecture protection:
- added twin-product-simplicity architecture test;
- forbids parallel wallet/marketplace/social-feed/twin-runtime canonical packages;
- forbids equivalent standalone services;
- asserts Commerce/Agents/Identity/Memory/Security remain the shared foundations.

This partially implements TWIN-004 and should be extended, not replaced, by future
integration work.


Owner-session privacy:
- recording is disabled by default;
- if enabled by policy, requester and owner consent are both required;
- recording retention is bounded by policy;
- this implements the core TWIN-096 privacy rule without assuming recordings are needed.
