# Workflow executor lease / fencing — 2026-10-05

Owner/window: ChatGPT harness executor-lease continuation.
Branch: `work/workflow-executor-lease-20261005`
Base: PR #162 head `01cfaa970f01037018df1c280a1fe3a8bc31ff58`
PR: #169

Purpose: prevent duplicate WorkflowRun execution after restart/reconnect by defining one
canonical lease/fencing contract before storage composition.

## Exact owned paths

- `docs/workstreams/workflow-executor-lease.md`
- `packages/workflows/src/executor-lease.ts`
- `packages/workflows/src/executor-lease.test.ts`
- append-only export in `packages/workflows/src/index.ts`

No persistence/migration, Gateway/mobile/channel, finance or provider files are owned.

## Implemented

- lease binds exactly one tenant + WorkflowRun;
- bounded holder identifier;
- monotonically increasing safe-integer fence token;
- first acquisition starts at fence 1;
- same-holder reacquire is idempotent while the lease is active and does not silently
  extend lifetime;
- an unexpired competing holder cannot steal the lease;
- expired or explicitly released lease may be replaced only with fence + 1;
- renewal keeps the same fence and requires exact holder + fence + unexpired state;
- current-fence assertion is intended immediately before checkpoint/result/side-effect
  commit, so an executor fenced during work cannot later commit stale output;
- terminal completed/failed/cancelled WorkflowRuns cannot acquire execution;
- lease durations are bounded to 1 second..15 minutes;
- release transitions the lease to durable `released` state instead of deleting fence
  history; next acquisition therefore cannot reuse fence 1;
- stale holder/fence cannot renew, release or pass the current-fence check;
- repository port defines atomic acquire/renew/read/release persistence seam.

The lease is execution ownership only. It never grants Security authority, approval,
Tool permission, money authority or WorkflowRun transition authority.

## Verification

- Compare against PR #162 head: 6 commits ahead, 0 behind.
- Exact changed paths are the four claimed paths above.
- Final head before this handoff update: `8fd6a61088ae2fad94bcc25a46e42f29639a0f03`.
- GitHub currently exposes no workflow run for that final head, so no executable CI pass
  is claimed.
- Focused tests cover first acquire, same-holder replay, competing holder rejection,
  expiry takeover/fence increment, exact renewal, commit-fence checks, stale release,
  durable release/fence-history preservation, terminal refusal and duration bounds.

## Integration handoff

1. Persistence owner must implement `WorkflowExecutorLeaseRepository` atomically in the
   canonical Workflow storage; **release must retain the last fence** rather than delete
   the row/fence history.
2. Resume integration should obtain a lease only after the canonical resume service has
   revalidated present Security authority and returned executable Work.
3. Executor must call the current-fence assertion (or equivalent transactional DB check)
   immediately before checkpoint/result commits and before settling an external outcome.
4. A worker losing/expiring its fence stops immediately and must not retry a consequential
   external effect. It returns to canonical reconciliation/resume flow.
5. Mobile/WhatsApp/Telegram only receive truthful Work progress. They do not acquire,
   renew or release executor leases.

Implementation: complete within the isolated Workflow contract slice.
Verification: source/diff audit complete; executable CI unavailable.
Deployment: not claimed.
