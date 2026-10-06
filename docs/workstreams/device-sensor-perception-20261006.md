# Device notification/state/location perception — Task 112 — 2026-10-06

Status: active isolated perception slice
Owner/window: ChatGPT continuation window
Branch: `work/device-sensor-perception-20261006`
Base: Task 111 PR #234 @ `a5771c1db7e297fa43c9be75231b3d544818bcf0`

## Exact owned paths

- `packages/perception/src/device-sensor-admission.ts` (new)
- `tests/contracts/device-sensor-perception-admission.test.ts` (new)
- `docs/DEVICE-SENSOR-PERCEPTION.md` (new)
- `docs/workstreams/device-sensor-perception-20261006.md`

## Boundaries

- no shared package barrel/manifest/lockfile edits;
- no Gateway/mobile/Android/runtime/storage/migrations;
- no Task 109-111 source edits;
- no memory promotion implementation (Task 117);
- no quiet-hours/proactivity policy (Task 115).

## Goal

Normalize permission-scoped Device observations into canonical Task-109 `PerceptionEvent`:

- notification summaries;
- bounded Device state snapshots;
- coarse/precise location samples.

Security/privacy rules:
- all three require exact canonical Device ID and `device-permission` evidence;
- notification bodies are bounded and never carry provider access tokens;
- Device-state fields are explicit bounded facts, not inferred capabilities;
- location requires user-private scope and memory promotion forbidden;
- location retention is ephemeral/session only, never durable;
- exact coordinates are admitted only when the observation declares precise permission;
- dedupe identity is exact Device + sensor observation id.
