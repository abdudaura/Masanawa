# C02 — Authenticated human 1:1 message contract

Status: source implementation on draft branch; **NOT production operational or end-to-end verified**. Mandatory crosswalk C01/C02/C03/C04/C05/C08; J03/J04/J10/J11.

## Identity and permissions
- Human IDs are verified `tenantId,userId` from the existing platform bearer authorizer. The client cannot set sender or tenant. UUID conversation references are different from AI-character IDs, Talk IDs and financial receipts.
- Requires migration `0016_human_messaging_contacts.sql` (draft C01 #468), then `0017_human_dm_core.sql`. A new direct conversation is only allowed with an active other user with C01 accepted consent OR recipient's current 'anyone' preference, provided there are no reciprocal blocks, declines or platform restrictions.
- Every list/history/send/edit/delete/read checks active membership, revoked contact requests, reciprocal block and platform profile restrictions. Send additionally checks **fresh** consent, and an established receiving user's reply is allowed unless the pair is explicitly declined.
- The server returns 404 for unavailable/non-member threads to limit enumeration. At no point does the app trust a visible handle, cached contact, local senderId or model permission claim.
- A hard limit of 30 newly sent text messages per rolling minute per sender, serialized under database user lock. All sender rate caps and idempotency checks happen in the same transaction. Raw DM text is not sent to stage/public event/push or agent context.
- Text is limited to 4,000 Unicode code points and 16,000 UTF-8 bytes, with NUL rejected. Stored as private UTF-8 plain text; server does not claim E2EE.

## REST v1 on the existing Gateway
| Method | Route | Body/query | Success |
| --- | --- | --- | --- |
| POST | `/messages` | `{otherUserId}` | 201 `{conversationId}`; safe repeated open |
| GET | `/messages` | `?limit=40&before=<sequence>` | `{conversations:[{conversationId,otherUserId,otherDisplayName,otherAvatarUrl,lastSequence,preview,updatedAt,unreadCount}]}` |
| GET | `/messages/:conversationId` | `?limit=40&before=<sequence>` | `{messages:[...],nextBefore}` newest-first |
| POST | `/messages/:conversationId` | `{clientRequestId,body}` | 201 committed canonical `HumanDmMessage` |
| PATCH | `/messages/items/:messageId` | `{body}` | sender-only edit within 15 min |
| DELETE | `/messages/items/:messageId` | none | sender-only tombstone, repeat-safe |
| PUT | `/messages/:conversationId/read` | `{throughSequence}` | server-clamped monotonic `lastReadSequence` |

Canonical message fields: `messageId,conversationId,sequence` (decimal string), `senderUserId,clientRequestId,body` (null if deleted), `createdAt,editedAt,deletedAt`.
Sequence is DB-generated and globally monotone; idempotent resend with same ID and same original body returns the same stored message even if it was edited/deleted, while reused ID with a different body is 409. **201 means persisted; it is not recipient delivery or read confirmation**. C03 later implements realtime/push/offline resync, and C04 defines voice/media attachments; these cannot be inferred from a successful C02 send. Client request ID must survive retries. C05 owns persistent protected local outbox.

## Error and operational behavior
- Existing Gateway error envelope maps validation to 400, missing permission to 404, request collision to 409, rolling cap to 429, expired sessions to 401.
- SQL uses tenant composite keys/FKs, unordered unique human pair, transaction locks for simultaneous send and exact retry, index-backed newest-first keyset queries and monotone read cursor. Migrations are additive, do not overwrite an applied migration, and should be audited on a real Postgres instance.
- C02 does not own `app.ts`/`main.ts` registration due to C01 #468 and R18 #435 overlap. Composition must be added **after semantic reconciliation** (and never expose UI before service is actually registered); C08 owns root `/messages` routes in Flutter.
- Status: SOURCE_WRITTEN only; LOCAL_TESTED/DB_INTEGRATED/APP_INTEGRATED/CI_EXECUTED/DEPLOYED/DEVICE_VERIFIED = NO evidence. Work handoff in `docs/workstreams/communications-core-c02-20261008.md`.
