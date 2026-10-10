# AF09 Published Talks — precise pending-audio publication pagination (2026-10-10)

**Parent customer milestone:** A creator's valid submitted audio Talk progresses from durable `processing` to approved `published` or explicit `failed`, then appears in the feed and can be played. This is **PARTIAL_IMPLEMENTATION**, not a completed consumer journey.

**Continued source:** existing draft [PR #609](https://github.com/Baatiku/masanawa/pull/609), branch `work/af09-published-audio-20261010-gpt6`; main baseline `c7f7280e640d3098be3e26f05149a0d66085441b`. CAS coordination `af09-609-processing-pagination-gpt6-0342` acquired/read back on `factory/claims` before writes. Current branch head must be refreshed before integration because other AF09 owners are concurrently working in this same PR.

## Demonstrated missing connected processing behavior

The original `processing_queue.ts` selected native PostgreSQL `timestamptz` rows as JavaScript `Date` values. PostgreSQL retains microseconds; the `pg` Date decoder loses the last three fractional digits. The subsequent keyset `(created_at,post_id) < ($2::timestamptz,$3)` could skip another queued post in the same millisecond once the rounded cursor was used. A retry sweeper advancing the cursor could consequently omit a valid pending audio submission.

The existing PostgreSQL queue now selects UTC timestamps using `to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`, keeps the full six fractional digits in its opaque cursor, and rejects malformed/rounded cursor values. The original ordering, tenant guard, bounded scan, advisory session lease and revision-CAS settlement are preserved. A legacy Date-shaped test row remains supported, without changing SQL precision.

**Unique source commits:** `5df78af35647c4630508fa4ab9794928ce171278` (queue), `5b90bd3341c8fe3c8ddf82923d171e0b1b9184ba` (correct regex), `94cbdcff8ee8f1394869e8c3283fe7739ff14046` (negative tests). Current queue blob `280c74e78587113ad4bb2ae8d0f606dd15d020ae`; processing test blob `5319bf625d0c6c62ef6d4e452b12d702393d2e08`.

**Exact paths owned and changed:**
- `adapters/storage/postgres/src/audio_posts/processing_queue.ts`
- `services/gateway/src/audio_posts/processing_worker.test.mjs`
- `docs/workstreams/AF09-processing-pagination-20261010.md`

**Tests authored:** two existing worker-suite regressions: two pending posts within the same millisecond survive page boundaries; malformed cursor and rounded DB timestamp fail closed.

**Checks actually executed:** four focused V8 checks on a syntax-erased, exact-blob source projection with fake PostgreSQL rows and Buffer, all **4/4 PASS_SIMULATED**. Tested preserved six-digit SQL cursor, next-page row, malformed cursor rejection and rounded database-row rejection. This does **not** count as executing the repository's Node test file or a real SQL query. GitHub blob/readback verified. No source-wide TypeScript, actual Node test runner, PostgreSQL, Flutter/Android, audio device, providers or deployment tests executed on this exact head.

## Exact qualification and customer-journey blockers

- **AF13 / capable AF00 Node 24+pnpm12 runner:** at pinned **latest PR #609 HEAD**, run `pnpm install --frozen-lockfile`, `pnpm -r typecheck`, `node --experimental-strip-types --test services/gateway/src/audio_posts/processing_worker.test.mjs` (or the repo-supported Node24 invocation), and the other AF09 tests. Record executed steps and failures; GitHub Actions zero-step / Vercel build-rate-limit statuses are not source-test evidence.
- **AF13 / AF00 disposable PostgreSQL owner:** install the AF00-reviewed append-only `social.audio_posts` migration in a disposable database and insert records with timestamps `.123456Z`/`.123455Z` under the same tenant. Execute real page-1, encoded cursor, page-2, concurrently removed/revision-stale rows and worker lease tests; verify second row is not skipped and tenant isolation is retained. No production migration.
- **AF00 integration owner:** elect and publish one **reviewed non-deploying integration target** after auditing Vercel/GitHub/other auto-deploy hooks; reconcile local source/APK and the #497 baseline, route AF08 authenticated actor, canonical visibility, AF15 authorized media, persisted SQL, and the existing AF09 worker + Flutter Talks feed/composer into that one baseline. AF05/AF15 independently qualify recorder, upload, private signed playback and focus. No competing branch created here.
- **AF09 existing milestone owner:** continue real compose/record/upload, status recovery, follow/feed/playback and moderation integration in PR #609. The new cursor regression is a necessary processing correction, not proof that Published Talks is usable.

**Source integration decision:** do not merge PR #609 into auto-deploying main or claim product completion on these isolated simulated checks. AF00/AF13 must run executable exact-head source/SQL/Flutter checks and review the safe deployment isolation before a bounded non-production merge. This window did not publish or play an actual audio Talk, produce an APK or change production infrastructure.
