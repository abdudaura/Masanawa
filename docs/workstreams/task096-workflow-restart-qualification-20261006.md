# Task 096 workflow restart/no-duplicate-effect qualification

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/task096-workflow-restart-qualification-20261006`
Base SHA: `8648c5f524108d825fa52e3a7f735675dd8b78f7`
Production task: 096 — pass restart/no-duplicate-side-effect workflow acceptance suite.

## Scope

This lane implements an isolated evidence qualifier for Task 096. It does not edit active Workflow state machines, persistence, migrations, Worker/Gateway composition, Tool/Operation truth or provider adapters.

## Exact owned paths

- `docs/workstreams/task096-workflow-restart-qualification-20261006.md`
- `scripts/task096-workflow-qualification.mjs`
- `scripts/task096-workflow-qualification.test.mjs`

## Excluded/shared paths

- `packages/workflows/**` implementation and migrations;
- PostgreSQL Workflow repositories;
- canonical Tool/Operation/Provider implementation;
- Worker/Gateway/Ops/mobile composition;
- production environment, credentials and live queues;
- PR #136 paths and every active Workflow owner branch.

## Completed implementation

The qualifier requires production-like evidence for eight Task 096 scenario families:
- transactional admission/replay;
- lease/fencing crash recovery;
- checkpoint/restart compatibility;
- retry/dead-letter recovery;
- human approval restart;
- schedule/timer restart;
- cancellation/supersession recovery;
- ambiguous consequential Operation reconciliation.

For every scenario it:
- binds the exact Workflow Git head;
- binds the exact canonical Operation Git head;
- requires functional success;
- independently requires restart/recovery success;
- independently requires no-duplicate-consequential-effect success;
- requires SHA-256 evidence;
- rejects unknown or duplicate scenarios;
- rejects malformed or substituted source heads;
- fails when blocking recovery issues remain.

The result is only `READY`, `INCOMPLETE` or `FAILED`; missing evidence cannot silently pass. A CLI exits non-zero unless qualification is `READY`.

Focused tests cover:
- complete READY evidence;
- missing scenario classification;
- Workflow/Operation head substitution;
- independent restart and duplicate-effect safety failures;
- functional failure plus blocking recovery issues;
- duplicate scenarios, malformed hashes and non-production-like evidence.

## Verification

- comparison against `main` at implementation head: ahead 4 / behind 0;
- changed-file audit is exactly the three owned paths above;
- PR #300 opened on implementation head `a74c61b09d3257f3530bcacc868efb7ed627f5cc`;
- Foundation CI run `37490509838`, job `112361687457`, concluded `failure` with `steps = null`; checkout/install/typecheck/tests never executed, so no application failure or success is inferred.

## Handoff

- implementation head before this documentation update: `a74c61b09d3257f3530bcacc868efb7ed627f5cc`;
- PR: #300 — Add Task 096 workflow restart qualification gate;
- isolated implementation status: COMPLETE;
- Production Task 096 status: NOT COMPLETE.

## Remaining dependencies

Task 096 becomes READY only after the canonical Workflow/Operation owners provide production-like restart/crash/replay evidence on exact reconciled heads. Persistent stores, live worker recovery and provider ambiguity remain with their canonical owners.

State: ISOLATED COMPLETE / WAITING ON WORKFLOW + OPERATION PRODUCTION-LIKE EVIDENCE.

Last update: 2026-10-06.
