# Workflows PostgreSQL persistence — 2026-10-05

Owner/window: ChatGPT harness/workflows continuation after canonical Task/WorkflowRun contract merge.
Branch: `work/workflows-postgres-persistence-20261005`
Base: `4d1e0d766db178782e64c0a22af4accd386789fb`

Purpose:
1. Persist canonical Task, WorkflowRun and WorkflowCheckpoint truth in PostgreSQL.
2. Make Work state recoverable across Gateway/service restart.
3. Preserve optimistic revisions, current-authority checks and monotonic checkpoint append semantics.

Owned paths:
- new `packages/workflows/migrations/**`
- new `adapters/storage/postgres/src/workflows/**`
- `adapters/storage/postgres/src/index.ts` export seam
- `adapters/storage/postgres/package.json` workflows dependency
- `adapters/storage/postgres/src/readiness.ts` only to register the workflows migration owner
- focused workflow persistence integration tests under the Postgres adapter
- `docs/AGENT-HARNESS.md`
- this claim file
- mandatory continuation docs at checkpoint

Boundaries:
- no Gateway/harness composition until repository persistence is stable;
- no billing/crypto/provider state changes;
- no mutation of applied migrations;
- checkpoints store committed/executor/edge/pending-approval state but not frozen authority;
- resumed consequential mutation still requires present-authority revalidation in the later executor slice.

Acceptance:
- new workflows migration owner/table set with immutable applied migration checksum;
- Task and WorkflowRun create/read/list/transition persist strict canonical records;
- expected revision conflicts fail closed;
- terminal records cannot restart;
- checkpoint append is transactional with WorkflowRun checkpointRevision;
- checkpoint revisions are monotonic and replay-safe;
- latest checkpoint can be restored after a new repository instance;
- repository operations revalidate current authority transaction-locally;
- tests cover persistence/recovery/conflict/isolation/checkpoint behavior;
- checkpoint docs reconciled before handoff.

Status: active.
