# F17/C04 — private voice playback snapshot and durable garbage recovery

**2026-10-09 UTC. Status: PARTIAL_IMPLEMENTATION / draft / unmerged / NOT DEPLOYED / new tests NOT RUN.**

- **Existing canonical draft:** [PR #478](https://github.com/Baatiku/masanawa/pull/478), branch `work/c04-private-voice-notes-20261008`. This is continuation, **not** a new C04 backend or migration.
- **Live main inspected:** `5e758673ae91082520b21b3153da53791ae2cbf3`. **F17 parent HEAD:** `4a164c0d0873fc79b5b0af66eb09ca0d8ed95b19`.
- **Exclusive five-minute claim before edits:** [PR comment #6073356623](https://github.com/Baatiku/masanawa/pull/478#issuecomment-6073356623), scoped to two existing service/test paths and this new handoff.
- **Source commit:** `201924c0ee6c1cf44f0525a1f27a6af6363014fb`; **source+tests checkpoint:** `f250c624bb27b41dbe5fa66a499a095163cfb7ee`. The final handoff-only commit is the PR HEAD following this document.
- **Diff relative to parent:** exactly `services/gateway/src/human_media/service.ts` and `services/gateway/src/human_media/service.test.ts`, prior to this document. GitHub blob readback: source `9784e8a05518982e76595bc8a25009abcf701903`, tests `63941d5bac81e03e5fdd09d1d06fba7215272d9d`.

## Concrete defects and bounded source repair

1. **Asynchronous private audio byte integrity.** `read` validated a provider-returned `Buffer` then awaited a second SQL membership/policy check and live session verification before sending that *same mutable buffer*. A storage adapter returning a pooled/mutable buffer could change the bytes **after** integrity validation while the caller was suspended. The service now copies the bounded S3 response synchronously into a request-owned Buffer **before** SHA-256, Ogg/duration verification or authorization awaits, and serves only that checked snapshot. Never serve provider-owned mutable bytes directly. The existing current-account, tenant, revocation, readback and no-store HTTP safeguards are preserved.
2. **Garbage-reconciliation resilience.** A storage deletion failure followed by a database `deleted(false)` failure used to throw out of the sweep, skipping independently claimed subsequent objects. It now counts that failed object and continues. If storage DELETE **succeeds** but database `deleted(true)` fails or its transaction outcome is uncertain, the worker **does not call `deleted(false)`**. The durable `deleting` journal remains for 15-minute lease reclamation and safe idempotent provider-delete retry; it does not fabricate an erasure receipt. The existing payload-free runtime `failed` count alert remains effective.

No public media route, access-control policy, upload idempotency, C02 message type, migration, Flutter UI, Firebase, S3 credentials, private bucket, finance or production system was changed. Existing F17 source and original 41-pass backend checkpoint are preserved.

## Tests authored and independently observed evidence

Three new adversarial Vitest cases in the **existing C04 suite**:

- Mutate the provider's returned buffer **during** the second SQL authorization read; playback must still return the verified byte snapshot, not the now-zeroed mutable bytes.
- A failed S3 DELETE followed by SQL claim-release failure must count one failure but still delete a different object and allow eventual stuck-lease retry.
- A successful S3 DELETE followed by failed/uncertain SQL erasure acknowledgement must **never** write `deleted(false)`; a later idempotent retry can succeed.

**Execution status for this checkpoint: NOT_RUN.** This window had GitHub connector write/readback and a local Node/TypeScript binary, but **no private-repository checkout** (`git ls-remote https://github.com/Baatiku/masanawa.git` returned `Could not resolve host: github.com`), no installed Vitest/dependencies and no migrated PostgreSQL or private S3 credentials. Readback/static occurrence checks and two-commit GitHub compare succeeded; **these are not executable tests**. Original F17 [prior backend checkpoint](f17-private-media-backend-20261009.md) recorded **41 focused passing tests**, but that earlier source SHA is **not** this changed SHA and those checks were **not rerun** here.

GitHub Actions at test checkpoint `f250c624bb27b41dbe5fa66a499a095163cfb7ee`:
- [Run 37877358460](https://github.com/Baatiku/masanawa/actions/runs/37877358460) / Mobile Build: completed failure, **build job 0 steps**.
- [Run 37877358302](https://github.com/Baatiku/masanawa/actions/runs/37877358302) / Foundation CI: completed failure, **check job 0 steps**.
- Vercel status failure is separate and is **not** evidence against this isolated backend code. Shared Actions blocker [#457](https://github.com/Baatiku/masanawa/issues/457) remains unresolved.

## Required verification and integration before merge

From a genuine checkout of the **PR HEAD** with the lockfile installed:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @masanawa/gateway-service typecheck
corepack pnpm exec vitest run services/gateway/src/human_media/service.test.ts services/gateway/src/human_media/ogg_opus.test.ts services/gateway/src/human_media/private_s3.test.ts services/gateway/src/human_media/routes.test.ts services/gateway/src/human_media/runtime.test.ts
MASANAWA_C04_ENABLE_DB_TESTS=yes MASANAWA_C04_TEST_DATABASE_URL=postgresql://.../masanawa_c04_test corepack pnpm exec vitest run services/gateway/src/human_media/postgres_integration.test.ts
```

- Execute against disposable PostgreSQL with canonical **0016 C01 → 0017 C02 → 0018 C04** sequencing, including lease reclaim and commit-acknowledgement uncertainty. Validate journal erasure guards and backend multiple-worker behavior. Verify a real private S3 provider with blocked public access, SSE and timeout/lost-ACK cases; the new Vitest doubles do **not** establish these provider facts.
- F14/F15/F12/Work must reconcile #468 contact policy, #472 vs #475 C02 membership and message sequence, #478 C04, #497 shared Gateway/Flutter composition, and #461 Firebase. Protect five root tabs **Talks · Chats · Assistant · Wallet · Agents**; C04 is only inside authorized human DMs. Never create a second composer, route, migration or money ledger.
- Execute Flutter human media suites/analyzer, signed Android APK, two separate real human accounts/devices, record/play/delete, permission denied, signed-out and blocked mid-playback, crash/restart and secure outbox retries. R12 storage erasure/account deletion and CI capacity must be qualified separately.
- If any test fails, fix on this single existing branch with an exact new lease; keep this PR **draft/unmerged** until full end-to-end evidence.

This is a narrowly scoped production-safety source improvement, **not C04/F17 complete or deployed**.
