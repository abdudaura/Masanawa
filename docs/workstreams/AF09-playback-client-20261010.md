# AF09 — published Talks authorized playback client (2026-10-10)

**Parent milestone:** Published audio Talks, UX-A08/A09 and UI-04. **State:** PARTIAL_IMPLEMENTATION; mobile player and media delivery are NOT device- or production-qualified. This continues existing PR #609 at https://github.com/Baatiku/masanawa/pull/609 with its existing branch and preserves earlier processing, following, comments and feed changes.

**Fresh main:** c7f7280e640d3098be3e26f05149a0d66085441b. **Previous PR head:** 3cfc9c5c42957f921d2adfd74ae334a205a1597a. **Branch:** work/af09-published-audio-20261010-gpt6. **CAS claim:** af09-609-playback-journey-20261010-gpt6-0338, published/read back on factory/claims. **Implementation commits:** 52877e9, 1c5eb35, 46f1232, 378c82b, ea9ce13, 8f67846, 564b1d8 and b62119b (see live PR HEAD for exact final SHA).

## Exact owned paths

- apps/mobile/lib/src/audio_posts/audio_post_playback.dart (new)
- apps/mobile/lib/src/audio_posts/audio_post_feed_screen.dart (continued)
- apps/mobile/test/audio_first/af09/playback_widget_test.dart (new)
- docs/workstreams/AF09-playback-client-20261010.md (this file)

No shared router, auth, native configuration, database migration registry, Gateway composer, server media or financial authority edited.

## Connected source

Listen on published Talks now supports authenticated GET /audio-posts/:postId/playback via the existing ApiClient, ticket host/expiry validation, one just_audio player per active feed, actionable Listen/Loading/Stop/error controls, no autoplay, and cancellation on account/feed changes, refresh and disposal. Signed URLs are never put in widgets, persisted or logged. In-flight tickets are fenced after logout/switch or same-account session/token rotation. HTTPS must match the AF15 configured trusted media host, with no userinfo/fragment/custom port, and 5–60 seconds remaining. A fresh ticket is requested on retry.

Existing just_audio and audio_session packages are reused without adding another signer. Native errors and completed playback reset listening state. AF05 must review app-wide audio focus/interruption/call coexistence; this is not yet a qualified unified player. Client-created media paths and unverified assets remain forbidden.

Six widget/unit tests are authored for trusted vs foreign/expired URL, Listen/Stop, account-switch in-flight cancellation, same-account authentication-token rotation, error/untrusted ticket retry, and non-published/unauthorized refusal. Test ticket callback is injectable in tests only; production always uses the authenticated Gateway.

## Executable evidence and exact blockers

**NOT_RUN:** cd apps/mobile && flutter pub get && dart format --output=none --set-exit-if-changed lib/src/audio_posts/audio_post_playback.dart lib/src/audio_posts/audio_post_feed_screen.dart test/audio_first/af09/playback_widget_test.dart && flutter analyze lib/src/audio_posts && flutter test test/audio_first/af09/playback_widget_test.dart test/audio_first/af09/feed_test.dart

Reason: execution container has Node 22.16 and git, but no Dart/Flutter, no private repository checkout, and direct git ls-remote cannot resolve github.com. Authored tests are not runtime passes. Do not substitute static readback for Dart execution.

**NOT_RUN:** real AF08/AF15/AF09 route composition, full Gateway typecheck/Fastify tests, PG migration, private object access, signed URL expiry/range behavior across three-minute audio, Android focus/calls, two-account revoked/removed playback and local APK. Previous GitHub Actions checks ran zero test steps; Vercel reported build rate limit, not code-test results.

**Merge held:** Existing PR #609 remains draft and unmerged. AF00 has not confirmed one reviewed nondeploying baseline nor reconciled user-local APK/source; main could trigger automatic deployment. Do not merge into production-connected main or call the playback functional end to end without these gates.

## Named execution transfer

**AF00 integrator:** Elect the sole safety-reviewed nondeploying baseline; preserve #609 entire feature history and prior #497/local source. Mount AudioPostFeedScreen at Talks with AudioPostPlaybackController constructed using current AF08 session/account fencing, existing ApiClient, AF15-configured signer host and AF05-approved audio-output lifecycle. Register AF09 post/playback/following APIs against the real repository, authenticated actor and PostVisibility. Allocate reviewed migrations under the canonical migration registry. Run exact-head repository tests before nondeploying source merge.

**AF05/AF15:** Wire a verified recorder/upload adapter to existing composer; integrate shared media focus/interruption and signed private URLs; qualify revoked/deleted/blocked post access, range buffering and expiry in real handset playback. Never trust a client asset URL or leak signed ticket.

**AF13 or capable local runner:** Check out the latest #609 SHA, run the commands above and the Gateway, PG, cross-account, real object and device tests. The owner's Flutter-enabled Windows checkout can execute blocked Dart tests; record exact versions and results before merge/rebuild.

**AF09 feature owner:** Continue the publish-processing-feed-listen customer journey, repair demonstrated source failures and reconcile current AF00/AF05 ownership. This player increment is not whole milestone completion.

No live deployment, payment, destructive migration, provider call or APK rebuild occurred.
