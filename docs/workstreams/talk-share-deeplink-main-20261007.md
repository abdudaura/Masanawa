# Talk sharing + deep links — reclaimed 2026-10-07

- Owner/window: current ChatGPT implementation window
- Branch: `work/talk-share-deeplink-main-20261007`
- Base SHA: `233ef88eaf55c8affbed4f0101a88afd175daca9`
- Reclaims stale PR #374 / branch `work/talk-share-deeplink-20261007`.
- Stale head: `eb2070728662625f9a17686650a21e095d1fe215`; last visible PR update 2026-10-07T11:16:10Z, beyond the 5-minute claim lease.
- Task: complete canonical native Talk sharing plus trusted Talk deep-link routing on current main.
- Exact owned paths:
  - `apps/mobile/lib/src/core/shell_deep_link.dart`
  - `apps/mobile/test/shell_deep_link_test.dart`
  - `apps/mobile/android/app/src/main/AndroidManifest.xml`
  - `apps/mobile/lib/src/talks/talk_share.dart`
  - Talk Share additions only in `apps/mobile/lib/src/screens/talks/talk_screen.dart`
  - focused `apps/mobile/test/talk_screen_test.dart`
  - this claim file
- No Gateway mutation: shared links only navigate; authenticated Talk read remains canonical authority.

## Implemented

- Canonical public URL: `https://masanawa.com/talk/<talkId>`.
- Native Talk app-bar Share action for both live Talks and replays.
- Share payload includes Talk title, human Host name and canonical URL.
- Uses current `share_plus` `SharePlus.instance.share(ShareParams(...))` API.
- System sharing is behind a tiny `TalkShareService` boundary for deterministic widget testing.
- Trusted HTTPS Talk links route to authenticated `/talk/<talkId>`.
- `masanawa://talk/<talkId>` is supported for app/internal links.
- Credentials, ports, fragments, query-bearing links, malformed Talk IDs and foreign hosts are rejected.
- Cold-start Talk links remain queued through the existing pending-authentication deep-link path.
- Android manifest registers verified `https://masanawa.com/talk/` app links alongside existing Twin links.

## Verification coverage

- Valid public HTTPS and custom-scheme Talk routes.
- Rejection of malformed/foreign/credentialed/ported/query-bearing Talk links.
- Cold-start Talk link waits for authentication and is consumed once.
- Live Talk Share emits exact title + Host + canonical URL.
- Replay Share uses the same stable Talk identity/link shape.
- Existing poll, question, gift, replay and save behavior remains on the same current-main Talk screen.

## Integration audit

- Branch was created directly from current main `233ef88eaf55c8affbed4f0101a88afd175daca9`.
- No Gateway/database migration required.
- The old PR #374 is superseded and should be closed once this current-main PR is opened.
- Android app-link automatic verification still requires `masanawa.com/.well-known/assetlinks.json` to contain the production signing certificate; the manifest change is ready but domain verification is deployment/release work.

## Status

- Implementation status: complete pending PR/CI evidence.
- Verification status: focused deep-link and Talk Share widget tests written; GitHub execution evidence pending.
- Deployment status: app-link domain verification remains release infrastructure work.
