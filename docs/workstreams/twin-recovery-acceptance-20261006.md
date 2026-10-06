# Twin retry/recovery acceptance — TWIN-106

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/twin-recovery-acceptance-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Task: TWIN-106 — crashes/retries must not duplicate money or sessions.

## Scope

This lane adds an isolated integration acceptance harness around the already-merged owner-access runtime recovery contract. It does not add a second workflow, reservation, trial, ledger or session runtime.

## Exact owned paths

- `tests/recovery/twin-owner-access-retry-acceptance.test.ts`
- `docs/workstreams/twin-recovery-acceptance-20261006.md`

## Excluded/shared paths

- PR #136 Gateway/mobile/router/chat/APK/production paths;
- Commerce model/repository/index and PostgreSQL persistence/migrations;
- Workflow/Event/Operation canonical state;
- production reservation/ledger/trial stores;
- production environment, credentials and physical-device testing.

## Dependencies

- merged `packages/commerce/src/owner-access.ts`;
- merged `packages/commerce/src/owner-access-runtime.ts`;
- production ports must satisfy their existing requestId-based replay-safety contract.

## Acceptance intent

Simulate a crash after a consequential economic effect succeeds but before owner-access state persistence succeeds, then retry the exact transition and prove:
- a paid settlement is attempted again with the same request/reservation identity but the replay-safe port applies the monetary effect only once;
- a trial completion replay consumes only one trial unit;
- the recovered request reaches one terminal completed session state rather than creating a second session;
- changed identities are not treated as the same replay.

State: CLAIMED / IMPLEMENTATION IN PROGRESS.

Last update: 2026-10-06.
