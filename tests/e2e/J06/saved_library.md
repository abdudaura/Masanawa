# J06 / C25 Saved library — SHA-scoped acceptance

The same **fan/private** read path covers saved Masana feed posts and **official verified** video items. Existing `feed.saves` is the only post-save authority; the additive `feed.saved_videos` is the video relationship, not a duplicate media store. All video playback retains provider controls; video save never fetches media bytes.

## Exact composition owned by AF00 / L-VIDEO
1. Register `packages/feed/migrations/0003_saved_videos.sql` *after* feed 0001 and external-videos 0001, review checksums and run PG18 **fresh + upgrade + restore**; never run on live finance DB.
2. Inject `new SavedLibraryService(new PgSavedLibraryRepository(pool))` once into `registerSavedLibraryRoutes` with the real server-session `principal`, trusted tenant and existing default-off feed flag. No new auth/ledger.
3. Wire `MasanaSavedScreen` from Account → Saved using existing authenticated Dio and the signed-in account key. L-VIDEO supplies video saved-state hydration and embeds `SavedVideoToggle` on its existing C27 cards; do not edit L-VIDEO's paths concurrently. Preserve old C21 save action (same `feed.saves`).
4. No new scheduled worker is necessary: read filtering hides withdrawn/unverified videos and no historical saved rows are deleted. Existing external-videos reconciliation owns provider unavailability.

## Check on one pinned integrated SHA
- Fan A saves a published post and approved provider video. A sees both in Saved; fan B and tenant B see neither. A unsaves; second unsave is idempotent. Same video pending/hidden/unavailable cannot be saved.
- Once post unpublished, author revision revoked, or video hidden, Saved does not surface it; reinstatement shows it without loss of historical user preference.
- Paginate 21+ same-timestamp mixed items in descending (saved_at,kind,id) without duplicate/skipped ID.
- Deny anonymous (401), Masana/staff (403), cross-tenant (403), malformed cursor/UUID/state (422), and feature disabled (503). Switch account mid-load and mid-write; no cached data or async reply leaks.
- Offline read shows same-account previously loaded items and retry; account switch clears them. Android 200% text scale and Hausa language; launch an official player, not a copied MP4.

## Execution ledger
- PostgreSQL18: NOT_RUN (no PG18 instance/checkout in current connector-only environment).
- Full TypeScript / Vitest: NOT_RUN until workspace importers installed / actual CI on branch verified.
- Flutter analyze/test and Android APK: NOT_RUN (Flutter/Android SDK absent here).
- Provider acceptance + real device: NOT_RUN. No migration or payment activation.
- AF00 must report pinned commands and restore/rollback before qualifying the release.
