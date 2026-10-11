# J07 / C39 — moderated Room discussion acceptance
Source owner: L-ROOMS, existing PR #625; exact root composition remains AF00.

## Connected journey and negative gates
1. Signed-in fan selects Rooms > joined profession Room > Discussion, selects a published Lesson or an accessible Question.
2. GET discussion repeats tenant, session, membership, Room publication and paid entitlement for every read/page. Visible replies display; fan sees only their own held replies.
3. Fan writes with Idempotency-Key. POST saves one held row and audited creation. Replay returns the same result; mismatched body/target returns 409.
4. Staff moderator reviews in Android Admin A10. Approve updates the held row, records audit and queues canonical events.outbox notice to eligible parent question/thread subscriber (not a private DM). Hide/remove never notifies.
5. Fan refreshes and sees approved reply; one-level child reply under a visible top-level reply is allowed. Mismatched parents denied.
6. States include empty, offline retry with retained draft, feature disabled, 401 re-login, 403 expired entitlement, account switch (clear stale projection), optional Gwani report callback and paginated reply list.
7. Server denies nonmembers, fan staff review, human messaging, impersonation, foreign tenant, unpublished source, and unqualified paid Room.

## Integration and release qualification
- New discussion routes are default OFF. AF00 must compose the existing actor resolver, no second session.
- AF00 registers migration 0003 after Rooms 0001+0002; PG18 empty+upgrade+restored backups, historical checksum preservation.
- AF00 wires PG store, the existing events.outbox notification job, role checks and shared Dio consumer/Admin routing. No new store.
- Run scoped TS/Vitest, PG18 real transaction/replay/cross-fan, both Flutter apps analyze/widget, APK/low-end-device and notification/rollback on the same integration SHA.
- Old Talk/DM entrypoints retire only after dependency scan. Financial history untouched, no main/Railway deployment or paid activation.
