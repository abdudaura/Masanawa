# AgentRun recovery acceptance

Status: integration acceptance slice stacked on PR #89. This file does not change the
canonical Task 072 completion state.

## Purpose

Task 072 already has its AgentRun contract and PostgreSQL implementation. This slice
adds a focused recovery journey that exercises the behavior a caller needs after a
lost response or process restart:

1. admit a root AgentRun durably;
2. recreate the PostgreSQL pool/repository and replay the identical admission;
3. continue a child run with the same root lineage after recreation;
4. finish the child;
5. recreate the pool/repository again and replay the same terminal outcome;
6. reject a changed terminal outcome rather than rewriting durable history;
7. read the original root and child records after the second recreation;
8. prove a persisted RequestId cannot be rebound to another AgentRun after restart;
9. replay an identical failed terminal outcome but reject a changed failure code;
10. reject changed admission payloads and forged child lineage after restart.

The test uses the canonical CharacterSession/AgentRun migrations, Identity admission,
Security policy revision and current database clock. It does not introduce a second
runtime, workflow or idempotency store.

## Owned evidence

- `tests/integration/agent-run-recovery-acceptance.test.ts`

## Intended verification

With PostgreSQL 18 available through `MASANAWA_TEST_DATABASE_URL`:

```bash
pnpm exec vitest run tests/integration/agent-run-recovery-acceptance.test.ts \
  --maxWorkers=1 --hookTimeout=60000 --testTimeout=30000
```

Then run the normal Task 072/full workspace gate owned by the runtime integration
branch. This stacked slice must not be used to claim Task 072 complete by itself.

## Boundaries

The recovery test deliberately changes no production contract, repository, migration,
Gateway, mobile, channel, Commerce or deployment path. Repository recreation is modeled
by closing and reopening the PostgreSQL pool against the same isolated database. It is
not a power-loss durability test and does not substitute for the required hosted
implementation-head and merged-main CI gates.


## Recovery matrix

| Recovery condition | Expected invariant |
| --- | --- |
| Lost root-admission response | Exact replay returns the same durable AgentRun |
| Same RequestId, different AgentRun after restart | Rebinding is rejected |
| Exact child continuation after restart | Parent/root/depth lineage is preserved |
| Missing/forged parent after restart | Admission fails closed |
| Changed admission payload | Existing immutable admission wins; changed replay conflicts |
| Completed terminal response loss | Exact completion replay is idempotent |
| Failed terminal response loss | Same failure code replays; changed failure conflicts |
| Two repositories race with identical admission | Both observe one durable AgentRun |
| Two repositories race different runs on one RequestId | Exactly one durable binding survives |
| Task/Workflow/Operation trace after restart | Exact references survive; insufficient resource scope is denied |
| New CharacterVersion activation | Existing AgentRun remains pinned to admitted CharacterVersion |
| Policy revision changes | Old AuthorityContext is rejected as stale |
| AuthorityContext revoked | Subsequent mutation fails closed |
| AuthorityContext expired | Recovery read is denied |
| CharacterSession closes | Existing exact replay reconciles; new work is rejected |
| Direct SQL trace rewrite after restart | PostgreSQL immutability trigger rejects mutation |

These cases deliberately exercise the canonical storage and authorization boundaries rather
than adding retry state in Gateway or application memory.

## Current hosted evidence

The latest Foundation CI attempt for this slice is run `37224302096`, job
`111500662069`. It again recorded `runner_id=0`, an empty runner name and zero
steps. Earlier attempts `37220620769` and `37223081109` failed the same way.
No checkout, install, TypeScript compilation or PostgreSQL test ran in those jobs.

Therefore the branch contains implemented acceptance coverage but still requires an
execution environment with PostgreSQL 18 before any pass is claimed.
