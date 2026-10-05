# Workflow executor lease PostgreSQL persistence — 2026-10-05

Owner/window: ChatGPT harness executor-lease persistence continuation.
Branch: `work/workflow-executor-lease-postgres-20261005`
Base: PR #169 head `5076dc1aba94dc9d3415d033debc75812de158a9`
PR: #173

Purpose: persist the fenced WorkflowRun executor lease atomically in the canonical
Workflows PostgreSQL owner.

## Exact owned paths

- `docs/workstreams/workflow-executor-lease-postgres.md`
- `packages/workflows/migrations/0010_executor_leases.sql`
- `adapters/storage/postgres/src/workflows/executor-lease.ts`
- `adapters/storage/postgres/src/workflows/executor-lease.integration.test.ts`
- append-only export in `adapters/storage/postgres/src/index.ts`

No existing Task/Workflow repository implementation, Gateway/mobile/channel, finance or
provider files are owned.

## Implemented

- append-only Workflows migration `0010_executor_leases.sql`; `0001_work_runtime.sql`
  is untouched;
- one durable lease row per tenant + WorkflowRun with a canonical FK to
  `workflows.workflow_runs`;
- holder/fence/state/timestamps are constrained at the database layer;
- DB trigger forbids destructive delete and illegal fence/history rewrites;
- release is persisted as `state='released'` so the last fence survives;
- the next acquisition increments the existing fence rather than reusing 1;
- all mutating operations lock the canonical WorkflowRun row first, serializing
  first-acquire and takeover races for the same Work identity;
- acquisition rereads the canonical WorkflowRun state and rejects stale caller state;
- the database clock drives lease acquisition/renew/release timestamps; a materially
  future caller clock is rejected but never becomes lease truth;
- active same-holder reacquire is idempotent and does not extend expiry;
- competing unexpired holder fails;
- renewal requires the exact live holder/fence and uses a fenced SQL update;
- release requires the exact live holder/fence and uses a fenced SQL update;
- terminal WorkflowRun acquisition is rejected from the canonical persisted state;
- repository recreation/read recovers the same durable fence state;
- focused PostgreSQL tests cover restart, replay, active contention, release history,
  stale state, terminal state and independent-repository concurrency.

## Verification

- Compare against PR #169 head: 5 commits ahead, 0 behind.
- Exact changed paths are the five claimed paths above.
- Foundation CI run `37296899724` failed before executing any job step; job
  `111720159667` has `steps: null`. This is hosted runner non-execution, not a
  database/TypeScript test verdict.
- PostgreSQL integration tests are checked in and automatically skip when
  `MASANAWA_TEST_DATABASE_URL` is absent; no fabricated execution claim is made.

## Integration handoff

1. Integrate #173 only after #169/#162/#154 ancestry is reconciled on the selected
   production integration line.
2. Resume flow should revalidate present Security authority first, then acquire the lease.
3. Executor renews the lease while actively working and must stop on renew failure.
4. Before checkpoint/result/external-outcome commit, integration must reread/assert the
   current holder+fence transactionally; a stale worker may never commit after fencing.
5. External side-effect ambiguity still goes to canonical reconciliation; the lease does
   not make redispatch safe.
6. Mobile/WhatsApp/Telegram never hold executor leases.

Implementation: complete within this isolated persistence slice.
Verification: source/diff audit complete; executable hosted CI unavailable.
Deployment: not claimed.
