# Workflow resume and present-authority revalidation — 2026-10-05

Owner/window: ChatGPT harness/workflows resume continuation.
Branch: `work/workflows-resume-revalidation-20261005b`
Base: latest PR #154 head `e76239cf8a7d8c8f60c51b82c2e293171f5d5582`
PR: #162
Purpose: complete the next harness durability slice after PostgreSQL Work persistence.

## Exact owned paths

- `docs/workstreams/workflows-resume-revalidation.md`
- `packages/workflows/src/resume.ts`
- `packages/workflows/src/resume.test.ts`
- append-only export in `packages/workflows/src/index.ts`

No Gateway/mobile/persistence/migration/Commerce/provider files are owned.

## Implemented

- fresh present-authority validation is required immediately before a resumable execution
  disposition is returned; checkpoint state never carries frozen authority;
- queued Work may transition to running only with fresh authority and no pre-existing
  execution checkpoint;
- running Work resumes only from the exact latest durable checkpoint; a running record
  without checkpoint is blocked rather than replayed from the beginning;
- WorkflowRun/checkpoint identity, checkpoint revision and pending-approval custody must
  agree exactly;
- current WorkflowVersion graph signature must match the persisted checkpoint before
  checkpointed execution resumes;
- waiting_approval requires a checkpoint, revalidates authority, rechecks the exact
  approval references, and transitions to running only after they are currently satisfied;
- waiting_external never goes to the executor: it returns reconciliation-required with
  its exact checkpoint and present authority;
- completed/failed/cancelled Work is terminal and never restarts;
- focused tests cover queued start, checkpoint resume, missing-checkpoint block,
  approval wait/resume, external reconciliation, terminal refusal, checkpoint mismatch,
  graph drift and approval-custody mismatch.

## Collision handling

An initial stacked PR #158 was created from an earlier PR #154 head. While this work was
in progress, PR #154 advanced by three commits and merged into its integration base.
#158 was closed as stale. This branch/PR #162 was rebuilt from the latest #154 head and
contains the same isolated resume work with no persistence-file overlap.

A Gateway resume coordinator was deliberately not retained here. The current Gateway
package on this stack does not yet declare `@masanawa/workflows`; adding it would require
shared package/lockfile edits owned by the persistence/integration line. The shared
integration owner should add that dependency once the workflow stack is reconciled, then
compose this resume service into AgentHarness.

## Verification

- Compare against latest #154 head: 5 commits ahead, 0 behind.
- Exact changed paths are the four owned paths above.
- Foundation CI run `37292555897` failed before executing any step; job
  `111706148444` has `steps: null`. This is runner-allocation/non-execution, not a
  TypeScript/test result.
- No local repository checkout exists in the available container and outbound repository
  access is unavailable there, so no fabricated local test claim is made.

## Integration handoff

1. Reconcile #162 after the #154 workflow-persistence line reaches the chosen production
   integration base.
2. Gateway/harness integration adds the normal `@masanawa/workflows` dependency through
   the shared lockfile owner.
3. AgentHarness should call the canonical resume service after reconnect/restart and
   dispatch only `execute` dispositions.
4. `reconcile-external` must enter provider/domain reconciliation rather than Tool
   redispatch.
5. `waiting-approval` remains user-visible paused Work until current approval evidence
   satisfies the exact references.
6. Mobile/WhatsApp/Telegram continue rendering the existing server-authored
   `work.updated` projection; no client becomes execution authority.

Implementation: complete within this isolated slice.
Verification: source/diff audit complete; executable CI unavailable.
Deployment: not claimed.
