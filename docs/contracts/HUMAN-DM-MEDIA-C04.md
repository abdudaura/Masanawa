# C04 — Human private Ogg/Opus voice-note API and media contract (draft)

**Authority:** Only a canonical verified customer session + active tenant/person account + C01 mutual block/consent + C02 exact human DM conversation membership. An AI persona ID, public Talk Seat, handle, client-supplied user ID or old auth cache never grants access. Contacts C01 (#468) and 1:1 DM persistence C02 are unmerged dependencies at this checkpoint. This document does **not** authorize shipping a standalone media route.

## API (same authenticated Gateway origin; `Authorization: Bearer <platform access token>`)

| Operation | Contract | Durable outcome |
|---|---|---|
| `POST /messages/:conversationId/voice-notes` | `Content-Type: audio/ogg`, `x-message-client-request-id`: one 12–128 char safe client-generated token, binary Ogg Opus mono **<=1,572,864 bytes**, **250ms–90s** validated from Ogg granule, no JSON/base64 | **201** only after staged private object written and C02 message record attached in one SQL transaction, returns ID, sender ID, conversation ID, ordered sequence, duration, bytes, timestamp, `mimeType=audio/ogg`, never S3 key/URL |
| `GET /messages/:conversationId/voice-notes?limit=30&before=<sequence>` | Page up to 50 voice records with exclusive descending sequence cursor | Member-only historical records, no private S3 keys |
| `GET /messages/voice/:messageId` | Exact UUID; bearer verified on **every** GET; SQL reciprocal block and account rechecked before and after private S3 bounded GET | `audio/ogg`, `Cache-Control: no-store, private`; no redirect/presigned/public CDN object link |
| `DELETE /messages/voice/:messageId` | Exact UUID, sender-only, authenticated | Tombstone + durable garbage journal; object eventually deleted by private worker with retry |
| `collectGarbage()` | Gateway operator scheduled worker, not exposed as a customer route | Bounded `SKIP LOCKED` claims, idempotent S3 DELETE, repeated failed attempts; manual orphan reconciliation gate |

**Errors:** 400 malformed ID/cursor, 401 missing/expired bearer via canonical session auth, 404 hidden/blocked/unsupported conversation (no account enumeration), 409 reused id with different media, 413 excessive payload, 415 invalid/unsupported Ogg Opus, 429 authenticated rate limit, 503 private S3 or integrity failure. Unauthorized reads never expose hidden ID, object key, storage bucket, media bytes or private recipient.

**Idempotency:** Same user, conversation and client request ID binds to immutable SHA256, duration, byte length and first staged object key. Crash after object PUT before SQL attach is retried using the same journal row; duplicate attached requests return the original receipt. New bytes under reused client request ID = conflict. Failed PUT/GET never creates a delivered receipt. No instant-delivery, read-receipt or E2EE claims.

**Lifecycle:** Tenant-qualified FK, immutable sender/message kind, staged→attached→orphaned→deleting; garbage timeout for interrupted stage and DELETE retries. Note that database account deletion cascades require a coordinated **pre-delete S3 erasure worker** before user rows disappear; C04 alone is not R12 deletion verification. All media binary transfer is TLS; S3 PUT requests AES256 server-side encryption for private bucket. Bucket must have public ACL/CDN/access blocked in provider policy; signing alone is **not** sufficient proof of private-bucket policy. No unapproved public URL.

**Flutter:** `HumanVoiceNotesPanel` deliberately records (never when entering chat), previews, sends and retries the same in-process client request ID with exact signed-in ApiClient transport; denies mic with text fallback. Android `record` encoder/platform support and actual Ogg Opus container must be verified on budget Android. Do not promise that iOS yields Ogg; audio encoder/platform parity requires device proof or approved transcode. C02/C08 integrator must insert C04 controls in the actual human-only thread without editing shared root router from this branch. C03/C05 will own durable encrypted per-account pending media outbox, background delivery and restart-safe request-ID persistence; C04 controller presently loses pending temp audio on process death, so **M03/M05/J04 are not satisfied yet**.

## Mandatory integration, qualification and operational gate

1. **Migrations:** C01 `0016_human_messaging_contacts.sql` (#468), C02 `0017_human_dm_core.sql` (independent draft), then this PR `0018_human_dm_media.sql`; apply only to disposable test DB first, check column/check constraints, voice/text collision, backup and rollback. Never rename or patch already applied migrations.
2. **One Gateway shared composition owner:** merge R18 #435 + C01 #468 + C02 human messages + C04: instantiate `createPostgresVoiceNoteRepository(database.pool)`, canonical platform-session authorizer, `createPrivateVoiceS3` from full `MASANAWA_DM_VOICE_S3_ENDPOINT/REGION/BUCKET/ACCESS_KEY/SECRET_KEY` group; fail closed if partial; register `registerHumanVoiceRoutes(app, service)` only when fully configured with real SQL and **private** bucket. Integrate existing HTTP error adapter so `VoiceNoteError(statusCode,code)` yields safe status. No separate unauthenticated server. Background `collectGarbage` worker gets controlled startup and shutdown; no fallback to public profile/replay storage.
3. **One Flutter owner C02/C08:** C02 list/thread must render `message_kind='voice'` without empty chat bubbles and merge ordered text/audio sequence; add the `HumanVoiceNotesPanel` beneath existing compact text composer only on human DM route. C03 delivers push/cursors and C05 secure pending retry after restart. Validate account switch and stale 401 token refresh fencing.
4. **Security/device proof:** run two independently signed-in users on different Android phones over weak/reconnect network; test denied mic, public Talk mic isolation, exact membership, blocked-after-upload old URL, revoke/delete/R12, concurrent retry/idempotency, outbox on restart, 1.5MiB overflow, malicious/corrupt Ogg, S3 disabled and cleanup. Confirm real provider bucket ACL and SSE, region and credentials. No raw private audio logging, CDN or E2EE marketing.
5. **Evidence not yet present:** local TypeScript/Vitest, PostgreSQL migration tests, Flutter analyzer/widget tests, Android recorder/live playback, deployed Gateway and S3 logs, CI execution. Shared Actions incident #457 is quota exhausted; do not label authored tests as PASS and do not merge this PR until verified.

## Work environment executable commands (run in a cloned, integrated Git worktree)

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm --filter @masanawa/gateway-service typecheck
corepack pnpm exec vitest run services/gateway/src/human_media/ogg_opus.test.ts services/gateway/src/human_media/service.test.ts services/gateway/src/human_media/private_s3.test.ts services/gateway/src/human_media/routes.test.ts
# After C01, C02 and C04 migrations combined, on a disposable localhost *_test DB:
MASANAWA_C04_ENABLE_DB_TESTS=yes MASANAWA_C04_TEST_DATABASE_URL=postgresql://.../masanawa_c04_test corepack pnpm exec vitest run services/gateway/src/human_media/postgres_integration.test.ts
cd apps/mobile
flutter pub get
flutter analyze
flutter test test/human_media_models_test.dart test/human_media_controls_test.dart
flutter build apk --debug
```

**Status:** Code paths and tests are source-authored, unexecuted, not composed into production Gateway or five-tab Flutter. C04 = `PARTIAL_IMPLEMENTATION` pending independent and integration ownership. Not `VERIFIED_E2E`, not release-ready.


## Private-object deletion and background reconciliation — C04 follow-up source checkpoint

The unmerged `0018_human_dm_media.sql` now records `storage_erased_at` and installs
`human_dm_voice_object_erasure_guard`. A direct row deletion, or an account/
conversation cascading deletion, raises SQLSTATE `23503` unless the private
storage object was confirmed deleted. A successful `PrivateVoiceObjectStore.delete`
is followed by **one SQL transaction** recording the erasure timestamp and
removing the journal row; DB rollback/crash leaves a retryable key and does not
claim that an object was erased. Failed object DELETE returns the row to
`orphaned` for durable retries. Never bypass this guard to make R12 appear
complete: the R12 deletion coordinator must request/await private object
erasure before deleting the linked identity/conversation.

`installHumanVoiceModule(app,{pool,authorizer,privateS3})` in
`services/gateway/src/human_media/runtime.ts` is the sole C04-owned
Gateway mount/worker hook. It requires the canonical C01/C02 membership and
session adapter and all five private S3 fields before registering the HTTP
routes, starts a bounded startup+periodic GC worker and joins Fastify
`onClose` to prevent task leaks. Multiple worker instances are protected by
the repository's `SKIP LOCKED`/state cooldown. An optional payload-free
failure signal reports errors without media IDs, key names or private bytes.
**It has not been invoked from shared `main.ts/app.ts`**, which have competing
R18/C01/C02 owners. This mount is source-ready, not deployed or tested.

Add to the Work verification suite:

```sh
corepack pnpm exec vitest run services/gateway/src/human_media/runtime.test.ts
MASANAWA_C04_ENABLE_DB_TESTS=yes MASANAWA_C04_TEST_DATABASE_URL=postgresql://.../masanawa_c04_test corepack pnpm exec vitest run services/gateway/src/human_media/postgres_integration.test.ts
```

On the disposable DB verify SQLSTATE `23503` for premature direct/media
cascade deletion, remote S3 delete failure and retry, successful delete and
journal removal, and R12 account deletion only **after** confirmed erasure.
No external S3 policy, full backup/recovery, migrated C01+C02+C04 schema,
Android or live two-person proof exists in this window.
