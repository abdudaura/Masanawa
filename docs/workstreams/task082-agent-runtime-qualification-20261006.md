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

## Acceptance intent

The qualifier must fail closed unless production-like evidence proves:
- foreground conversational journey;
- research/multi-step journey;
- delegated specialist journey with lead Character continuity;
- exact budget enforcement;
- cancellation/supersession stale-result protection;
- AgentRun telemetry/diagnostics;
- provider replacement;
- model replacement.

Every scenario must bind exact Agent runtime and Provider source heads and independently prove functional success, authorization/lineage safety, and deterministic terminal/replay behavior.

State: CLAIMED / IMPLEMENTATION IN PROGRESS.

Last update: 2026-10-06.
