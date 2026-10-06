# Masanawa Home + Rooms Multi-Window Execution

Status: parallel execution map, 2026-10-06.
Canonical product overlay: `docs/HOME-ROOMS-LAUNCH.md`.

## Coordination rule

PR #136 / `work/production-apk-integration-20261005` remains the single owner of
shared production Gateway/mobile integration until explicitly handed off.

Parallel windows must avoid:
- `services/gateway/src/app.ts`
- `services/gateway/src/main.ts`
- `apps/mobile/lib/src/router/app_router.dart`
- `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`
- `apps/mobile/lib/src/agents/masanawa_transport.dart`
- shared Commerce/Event migrations and production environment files unless claimed.

Build isolated contracts/screens/adapters behind stable interfaces, then let the shared
integration lane compose them.

## Lane H — Home shell components

Own only new Home presentation/state/component paths where possible.

Deliver:
- Home screen visual composition;
- Gwani/Gwana peer cards;
- service-Room list;
- quick-service strip;
- My Twin card;
- recent/continue cards;
- responsive/loading/error/empty states.

Do not hard-code Character IDs or financial behavior.

Handoff: exact widgets/state models + integration instructions for router/transport owner.

## Lane I — Internet Cafe service model

Own new Room/catalog/flow contracts and Internet Cafe-specific UI components.

Deliver:
- Room definition;
- Internet Cafe service taxonomy;
- quick-start intents;
- server-projected service selections;
- document/application task intake structures;
- mappings to existing billing/Skill contracts.

Do not duplicate Flutterwave/Commerce provider truth.

## Lane B — Billing production qualification

Continue active billing ownership rather than forking it.

Deliver:
- live eligible Flutterwave catalog;
- Data/Airtime/Electricity/TV validation;
- quote/checkout/reconciliation;
- receipts/refunds/unknown outcome;
- production-enabled configuration only after qualification;
- real-purchase evidence.

Shared Gateway/mobile composition goes through #136.

## Lane T — Study Center integration

Continue Core Teaching PRs #94/#96.

Deliver:
- durable Teaching progress persistence;
- Gateway/runtime composition interface;
- Study Center projection components;
- voice/text parity;
- selectable/free-response actions;
- continuation.

Do not create a second teaching engine.

## Lane S — Story Radio

New isolated domain/presentation work.

Deliver:
- admin-owned Series/Season/Episode publication model;
- episode audio asset reference;
- ordering/next episode;
- published/unpublished state;
- listening-progress command/projection;
- bounded reactions;
- Story Radio mobile components;
- admin control-plane components where paths do not conflict.

No user story creation, comments or video tooling.

## Lane N — News

New isolated News projection/Room work.

Deliver:
- admin-configured category/pinning;
- source-aware news item contract;
- article/detail projection;
- evidence/source references;
- optional audio presentation reference;
- mobile components.

Do not build a social feed or allow model-generated unsourced current news.

## Lane W — Work & Research Rooms

Own Room definitions/components and reusable quick-start contracts.

Deliver:
- Work & Business quick starts;
- Research & Answers quick starts;
- work/progress/artifact projections using existing typed parts;
- evidence/source UI models.

Do not invent a second Workflow or research execution engine.

## Lane G — Group Rooms

Start after one-to-one routing contracts are stable.

Deliver:
- GroupRoom identity;
- explicit membership;
- participant roles;
- message attribution;
- Character/Twin participation bindings;
- memory/privacy rules;
- basic group conversation projection.

Do not touch one-to-one Relationship semantics directly without coordinated integration.

## Lane A — Admin publishing

Coordinate with PR #129.

Deliver admin controls for:
- Story Radio series/seasons/episodes/publish ordering;
- News categories/pinning/visibility;
- Home Room visibility/order;
- platform-assistant Home presentation.

Use canonical authorized commands; no direct database shortcuts.

## Lane P — Production integration + APK

Owner: PR #136 unless explicitly reassigned.

Deliver:
- router/navigation integration;
- production transport composition;
- Gwani/Gwana server resolution;
- universal chat entry;
- Room deep links;
- billing callbacks;
- Study/Story/News integrations;
- production environment;
- exact release APK build;
- install/device acceptance.

This lane must not reimplement isolated feature-domain logic.

## Merge/integration order

1. Docs overlay.
2. Home isolated components.
3. Internet Cafe contract/components.
4. Story Radio and News isolated contracts/components.
5. Study integration interfaces.
6. Billing provider qualification.
7. Admin publishing surfaces.
8. Shared production integration (#136).
9. Group Rooms.
10. Exact-head APK/device acceptance.

## Minimum launch acceptance

A release candidate is launchable only when a physical build proves:

1. sign in with OTP;
2. Home loads;
3. Gwana left/Gwani right render from server configuration;
4. text Gwani/Gwana;
5. record/send voice note and hear AI audio;
6. start live voice with both;
7. Data shortcut completes one real reconciled purchase;
8. Internet Cafe completes at least one additional bill family;
9. Study Center resumes a lesson;
10. Story Radio plays an episode, preserves progress and continues to next;
11. News loads sourced items and opens detail;
12. Wallet/Activity reflect relevant outcomes;
13. restart/retry does not duplicate purchases, charges or receipts.

Group Rooms may ship shortly after this minimum if they threaten launch stability.
