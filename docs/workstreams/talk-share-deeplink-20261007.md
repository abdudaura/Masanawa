# Talk sharing + deep links — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talk-share-deeplink-20261007`
Base: `25ef7be2cef9047c25696a30f5d918634a1e2f52`

## Scope

Complete the canonical **Share** audience control for live Talks and replays.

Owned paths:
- `apps/mobile/lib/src/core/shell_deep_link.dart`
- `apps/mobile/test/shell_deep_link_test.dart`
- `apps/mobile/android/app/src/main/AndroidManifest.xml`
- Talk Share additions only in `apps/mobile/lib/src/screens/talks/talk_screen.dart`
- focused Talk-screen tests
- this handoff

No Gateway mutation is required: a share link carries navigation only and the existing
authenticated `/talk/:id` route + Gateway Talk read remains authority.

## Contract

- canonical public URL: `https://masanawa.com/talk/<talkId>`;
- native share text contains Talk title, Host and canonical URL;
- incoming HTTPS or `masanawa://talk/<talkId>` validates the Talk id and resolves to `/talk/<talkId>`;
- no host/admin authority or query parameters are carried in a shared link;
- shared links wait through authentication via existing `PendingDeepLink` handling;
- malformed/foreign/credentialed/ported/query-bearing links are rejected;
- live and replay Talks use the same stable identity/link;
- current replay playback, Gift, Save and moderation behavior must remain unchanged.

Status: active.
