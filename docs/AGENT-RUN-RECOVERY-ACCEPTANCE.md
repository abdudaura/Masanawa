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
