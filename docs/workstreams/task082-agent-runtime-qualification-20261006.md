# Task 082 Agent runtime golden-journey qualification

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/task082-agent-runtime-qualification-20261006`
Base SHA: `8648c5f524108d825fa52e3a7f735675dd8b78f7`
Production task: 082 — pass agent-runtime golden journey and provider/model replacement tests.

## Scope

This lane implements an isolated evidence qualifier for Task 082. It does not edit AgentRun, AgentStrategy, context compilation, Skill selection, budgets, conversational/research/delegated strategies, cancellation, telemetry, Gateway/mobile or provider implementation.

## Exact owned paths

- `docs/workstreams/task082-agent-runtime-qualification-20261006.md`
- `scripts/task082-agent-runtime-qualification.mjs`
- `scripts/task082-agent-runtime-qualification.test.mjs`

## Excluded/shared paths

- PR #89 and `task073-strategy-boundary`;
- `packages/agents/**` implementation and migrations;
- Memory/World/Skills/Tools/Providers implementation;
- Gateway/Worker/Ops/mobile composition;
- PR #136 paths, production environment and credentials.

## Completed implementation

The qualifier requires production-like evidence for eight Task 082 scenario families:
- foreground conversation;
- research/multi-step execution;
- delegated specialist execution;
- exact budget enforcement;
- cancellation/supersession stale-result protection;
- AgentRun telemetry/operator diagnostics;
- provider replacement;
- model replacement.

For every scenario it:
- binds the exact Agent runtime Git head;
- binds the exact Provider/runtime integration Git head;
- requires functional success;
- independently requires authorization/lineage safety;
- independently requires deterministic terminal/replay behavior;
- requires SHA-256 evidence;
- rejects duplicate/unknown scenarios and malformed source heads;
- fails while blocking runtime issues remain.

The result is only `READY`, `INCOMPLETE` or `FAILED`; missing evidence cannot silently pass. A CLI exits non-zero unless qualification is `READY`.

Focused tests cover:
- complete READY evidence;
- missing-scenario INCOMPLETE behavior;
- runtime/provider source substitution;
- independent authorization/lineage and deterministic replay failures;
- functional failure plus blocking runtime issues;
- duplicate, malformed and non-production-like evidence rejection.

## Verification

- comparison against `main` at implementation head: ahead 3 / behind 0;
- changed-file audit is exactly the three owned paths above;
- PR #302 opened on implementation head `a50b28f3d5eeb1b06ee42b17393448ba90b5c05e`;
- Foundation CI run `37490910507`, job `112363079745`, concluded `failure` with `steps = null`; checkout/install/typecheck/tests never executed, so no application failure or success is inferred.

## Handoff

- implementation head before this documentation update: `a50b28f3d5eeb1b06ee42b17393448ba90b5c05e`;
- PR: #302 — Add Task 082 agent runtime qualification gate;
- isolated implementation status: COMPLETE;
- Production Task 082 status: NOT COMPLETE.

## Remaining dependencies

Task 082 becomes READY only after the canonical Agent runtime/provider owners supply production-like evidence on exact reconciled heads. PR #89 / Task 073+ runtime implementation, real strategy execution, model/provider substitution and operator evidence remain their canonical owners.

State: ISOLATED COMPLETE / WAITING ON AGENT RUNTIME + PROVIDER PRODUCTION-LIKE EVIDENCE.

Last update: 2026-10-06.
