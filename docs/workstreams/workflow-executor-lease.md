# Workflow executor lease / fencing — 2026-10-05

Owner/window: ChatGPT harness executor-lease continuation.
Branch: `work/workflow-executor-lease-20261005`
Base: PR #162 head `01cfaa970f01037018df1c280a1fe3a8bc31ff58`

Purpose: prevent duplicate WorkflowRun execution after restart/reconnect by defining one canonical lease/fencing contract before storage composition.

## Exact owned paths

- `docs/workstreams/workflow-executor-lease.md`
- `packages/workflows/src/executor-lease.ts`
- `packages/workflows/src/executor-lease.test.ts`
- append-only export in `packages/workflows/src/index.ts`

## Boundaries

- no persistence/migration files;
- no Gateway/mobile/channel files;
- no billing/crypto/Commerce/provider dispatch;
- lease ownership never grants new workflow/security authority;
- every executor still needs current AuthorityContext and the canonical resume service;
- stale/expired fence tokens fail closed.

## Acceptance

- lease binds exactly one WorkflowRun + tenant;
- monotonically increasing fence token;
- acquire/reacquire/renew/release semantics are explicit;
- unexpired competing holder cannot be stolen;
- expired holder may be replaced only with a strictly newer fence;
- stale holder cannot renew/release/commit;
- lease duration bounded;
- terminal WorkflowRun must not acquire a new execution lease;
- contract exposes a repository port for atomic persistence integration later.

Status: active.
