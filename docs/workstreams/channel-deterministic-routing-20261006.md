# Deterministic channel routing — Task 098 — 2026-10-06

Status: active isolated Gateway-domain routing slice
Owner/window: ChatGPT continuation window
Branch: `work/channel-deterministic-routing-20261006`
Base: current `main` `8648c5f524108d825fa52e3a7f735675dd8b78f7`

## Task

Production Master Task 098 — deterministic Tenant/User/Relationship/Character routing.

## Why this lane is safe

- PR #136 owns shared Gateway composition, router, mobile/APK and production wiring.
- PR #92 owns the messaging channel adapter.
- PR #231/#307/#308 own channel binding/linking/identity-domain slices.
- This lane adds only a new pure Gateway routing module + focused tests/docs.
- It does **not** edit `services/gateway/src/app.ts`, `main.ts`, routes, migrations,
  production env or mobile code.

## Exact owned paths

- `services/gateway/src/channel-routing.ts` (new)
- `services/gateway/src/channel-routing.test.ts` (new)
- `docs/CHANNEL-DETERMINISTIC-ROUTING.md` (new)
- `docs/workstreams/channel-deterministic-routing-20261006.md`

## Goal

Given an already proof-resolved canonical Tenant/User:
1. choose the deterministic platform Character from explicit user preference when valid;
2. otherwise choose exactly one configured default-for-new-users support Character;
3. fail closed for ambiguous/missing/mismatched profile state;
4. reuse/provision the canonical User↔Character Relationship through Identity;
5. return only canonical Tenant/User/Character/Relationship routing scope.

No channel provider id, phone number, Telegram id or webhook payload may choose Character
or Relationship directly.
