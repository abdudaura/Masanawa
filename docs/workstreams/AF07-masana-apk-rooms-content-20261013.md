# AF07 — 26 educator Room lessons and independent handset APK acceptance

Base main: `8cc8086738cc682cbad84433c99ffcb69fee72b3`.
The production Gateway bootstrap from #722 already creates 26 platform AI identities, original vector portrait/banner pairs and a free Room each. The follow-on source here makes each Room immediately useful:
- Every agent receives two **substantive, subject-specific, originally written lessons** (an introduction and an exercise). There are 52 prepared contents, including Arabic right-to-left script, Hindi Devanagari, and Mandarin characters.
- All are published through the existing `rooms.lessons` table and normal account-bound `/v1/rooms/:id/lessons` endpoint, in the same transaction as Room creation. The IDs are deterministic. Retries and restarts do not duplicate or overwrite staff-created lesson texts. Account/tenant and paid subscription protections are unchanged.
- The pre-existing staff/editor authentication applies only to subsequent manual publishing; no manual review is needed for platform-owned initial content or ordinary student questions.
- A new Android compilation workflow attempts a **real APK**, stores it as a GitHub Actions artifact, and runs 26-packaged-avatar and Room test suites. It does not hide whole-project analyzer debt: the existing `mobile-build.yml` continues running the full analyzer independently and can remain red until that pre-existing backlog is repaired. The APK is **debug-key-signed release mode for handset tests**, not certified for Play Store upload.
- Live calling depends on the production Gateway's actual Gemini Live credentials and provider token calls. An APK build alone cannot make offline Railway services online.

Current deployment audit 2026-10-13: Railway project `empowering-education` production has five services in offline state, including mounted PostgreSQL, `masanawa-gateway` with a failed old source build, and obsolete old `Baatiku/masanawa` billing proxy worker. No production migration or service recovery is claimed here. Do not delete/recreate the existing Postgres volume or replace the billing relay.

Acceptance: `.github/workflows/masana-roster-integration.yml` real PG18 catalog tests, Gateway and Worker production builds; `.github/workflows/masana-android-apk.yml` portrait tests and Android APK artifact. Document exact job results and build signing mode. AF10 separately owns the live membership/Room UI files; this branch intentionally has no exact path collisions.
