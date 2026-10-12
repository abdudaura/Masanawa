# C38 Saved Lessons — source and release acceptance

Reuses J07 canonical Rooms API, Rooms PostgreSQL data, fan session and J08
server-verified Play entitlement. No new worker, receipt, payment, or notification
authority is required for a fan-private bookmark write. AF00 alone composes the
separate bookmark routes, migration and Flutter route.

1. Signed-in fan joins free Room and opens Lessons. Lesson IDs are stable,
   with Bookmark and Saved lessons actions. Save and remove use the same
   natural-key write and authenticated session. Repeated Save leaves one row.
2. Restart / revisit lists the same saved published lessons. Retired or
   future-scheduled lessons do not disclose content.
3. For paid Room, remove entitlement or expire its period between views.
   Both canonical lesson GET and saved-lesson GET deny and the Flutter screen
   drops previously shown content. Server-side POST save also denies.
4. A fan who left or was banned cannot GET or save protected lessons. Removal
   of a private bookmark pointer remains allowed even after entitlement loss.
5. Fan B or tenant B cannot read, write or remove fan A's bookmarks, including
   forged identity fields on the API request. Anonymous and retired-feature
   requests deny without touching SQL.
6. Offline request shows Retry; never displays cached protected lesson content.
   Switch account while a GET/DELETE is in flight and discard stale completion.
7. PostgreSQL18 fresh+upgrade+checksum+restore, Vitest route/PG security,
   Flutter widget tests and Android low-end E2E must execute at the integrated
   exact SHA before C38 is called verified/released.

AF00 composition: Register `0004_saved_lessons.sql` after Rooms 0001-0003,
create `createPgRoomBookmarkStore(existingPool)`, mount
`registerRoomBookmarkRoutes(app,{authorize:canonicalRoomsAuthorize,store,enabled:flag})`
exactly once, wire signed-in Dio/account epoch into `RoomHomeScreen.savedLessonsClient`
and do not activate before migration qualification. Keep feature default OFF.
