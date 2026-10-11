# C10 server-backed Chats list — qualification checklist

Scope: L-CHAT C10, built on canonical J03 #635. This source adds
`GET /v1/chats`, `PATCH /v1/chats/:characterId` and
`POST /v1/chats/:characterId/read`. AF00 must mount them once with the same
signed-in `resolveFan` as J03. Existing `agents.character_sessions` and
`agents.mobile_turn_commands` stay the only session/message journal.
The only new SQL is versioned `masana.fan_chat_preferences`.

On a disposable PG18 fixture after registering the existing Masana migrations:

1. Fan A opens two eligible Masana conversations; both appear on C10.
2. Fan B in the same tenant sees neither; cross-tenant A also sees neither.
3. Draft, retired, human or non-platform characters never appear; attempted
   pin/read does not create a preference for them.
4. Completed replies appear as private previews and unread counts. Pending
   turns are not falsely counted as unread. Mark read removes previous unread.
5. Pin uses an expected-revision CAS: repeat/stale revision is 409. Sorting
   places pinned first, then newest. Search checks name and profession.
6. Offline C10 keeps the last account-fenced cache. Failed mutation leaves
   server-authoritative pinned state unchanged and retry is available.
7. Account switch drops in-flight results, selected search and cached view.
8. Simulate session expiry and revoked authorization: 401/403, not another
   account's inbox. Reload following character retirement hides the row.
9. Run TypeScript/Vitest, PostgreSQL fresh+upgrade+checksum, Flutter analyze
   and widget tests, Android device J03/J04 regression and retention checks.
   These steps are NOT_RUN unless an actual runner result is recorded.

No LiveKit/voice note, production authorization, migration application,
provider activation or Railway-linked main merge is claimed by this file.
