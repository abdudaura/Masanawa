# Masanawa Twin Transformation — Multi-Window Execution Map

Status: canonical coordination overlay, 2026-10-05.
All windows must also read `CONTINUE-HERE.md` and `docs/MULTI-WINDOW-WORK.md`.

## Rule

Do not start by editing shared integration files. Build isolated contracts/screens first,
then hand them to one integration window.

Each implementation window must publish its own claim under `docs/workstreams/` before
editing. The lanes below are proposed ownership boundaries, not pre-claimed locks.

## Lane A — Twin profile and memory

Tasks: TWIN-010..015.

Primary ownership:
- `packages/identity/**` for public twin profile/share/discoverability if Identity is
  selected as canonical owner;
- relevant identity PostgreSQL adapter files;
- narrowly scoped Memory policy/contracts for representational vs private memory;
- Gateway feature files dedicated to twin profile/customization, excluding shared
  `app.ts`/`main.ts`.

Do not own:
- Commerce;
- mobile router;
- global Gateway composition.

Deliver:
public profile/read/update contracts, privacy tests, customization command/service,
migration(s), integration handoff.

## Lane B — Explore/discovery

Tasks: TWIN-020..024.

Primary ownership:
- dedicated public twin directory/search service/projection;
- new Explore mobile files;
- twin directory mobile DTO/state files.

Avoid editing existing shared router and current agent directory until integration.
Can create new files and tests independently.

Dependency: Lane A public profile projection.

## Lane C — Wallet transfer and gifts

Tasks: TWIN-030..033, 038.

Primary ownership:
- `packages/commerce` transfer/gift model/service/repository ports;
- new append-only Commerce migration(s);
- Commerce PostgreSQL adapter implementation;
- dedicated Gateway transfer/gift route/service files;
- new Wallet/Send/Gift mobile files, but not shared router.

Must coordinate with active billing/crypto branches before touching overlapping Commerce
or Gateway files. If those branches still own the same paths, work only on contracts/docs
or explicitly transfer ownership.

## Lane D — Attribution and commission

Tasks: TWIN-034..037.

Primary ownership:
- Commerce attribution and monetization policy;
- settlement integration isolated where possible;
- tests for external funding/purchase attribution and reversals.

Dependencies:
active billing integration and canonical funding truth.

Do not invent a second referral ledger.

## Lane E — Paid twin voice

Tasks: TWIN-040..045.

Primary ownership:
- dedicated voice monetization contracts/service;
- server metering/evidence;
- paid-voice UI components/sheet;
- integration adapter around existing Live voice, without rewriting the Live transport.

Dependency:
current Gemini Live/native audio implementation and Commerce quote/settlement.

## Lane F — Paid owner access

Tasks: TWIN-050..058.

Primary ownership:
- owner-access domain model/service, preferably within Commerce for financial state with
  scheduling/status composition as a dedicated bounded feature;
- new migrations;
- dedicated Gateway routes;
- Request Owner mobile sheet/status components.

Avoid editing shared chat screen until integration.
Use canonical reservation/settlement and scheduling primitives.

## Lane G — Activity projection

Tasks: TWIN-060..063.

Primary ownership:
- read model/projection for creator-facing activity;
- Activity route;
- new Activity mobile files.

Dependencies: event contracts from C/D/E/F, but projection can be additive.

## Lane H — My Twin mobile

Tasks: TWIN-015, 070, 072-075.

Primary ownership:
- new My Twin screen/state/DTO;
- migration path from clone setup/economy/skills UI;
- settings simplification in a dedicated branch only after active onboarding ownership
  is reconciled.

Avoid `app_router.dart` until integration.

## Lane I — Shared integration

Tasks: TWIN-071, 080..086.

**Only one window should own this lane at a time.**

Shared ownership:
- `apps/mobile/lib/src/router/app_router.dart`;
- bottom-navigation/root shell;
- existing `ai_chat_screen.dart` when adding final Gift/Voice/Request Owner entry points;
- `services/gateway/src/app.ts`;
- `services/gateway/src/main.ts`;
- package root exports/workspace config if necessary;
- migration registry/discovery;
- production environment config;
- deprecation/compatibility wiring.

This lane starts after contracts from other lanes are stable enough to integrate.

## Lane J — Abuse/security/acceptance

Tasks: TWIN-090..109.

Primary ownership:
- security/abuse tests and policy enforcement not already owned by feature lanes;
- integration/e2e/recovery tests;
- deployment qualification;
- APK/device acceptance.

Production deployment remains single-owner.

## Files with high collision risk

Coordinate before touching:
- `services/gateway/src/app.ts`
- `services/gateway/src/main.ts`
- `apps/mobile/lib/src/router/app_router.dart`
- `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`
- `apps/mobile/lib/src/agents/masanawa_transport.dart`
- `packages/commerce/src/model.ts`
- `packages/commerce/src/repository.ts`
- `adapters/storage/postgres/src/commerce/repository.ts`
- Commerce migration numbering
- package root exports
- `config/production-env.json`

## Recommended parallel start

After product docs merge, safe initial parallelism:

1. Lane A — Twin profile/memory.
2. Lane B — Explore UI using provisional typed projection only if A contract is stable.
3. Lane E — voice monetization contract (not Live integration).
4. Lane F — owner-access contract/state machine.
5. Lane G — Activity projection schema.
6. Lane H — My Twin new screen only, avoiding shared onboarding/router files.

Lane C/D should wait for or explicitly reconcile the active billing/crypto Commerce work.

## Window prompt template

Use this template and replace the lane:

> Continue Baatiku/masanawa from current repository state. Read CONTINUE-HERE.md,
> docs/MULTI-WINDOW-WORK.md, docs/PRODUCT-TWIN-ECONOMY.md,
> docs/TWIN-TRANSFORMATION-MASTER-PLAN.md,
> docs/TWIN-TRANSFORMATION-TASKS.md and docs/TWIN-MULTI-WINDOW-EXECUTION.md first.
> Inspect active PRs/claims. Claim **Lane X** on an isolated branch with exact owned paths.
> Do not touch another lane's shared files or active billing/crypto/APK work. Implement
> the listed TWIN tasks end-to-end, run relevant checks, update the claim and leave a
> precise handoff. Do not stop at a plan.

## Integration prompt

> Take the Twin Transformation shared integration lane after inspecting all active
> claims and completed lane PRs. Reconcile current main plus billing/crypto/auth/onboarding
> changes. Own only the explicitly shared integration files. Compose the new twin profile,
> Explore, Wallet, Activity, paid voice, gifts/transfers and owner-access contracts into
> the existing Gateway/mobile shell without creating parallel engines. Run TypeScript,
> database, Flutter and end-to-end checks and leave production deployment to the current
> deployment owner unless explicitly transferred.
