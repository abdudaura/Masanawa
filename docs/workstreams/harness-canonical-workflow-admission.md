# Canonical Workflow Harness execution admission — 2026-10-05

Owner/window: ChatGPT Harness reconciliation continuation.
Branch: `work/harness-canonical-workflow-admission-20261005`
Base: PR #119 head `2f931a5dfa14417e02956da5c5f7b33df1c3959f`
PR: #183

Purpose: bridge the Agent Harness into the existing canonical Task-based Workflow engine
without introducing a second lease/checkpoint runtime.

## Exact owned paths

- `docs/workstreams/harness-canonical-workflow-admission.md`
- `packages/workflows/src/execution-admission.ts`
- `packages/workflows/src/execution-admission.test.ts`
- append-only export in `packages/workflows/src/index.ts`
- `adapters/storage/postgres/src/workflows/harness-execution.ts`
- `adapters/storage/postgres/src/workflows/harness-execution.integration.test.ts`
- append-only export in `adapters/storage/postgres/src/workflows/index.ts`

No migrations/tables, Gateway/mobile/channel, finance or provider dispatch files are owned.

## Canonical Workflow engine reused

- PR #107: transactional Task admission;
- PR #109: atomic Task checkout and monotonic fencing;
- PR #111: heartbeat, expiry and stale-worker adoption;
- PR #112: versioned compatible checkpoints;
- PR #113/#114: retry/backoff/needs-attention;
- PR #115: pending human requests;
- PR #117: canonical Operation/receipt/reconciliation truth;
- PR #118: cancellation/compensation/supersession control;
- PR #119: usage/cost evidence and operator visibility.

This line is the canonical durable Workflow substrate for the Harness.

## Implemented

- one `CanonicalWorkflowTaskLease` projection matching the canonical leased Task
  identity/version/graph/owner/fence/expiry fields;
- only a currently running, unexpired fenced Task may be considered for execution;
- current authority/evidence is injected and revalidated before checkpoint or external
  outcome inspection;
- latest checkpoint is loaded only for the exact Tenant/WorkflowRun/WorkflowVersion/
  graph/schema tuple and then independently compatibility-checked again;
- no checkpoint means execute from start; an exact checkpoint means resume from checkpoint;
- external Operation truth is read from the existing canonical Task→Operation binding;
- no bound primary Operation is safe to proceed;
- canonical `reconciliation-required` and `needs-attention` dispositions route to
  reconciliation instead of redispatch;
- canonical `pending` Operation blocks execution/redispatch while still in flight;
- terminal succeeded/failed Operation truth permits the Harness to continue from the
  known durable outcome rather than guessing;
- PostgreSQL adapter reuses the existing checkpoint and Operation-truth readers only;
  it creates no new store.

## Duplicate-runtime reconciliation

A later exploratory Harness line (#162/#169/#173/#175/#176/#182) implemented useful
ideas but duplicated leasing/checkpoint/recovery concepts at WorkflowRun level. Audit
against #107–#119 showed that the canonical Task engine already owns those concerns.

The useful semantics have now been preserved here:
- present-authority revalidation;
- exact compatible checkpoint restore;
- stale/expired lease refusal;
- no blind redispatch after uncertain external effects;
- channel/provider-neutral Harness admission.

The duplicate WorkflowRun lease/resume/heartbeat PRs are superseded by #183 plus the
existing canonical Task engine and should not be merged wholesale.

PR #165 AgentRun execution budgets and PR #163 bounded subworkers remain independent,
non-duplicate Harness work and are not superseded.

## Migration collision correction

The exploratory WorkflowRun lease persistence initially used a local `0002` filename
on an older ancestry. Audit found the canonical Workflow migration sequence already
occupied 0001–0009 across #107–#119. That duplicate filename was corrected before this
reconciliation and the duplicate persistence line is now superseded entirely; #183 adds
no migration.

## Verification

- branch is 8 commits ahead and 0 behind PR #119 head;
- exact changed paths are the seven claimed paths above;
- Foundation CI run `37304004958` failed before executing any step; job
  `111743173627` exposes `steps: null`. This is hosted runner non-execution, not a
  TypeScript/PostgreSQL verdict;
- focused unit tests cover current lease admission, exact checkpoint resume, expiry,
  reconciliation routing, in-flight blocking, incompatible checkpoints and authority
  revalidation ordering;
- PostgreSQL integration coverage is checked in for no-operation and no-checkpoint
  evidence paths and automatically skips when no test database is configured.

## Harness integration handoff

Canonical execution flow should now be:

1. canonical Workflow admission creates Tasks (#107);
2. worker checks out ready Tasks under monotonic Task fence (#109);
3. expired worker leases recover/adopt through #111;
4. Harness calls #183 admission with the fenced Task;
5. #183 revalidates current authority/evidence;
6. #183 restores only an exact compatible checkpoint from #112;
7. #183 consults #117 Operation truth before any external redispatch;
8. uncertain outcomes go to reconciliation/attention, not provider resend;
9. active work heartbeats through #111;
10. execution settles under the existing fenced Task settlement (#109), retries through
   #113/#114, human waits through #115, and control/usage through #118/#119.

Mobile/WhatsApp/Telegram remain presentation/input channels and never own Task fences,
checkpoint truth, provider outcome truth or execution authority.

Implementation: complete within this isolated canonical Harness seam.
Verification: source/diff audit complete; executable hosted CI unavailable.
Deployment: not claimed.
