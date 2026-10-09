# F15 — C02 atomic read-receipt authorization recovery

**2026-10-09 · PARTIAL_IMPLEMENTATION · DRAFT / UNMERGED / NOT RELEASE-VERIFIED**

## Identity, claims and ancestry

- Five-minute repository-visible pre-edit ownership claim: [#550](https://github.com/Baatiku/masanawa/issues/550); touched only exact paths listed there (including expansion for Postgres integration tests).
- **Continued canonical C02 PR [#472](https://github.com/Baatiku/masanawa/pull/472)** on `work/c02-durable-human-dm-20261008`. No duplicate C02 PR or competing migration was created.
- Reviewed competing C02 draft [#475](https://github.com/Baatiku/masanawa/pull/475); its `0017_human_dm_text.sql`, `human_dm/**` and mobile `messages/**` MUST NOT be silently combined with canonical #472 `0017_human_dm_core.sql` or `human_messages/**`. Read newer canonical C01 #468 before reconciling F15.
- Baseline `main` at claim: `5e758673ae91082520b21b3153da53791ae2cbf3`; existing PR #472 branch predates that main and **was not rebased**. At post-code comparison, ahead 38 / behind 6; final integrator must semantically reconcile ancestry rather than force push.
- Exact code checkpoint after three sequential remote commits: **`13d8e9a3db37c62ef1d5e82cee46ec5ce75aadec`**. Preceding commits: `c29a755b8edb53080895d41e006a7f17906641de` (SQL fix), `3ecb83a49eaeb5a10d5f59451ea0561f4ff62360` (unit tests), `13d8e9a3db37c62ef1d5e82cee46ec5ce75aadec` (disposable PostgreSQL tests). Handoff commit occurs after this code checkpoint; use the PR's current `head_sha` for the branch head.

## Confirmed gap and implemented correction

C02 `HumanDmRepository.read()` previously did `conversationAllowed()` as a separate `SELECT`, then performed a **blind** `INSERT ... SELECT FROM conversations WHERE tenant/conversation` with no final membership, active-account, reciprocal block, declined-contact or moderation condition. Under PostgreSQL `READ COMMITTED`, a status transition committed between these statements could result in an unauthorised read cursor mutation / acknowledgement.

**Changed code (existing canonical code, not a replacement backend):**
- `services/gateway/src/human_messages/postgres_repository.ts` — make read-cursor INSERT/UPSERT **one SQL statement** with the shared `eligibleReader` predicate, covering authenticated membership, both active identities, pair declines, reciprocal blocks and platform visibility restrictions. Preserve server-side `LEAST(last_sequence, requested)` and `GREATEST(existing, incoming)` monotonicity, return `null` for inaccessible conversations, and avoid the extra preflight transaction. Read-cursor write is statement-atomic; do **not** claim this alone provides strict real-time serialization against an independently concurrent C01 revocation transaction.
- `services/gateway/src/human_messages/postgres_repository.test.ts` — query-harness assertions for a **single**, guarded SQL statement, exact principal parameters, all authorization predicates, clamping, missing member and propagated DB failure.
- `services/gateway/src/human_messages/postgres_integration.test.ts` — on disposable database, assert blocked contact cannot create a receipt or return success and declined contact cannot advance one. Existing read/unread tests still apply; this file is authored not executed here.
- This handoff file.
- **No** edits to `app.ts`, `main.ts`, root Flutter router/tabs, Firebase, native Android/iOS, schema/migration files, C01 storage, financial ledger, CI workflow or production systems.

## Test matrix and actual evidence

| Gate | Status / reproducible evidence |
| --- | --- |
| Connected GitHub exact current-code static source-invariant audit | **Executed: 13/13 passed** over fetched blob SHA `7ed4f78b388b2d23a145327c31dc5c1a122d0ffb` + unit blob `2ba215e1c3d6868813812a1674ddd465a474ee10` + PG test blob `56307779147d6149952b11fad0669c65042d57e1`. Checks single statement, absence of separate preflight, shared active-account, membership, block, declined, moderated, server-clamp + monotonic guards, unavailable mapping, authored tests. **Source-shape check, not executable correctness.** |
| Node/Vitest on actual repo | **NOT EXECUTED:** no local private repository checkout; `git ls-remote` failed DNS (Could not resolve host github.com), and connected GitHub file access cannot install workspace dependencies or invoke tests. Deferred: `cd services/gateway && pnpm exec vitest run src/human_messages/postgres_repository.test.ts` (gateway package is `@masanawa/gateway-service`; no `test` script is declared). |
| TypeScript gateway typecheck | **NOT EXECUTED:** `cd services/gateway && pnpm typecheck` after workspace dependency install (the package's declared script is `tsc -p tsconfig.json`); no local source tree. |
| Disposable PostgreSQL integration | **NOT EXECUTED:** no `MASANAWA_TEST_DATABASE_URL`, Postgres server, or registered combined C01 `0016`/C02 `0017` in one verified migration sequence. Once a **disposable** DB is provisioned, run `cd services/gateway && MASANAWA_TEST_DATABASE_URL=<DISPOSABLE_DB_URL> pnpm exec vitest run src/human_messages/postgres_integration.test.ts`. Do NOT point this at production. |
| Flutter app / two authenticated Android devices | **NOT EXECUTED:** the canonical C02 branch remains unmerged and its Flutter thread is not mounted into five-tab shell. F12 owns router, F14 C01 owns identity; verify blocked/declined changes from device B reflect on A and do not generate read-receipt notification state after reconnect. |
| Shared GitHub Actions #457 | **BLOCKED/UNVERIFIED:** known quota or zero-job-start incident, no green CI implied by source commits. |

## Integration / security blockers (not done)

1. **F15 semantic merge:** preserve #472 schema/API as the canonical C02 candidate (per Work guidance); review #475 for unique outbox improvements while rejecting its competing `0017` migration / `human_dm/**` route. Also reconcile #474/#476 C05 competing caches. A current `main` rebase/merge requires single integrator and full tests; do not force-push existing branch.
2. **F14 C01:** preserve #468 authentic contact admission, relational restrictions, active-state and reciprocal block sources. Execute real PostgreSQL concurrent revocation/read races and policy tests. A SQL statement uses one MVCC snapshot; strict revocation linearization, if required, needs shared lock ordering across C01 mutations and C02 receipts.
3. **F12/R17/C08:** mount the canonical authenticated C02 service only after migrations and Gateway composer reconciliation, then mount Chats and nested Contacts without creating another human-chat or AI-chat destination. C03 realtime, C04 attachment and C05 encrypted local cache require separate integration.
4. **Release:** execute source, Vitest, TypeScript, migration ordering, blocked/revoked two-account/readback and actual-device tests with credible outputs. Current PR must stay **draft/unmerged**, no deploy, payment, customer DB mutation or release claim.

## Minimal reviewer checklist

- Verify the SQL INSERT's `WHERE ${eligibleReader}` remains in the **same statement** as UPSERT (no unconditional alternate path).
- Review exact C01 `declined` vs `revoked` storage semantics and account deletion behavior; shared predicate is only as complete as the canonical C01 source.
- Prove permission is denied to nonmembers, revoked/blocked/disabled identities even when an old conversation UUID and read sequence are supplied.
- Inspect behavior on callback/query error: no false `lastReadSequence` emitted.
- Only promote status beyond **PARTIAL_IMPLEMENTATION** after cross-lane integration, executable tests and device/provider evidence.
