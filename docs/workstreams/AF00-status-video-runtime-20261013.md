# Status audio, official Videos and PostgreSQL composition — 2026-10-13

PR #702 on base main 19056110f5bd5ba24b5efba9339b06280ca5dd71 reuses AF00 source 1481305f3f8963b33ef462188361ba67c9666d01 and Video PR #699.

Updates and Videos live in the existing Status tab, preserving five main tabs. Approved video metadata is read with the same authenticated Dio client and tenant-scoped PG store; every playback rechecks live approval and uses the provider's official embed. Editing requires server-owned staff principals, never a client role header.

Masana feed now has Gateway session composition and the existing PostgreSQL feed, moderation, editorial and scheduled-job source. Forward-only migrations add feed, Masana, Rooms, external video and a real rights-cleared audio category in Masana character_media. Typed original-image/audio object lookup rechecks tenant, author, published post, actual kind, media rights and object identity. Signed grants are 120 seconds and require exact approved HTTPS S3 origin and valid file type and size.

**Configuration before live release**: Set all MASANAWA_STATUS_MEDIA_S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY and DOWNLOAD_ORIGIN env suffixes together in secure deployment configuration; ensure the same canonical Masana media catalogue is populated and audio uploads are approved with rights evidence. Do not point these at a Talk replay bucket or create a second ledger/catalogue. Missing configuration correctly denies media grants.

Core manual video review/list/availability is connected. Automatic YouTube subscription/webhook+worker activation, autonomous Masana publishing admission and live Android audio-focus/call qualification are *not* enabled by this source. They require real provider permission, trusted server Masana authentication, disposable PostgreSQL18 tests, and signed device evidence. Existing Foundation CI stops at unrelated old TalkId TS2459; no test proof is inferred.

Paths claimed by af00-j06-j07-c10-20261013 after transfer of shared app.ts/main.ts. No destructive finance migration, historical auth edits or duplicate media authority.
