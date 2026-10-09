# F17 — bounded private voice playback transport recovery

Updated (UTC): 2026-10-09T04:06:28.153Z; owner/window: GPT-6 F17 mobile-transport continuation
Status: PARTIAL_IMPLEMENTATION, DRAFT / NOT MERGED / NOT DEPLOYED.

## Five-minute exact-path claim
- Canonical PR: https://github.com/Baatiku/masanawa/pull/478; existing source HEAD inspected: f0d67698782002f292a1ba744a5430c5d7371bab, last update 2026-10-09T03:03:58Z (stale over five minutes at claim).
- Latest main inspected: 5e758673ae91082520b21b3153da53791ae2cbf3. Keep existing #478 branch and earlier implementation, no clone or second media schema.
- Exclusively owned: `apps/mobile/lib/src/human_media/human_voice_transport.dart`, `apps/mobile/test/human_media_transport_bounds_test.dart`, `docs/workstreams/f17-voice-transport-streaming-20261009.md`. No shared auth client, router, native configs, Gateway composition, DB registry, financial code, or production writes.
- Task: fail-closed, bounded streamed download for private voice on low-memory Android, content-type/size enforcement and session switch guard for DELETE; add adapter-backed transport tests. Preserve idempotent upload, bearer retry behavior and current DTO.
- Relevant: F17/C04; M03/M04/M10, J04/J11. Depends on C01 #468; C02 #472 vs #475; C03/C05; C08/F12 and Work #497.
- Lease: refresh/recheck latest PR activity before writes and at handoff; no competing active claim seen on these exact paths.

## Checkpoint and final handoff
Source/tests have **not** been edited or executed at this claim point. Follow-up commits and PR description must distinguish authored tests from executed tests; known Actions #457 zero-step budget blocker and unavailable Flutter SDK/device/real DB/S3 remain. Existing PR remains DRAFT.
