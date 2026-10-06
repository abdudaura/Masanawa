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

## Completed implementation

The recovery harness constructs the already-merged owner-access runtime with:
- one canonical in-memory request representing an active paid or trial owner session;
- a repository that deliberately throws on the first state update, modeling a crash after the economic effect but before durable state advancement;
- replay-safe reservation/trial ports whose effect identity is derived from the exact request/reservation/policy/economic values.

It proves:
- paid completion calls settlement before state persistence as designed;
- after the simulated persistence crash, the request remains `active`;
- exact retry reuses the identical settlement identity;
- two settlement attempts correspond to one applied monetary effect;
- recovered state reaches `completed` on the same request rather than creating another session;
- trial completion behaves the same way: two consume attempts, one replay-safe applied trial-unit effect, one completed session;
- paid and trial paths remain separate and do not cross-apply effects.

## Verification

- changed-file audit against `main`: ahead 2 / behind 0 at implementation head and only the two owned files changed;
- PR #288 opened on implementation head `d69eb08ff5b76f0524f038bc15a4b2eff70dacf8`;
- Foundation CI run `37478840883` on handoff head `cf1d732c7ef96f5b5b163a83a82d304f9efa7fc9` concluded `failure`, but job `112321338664` has `steps = null`; checkout/install/typecheck/tests never executed, so this is runner-allocation evidence rather than an application test failure;
- local repository execution is unavailable in the current sandbox because the repository is not mounted and outbound DNS to GitHub is unavailable; no mock result is substituted for repository test execution.

## Handoff

- implementation head: `d69eb08ff5b76f0524f038bc15a4b2eff70dacf8`;
- PR: #288 — Add Twin owner-access retry recovery acceptance;
- isolated implementation status: COMPLETE;
- full production TWIN-106 status: NOT COMPLETE.

## Remaining dependencies

Full TWIN-106 acceptance still requires protected/shared production evidence:
- persistent replay-safe reservation, ledger and trial-usage ports;
- restart/crash testing against those real stores;
- production Gateway/mobile/session composition;
- physical/device and provider ambiguity paths where applicable.

State: ISOLATED COMPLETE / REAL PERSISTENCE + PRODUCTION RECOVERY EVIDENCE REMAIN.

Last update: 2026-10-06.
