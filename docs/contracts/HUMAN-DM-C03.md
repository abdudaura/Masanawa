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

## Remaining operational gate

An automatic retention/pruning job is **NOT** installed. A safe pruning worker must first record per-member trim high watermarks and make older cursors trigger a mandatory full C02 resnapshot, otherwise silent deletion can lose messages. The indexed journal grows until that work is qualified. Push, the final root router, and persistent cache adapters remain owned externally. Status is PARTIAL_IMPLEMENTATION / UNVERIFIED pending shared composition and actual tests; keep PR draft/unmerged.
