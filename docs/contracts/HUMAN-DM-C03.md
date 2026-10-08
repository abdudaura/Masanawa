# C03 — Authoritative human DM synchronization contract (draft)

**Status: source written; not deployed or end-to-end verified.** Requirement IDs M02/M06/M08/M10, N06/N08, Q06/Q08; J03/J04/J10/J11.

## Immutable boundaries

Human conversations/messages/reads belong to C02; contact consent to C01; private media to C04; protected local cursor/history/cache/outbox to C05. C03 writes **metadata-only** journal rows; no message bodies, text previews, tokens, contact book, public Talk or model context. A client's optimistic send is NOT a delivery receipt. PostgreSQL triggers create rows in the very transaction that commits a C02 write/read or contact/safety/account change.

Journal rows are scoped to each human member: one row per recipient, with a tenant/recipient/event ID index. A tenant-scoped transaction advisory lock precedes event ID allocation so delayed commits cannot make cursor queries skip events. Every read uses canonical authenticated owner/member, active account, reciprocal block, declined contact and platform safety restrictions. Access-invalidated events remain visible to the original member but never expose message contents; they instruct the app to discard/revalidate protected projections.

## Endpoint

GET /messages/sync?cursor=DECIMAL_BIGINT&limit=1..100&waitMs=0..15000

The Gateway uses the existing platform-session bearer authorizer, not client-supplied tenant or user IDs; no-store responses, reauthorization during waits, and stop-on-disconnect are required. Shape:

    {
      "events": [
        {
          "eventId": "202",
          "conversationId": "canonical-uuid",
          "kind": "message_added",
          "actorUserId": "verified-human-user-id",
          "messageId": "canonical-message-uuid",
          "messageSequence": "147"
        }
      ],
      "nextCursor": "202",
      "hasMore": false,
      "resetRequired": false
    }

message_added/message_changed/message_deleted carry canonical message ID and C02 sequence. read_changed carries server-committed reader high-water as messageSequence but no messageId. access_changed carries no message ID/sequence and must force fresh eligibility checks and cache invalidation; a contact permission update never itself delivers a message.

Omitting cursor requests first-session resetRequired=true: **fetch C02 inbox/history first**, not pretend events are full messages. Later polls supply the persisted cursor, including zero. A cursor is saved only after C02/C05 projections have applied all events; an uncertain send keeps the original C02 client request ID. Bound each server page to at most 100 events and each mobile pass to five pages of 50; remaining events resume next pass. Background/kill/weak network restarts from the last protected cursor.

## Integration owners

1. Gateway integration owner merges C01 #468, C02 #472, C03 and R18 #435 semantically, shares the existing pg Pool/customer-session authorizer and calls the C03 composition/route registrars. Apply R18 0015, C01 0016, C02 0017, C04 0018 (if present), C03 0019 in the reviewed manifest. Never install C03 against a missing C01/C02 schema.
2. C05 implements HumanDmRealtimeCursorStore against protected per-account indexed disk and HumanDmRealtimeProjection through genuine C02 inbox/history, read receipts, and revoke logic. Never trust an event as proof of send eligibility or cache membership. Test A→B, stale 401, block during sync and crash after event but before cursor save.
3. R17/C08 mounts authenticated human-only Chats, calls HumanDmRealtimeSync.runWhileForeground on deliberate foreground entry, stops it on sign-out/background/profile switch, and shows HumanDmRealtimeStatus (synchronized/retrying/stopped). Old /chats stays private AI, not human DM.
4. R14 receives only masked, verified recipient private-message push **hints after canonical C02 commit**, checks token/notification settings and mute, dedupes delivery, provides typed /messages/:conversationId links, and never includes plaintext DM bodies or changes read state. Push wake-up must fetch C03/C02 from server; this PR DOES NOT touch the R14 shared implementation.
5. Work/release runs real A/B device/network/idempotency/read/block/cursor gap/denied push/retention/privacy and Android evidence. No source file proves end-to-end success.

## C03 retention and expired-cursor recovery (0020 continuation, draft)

The dependent **0020_human_dm_realtime_retention.sql** migration adds tenant/member-scoped `human_dm_event_checkpoints`. Journal append and checkpoint tip update share the 0019 tenant transaction advisory lock; `talks.prune_human_dm_events(tenant,cutoff,batch)` shares that lock and atomically records each member's highest deleted event before removal is committed. The database itself rejects pruning anything within seven days and batches over 1,000; there is **no publicly callable HTTP purge route**. The separate `human_dm_realtime/retention_cli.ts` operator requires an explicit confirmation, a named tenant, reviewed DB credential and retention-days input (default 30, range 7–365), plus bounded batch/work limits. It does not run automatically on app boot or migrate. A deploy operator schedules it only after backups, restore rehearsal and privileges are qualified.

A previously persisted cursor **below** a member's `pruned_through_event_id` responds immediately with an empty reset page, `resetRequired:true`, and **nextCursor equal to the prune floor**, not to the latest tip (the latter could lose sends racing the user's C02 snapshot). An implausible far-future/member-mismatched cursor responds with the latest committed tip and mandatory reset. The C03 mobile coordinator must fetch a complete authenticated C02 snapshot first, discard stale cache entries according to C05's authority, save the returned cursor **only after the snapshot succeeds**, then resume from the checkpoint. A missing cursor already requests first-session C02 snapshot. A retained event never becomes message-body content in push or the C03 journal.

**Still blocked:** C01/C02 migrations are draft/conflicting, C05 protected durable cursor/snapshot implementation must honor reset-and-evict, Gateway routing is not registered while shared composition belongs to other owners, R14 push is independent, and no deployment cron/backup/restore/PG/Flutter/device verification has executed. The SQL function and operator are written, **not** evidence of an enabled or safely operating retention schedule. C03 remains `PARTIAL_IMPLEMENTATION`/DRAFT, not DONE. Compare C03 #473 and the continuation PR and do not merge `0020` before `0019` and canonical C02 reconciliation.
