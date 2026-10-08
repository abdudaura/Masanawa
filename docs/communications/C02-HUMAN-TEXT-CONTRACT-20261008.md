# C02 — Durable person-to-person private text transport

**Status:** Draft source written on `work/c02-private-text-core-20261008-gpt6`; NOT verified, deployed, merged or released. C01 #468 dependency is still draft. No WhatsApp compatibility, person-to-person calls, E2EE claim, push or media qualification implied.

## Boundaries

- Authenticated **human** `identity.users` and `talks.public_profiles`, not Masanawa AI character conversations or public Talk comments.
- Distinct `talks.human_dm_threads`, `talks.human_dm_messages`, `talks.human_dm_read_cursors`; migration `0017_human_dm_text.sql` depends on `0016_human_messaging_contacts.sql` from C01 #468 being integrated in the same migrations owner path.
- Each thread is a canonical unordered pair `LEAST(user_a,user_b),GREATEST(...)`, tenant-scoped; messages ordered by transactional `sequence`; UUID client request ID is unique per tenant + sender across all threads.
- Open/send reevaluate C01 current consent: accepted edge OR recipient `anyone` without explicit decline, no reciprocal block, no safety-restricted profile, both users active. Previously sent text remains visible to authorized former members after consent revocation; revoked recipients cannot receive new sends. This policy must be reconciled with C01's production contract after C01 changes.
- Reading requires current verified session + membership. Editing is author-only, limited to 15 minutes and valid permission. Deletion is author-only, soft-deleted content shows tombstone rather than leaking plaintext. Database retention/erasure policy must be qualified with R12.
- Sending allows 1–4096 trimmed UTF-16 characters, rejects ASCII controls, rate limits to 30 committed messages/user/rolling minute in PostgreSQL; rejects same idempotency ID with different body/thread.
- No financial action, model-authorized message, media upload, public stage event, message content in push, or optional developer token.

## Authenticated HTTP contract

All require normal `Authorization: Bearer <access-token>`; bearer refresh is handled by existing Flutter `ApiClient`. The user/tenant is never accepted from request bodies or headers.

| Request | Purpose and result |
| --- | --- |
| `POST /v1/messages/conversations {otherUserId}` | Open/return canonical conversation; `{conversationId}`, 201; admission rechecked |
| `GET /v1/messages/conversations?limit=40` | Recent human threads, unread and last-read sequence; only signed-in member |
| `GET /v1/messages/conversations/:conversationId/messages?limit=40&beforeSequence=N` | Descending stable server sequences, `{messages,nextBeforeSequence}` |
| `POST /v1/messages/conversations/:conversationId/messages {clientMessageId,text}` | Persisted idempotent server acknowledgement with `messageId,sequence,createdAt`; on ambiguous transport failure replay same ID |
| `POST /v1/messages/conversations/:conversationId/read {upToSequence}` | Monotonic, capped last-read cursor for signed-in member |
| `PATCH /v1/messages/conversations/:conversationId/messages/:messageId {text}` | Author-only 15-minute edit |
| `DELETE /v1/messages/conversations/:conversationId/messages/:messageId` | Author-only tombstone |

Failures include 400 validation, 401 session, 403 send/edit/delete policy, 404 hidden thread/contact, 409 idempotency collision, 429 rate cap, and 5xx transient failure; never synthesize a success receipt on a failed request.

## Flutter state

- The typed `GatewayHumanDmTransport` reuses canonical bearer token and refresh; `HumanDmThreadScreen` shows only actual server-confirmed message receipts and separate persistent `Not confirmed` pending rows.
- A random UUID request ID is durably written to per-account/conversation `FlutterSecureStorage` **before** HTTP. Failed acknowledgment retains original id for manual retry or history reconciliation. Writes to the encrypted pending record serialize across concurrent sends.
- `HumanDmInboxScreen` and `HumanDmOpenContactAction` are isolated widgets awaiting R17/C08 installation under human Chats/real person profiles; no temporary fourth tab, AI chats reuse, or navigation ownership takeover.
- C05 owns indexed offline **history** cache, delta sync and retention/performance; C03 owns authorized push/realtime/unread reconciliation. This C02 outbox alone is not an offline-first message-history implementation.
- C01 privacy, actual contacts discovery, M03 voice notes/C04 and C08 release are explicit dependencies, **not claimed done** by C02 source.

## Verification/handoff

**Executable tests written, not run:** `services/gateway/src/human_dm/{service,routes}.test.ts`; `postgres_repository.integration.test.ts`; `apps/mobile/test/human_dm_{controller,transport}_test.dart`.

Work environment:
1. Pull fresh main, reconcile C01 #468 and R18 #435 shared `app.ts`/`main.ts` (and migration `0015`/`0016`/C02 `0017`) without overwriting their implementations. Coordinate C08 shell and C01 contact acceptance button integration.
2. Use correct Node24 and pnpm12: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm exec vitest run services/gateway/src/human_dm`, `pnpm test:ci`, `pnpm build`.
3. Against a **disposable PostgreSQL** install, export `MASANAWA_TEST_DATABASE_URL`; run the opt-in `postgres_repository.integration.test.ts` and migration set using `pnpm --filter @masanawa/gateway-service build` then Gateway `migrate`. Inspect constraints/permissions/schema, SQL advisory-lock/concurrency/rollbacks and migration ordering; do not point integration test at live data.
4. Flutter stable compatible with `sdk: ^3.12.2`: `cd apps/mobile && flutter pub get && flutter analyze && flutter test test/human_dm_controller_test.dart test/human_dm_transport_test.dart && flutter test && flutter build apk --release`.
5. On two independently authenticated physical accounts/devices: C01 request/accept → A opens/send/retries after lost ACK → B reads/restarts → A cannot impersonate B → block/revoke prevents new delivery → both read prior authorized history; offline, app switch, expiry, deleted account, RTL and low-memory Android. Capture traces and exact SHA/build/network evidence.
6. Recover shared CI incident #457/#460 with ChatGPT Work; do not override protection or conflate zero-step workflow failure with test result. Check any new compile/test failures first; draft until real green evidence.

**Operational rollback:** do not deploy this PR alone; disabling the route composition stops new DM traffic without rewriting C01 contacts. A validated migration is append-only; plan retention/backups, index monitoring, alerting and rollback with DBA before release. Never pretend SQL table existence proves capability availability.
