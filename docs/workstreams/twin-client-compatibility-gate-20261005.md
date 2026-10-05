# Twin client compatibility gate claim

Status: active
Owner/window: ChatGPT twin-transformation continuation
Branch: `work/twin-client-compatibility-gate-20261005`
Base: `2bdd99908d94cc39ada639af1f21ebbdccb6bfe2`
Task references: TWIN-086

## Exact owned paths

- `docs/workstreams/twin-client-compatibility-gate-20261005.md`
- `packages/contracts/src/twin-client-compatibility.ts`
- `packages/contracts/src/twin-client-compatibility.test.ts`

## Scope

Add a fail-closed, transport-neutral compatibility gate that decides whether an obsolete
Twin-era endpoint is eligible for retirement. No endpoint is removed by this branch.
The gate requires explicit replacement readiness, a supported-client build floor,
bounded recent compatibility evidence, an elapsed compatibility window and a rollback
route before retirement can be approved.

## Explicit non-ownership

This claim does not own:
- Gateway app/main/router composition or any existing endpoint implementation;
- mobile router/chat/settings/APK work;
- billing, crypto, Commerce, Wallet, Credits, gifts, commissions or migrations;
- package root exports;
- any active Twin feature PR path;
- deployment or production configuration.

## Acceptance

- retirement fails closed when replacement readiness is absent;
- retirement fails closed while supported clients may lack the replacement;
- retirement fails closed on stale or missing compatibility evidence;
- retirement fails closed before the compatibility window expires;
- retirement fails closed without rollback capability;
- unsupported-client share must be within the explicitly configured basis-point ceiling;
- decision is deterministic and carries machine-readable denial reasons;
- no route deletion or migration checksum change occurs.
