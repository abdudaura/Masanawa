# Workflow executor heartbeat policy — 2026-10-05

Owner/window: ChatGPT harness heartbeat continuation.
Branch: `work/workflow-executor-heartbeat-20261005`
Base: PR #176 head `dd34c3728eb60bd8e38b5e66fc410093dbaed9cc`

Purpose: keep executor lease renewal deterministic and fail closed before expiry without putting timers or execution authority in mobile/channel clients.

## Exact owned paths

- `docs/workstreams/workflow-executor-heartbeat.md`
- `packages/workflows/src/executor-heartbeat.ts`
- `packages/workflows/src/executor-heartbeat.test.ts`
- append-only export in `packages/workflows/src/index.ts`

## Boundaries

- no Gateway/mobile/channel composition;
- no persistence/migration changes;
- no provider/finance dispatch;
- policy does not renew by itself and grants no authority;
- caller must still use #176 renew and #175 fenced commits.

## Acceptance

- held lease only;
- deterministic renew window from lease lifetime;
- renew-before-expiry safety margin;
- expired/released lease => stop immediately;
- stale observation time rejected;
- bounded policy percentages/margins;
- caller can distinguish healthy / renew-now / stop;
- next check timestamp never exceeds lease expiry.

Status: active.
