# AF09 — Published Talks feature navigation / creator listening handoff (2026-10-10)

**Parent:** Published Audio Talks (UX-A08/A09), existing [draft PR #609](https://github.com/Baatiku/masanawa/pull/609), branch `work/af09-published-audio-20261010-gpt6`. **Base main observed:** `7c443966be97e9092cbc1fb98562c75253434326`. Refresh PR head after concurrent writers; no competing feature PR or integration branch was created. **Source state: IMPLEMENTED_UNVERIFIED in isolated AF09 feature; parent milestone PARTIAL_IMPLEMENTATION, NOT INTEGRATED, NOT DEPLOYED.**

## Connected customer increment

The existing published feed displayed a non-navigable creator ID despite an implemented, authenticated creator-profile client. New `PublishedTalksDestination` connects **Discover/Following/Saved/My Talks → creator link → canonical creator profile → published creator Talk → authorized, controllable audio detail**, and **Talks → Create Talk → durable publish/receipt → refresh server feed without resetting the feed tab/scroll**. Unlike a feature-mock demo, it reuses the actual existing `AudioPostTransport`, `CreatorProfileTransport`, `AudioPostPlaybackController`, `TalkPublishAttemptStore` and optional `CreatorFollowingTransport`. No duplicate API or playback authority.

The creator link only appears on a published post when the real creator transport is injected; other authors/post statuses and unconfigured routes never receive fake links. Playback never starts on navigation, never renders a private signed URL, uses existing AF08/AF15 session/host-fenced ticket controller and is stopped when the detail route closes/loses its account binding. The feed remains mounted behind the route, retaining its scroll/tab and account-scoped cache; only a confirmed composer receipt issues a server refresh signal. Posting remains disabled if AF05/AF15 verified recording/upload is not injected. Reports and Following are opt-in **only after AF00's real authenticated routes are registered**.

**Exact scoped files / source commits**
- `apps/mobile/lib/src/audio_posts/audio_post_feed_screen.dart` — `0cdc3e1b5d32142177837c5341d70ccbca510e10`: creator entry and receipt refresh signal.
- `apps/mobile/lib/src/audio_posts/audio_post_destination.dart` — `9a9858235af8c540e8f83cbdeb456abc2a2795cf` and `27c55609bbf71f24cfbb399db48bc92a645fec32`: feature-local feed/composer/profile/detail routing, existing dependencies only.
- `apps/mobile/lib/src/audio_posts/audio_post_detail_screen.dart` — `c889bfa9892c8e3eb58245c6e86bafd45ebf60ee` and `00e34ccd8faf43a2bb3fed6b58e50400436b780f`: explicit signed playback and disposal/account stop.
- `apps/mobile/test/audio_first/af09/destination_test.dart` — `6b817d12da8495c8045d714aea5787c495fb147e`, `210948d74e43ec6788961eaf4cca6058b2d11027`: creator profile, no fake links, publish-receipt refresh, creator→detail→player journey.
- `apps/mobile/test/audio_first/af09/detail_test.dart` — `48510677b989cec195ee69bf0584ab844d722172`: explicit start, navigation teardown, unauthorized denial.
- This finite source-closure checkpoint. Lease: `af09-609-creator-navigation-20261010-gpt6-0517` on `factory/claims`, exact paths acquired/read back, to be released with SHA-specific handoff.

## Whole Published Audio Talks finite source closure

| ID | Required source / exact owner | Current source state | Execution/integration |
| --- | --- | --- | --- |
| AF09-01 | Post/reaction/comment/delete/receipt contracts + authenticated route modules `services/gateway/src/audio_posts/{contract,service,routes}.ts`; AF09 | IMPLEMENTED_UNVERIFIED isolated | Gateway shared route mount MISSING; real Fastify/PG tests NOT_RUN |
| AF09-02 | PG feed/saves/counts/comments/follow/creator and idempotent publication `adapters/storage/postgres/src/audio_posts/**`; AF09 | IMPLEMENTED_UNVERIFIED isolated | Real multi-tenant PostgreSQL tests NOT_RUN |
| AF09-03 | Mic permission, capture/preview/trim, account-owned verified upload/recovery; AF05/AF15 canonical media paths | MISSING connected source | AF05/AF15 implement; Android and object-readback NOT_RUN |
| AF09-04 | Feed/cache, creator, comments, saved, following, reporting, recovered composer; `apps/mobile/lib/src/audio_posts/**`; AF09 | IMPLEMENTED_UNVERIFIED; creator navigation/detail now added | Flutter analyzer/widget test NOT_RUN |
| AF09-05 | AF08 authenticated actor/privacy/visibility/media+all post/follow/creator/playback/report Gateway bindings `services/gateway/src/{app,main}.ts`; AF00 | MISSING shared composition | Must implement + real auth/tenant/blocked tests |
| AF09-06 | Numbered append-only `database/migrations/**` install for post/social/reaction/comment/follow/queue; AF00 | MISSING shared migration allocation | Disposable PG migrate/concurrency/restart NOT_RUN |
| AF09-07 | Private signed streaming/focus/revocation + *trusted* listen count; AF05/AF15+AF09 | Ticket/player/detail isolated; missing verified end-to-end media and real listen events | Provider/object/device tests NOT_RUN; do not count ticket issuance as listen |
| AF09-08 | Durable publication moderation processor+PG queue `services/gateway/src/audio_posts/processing_worker.ts` and AF00 `services/worker/src/main.ts` | Isolated queue/worker PARTIAL; shared worker registration MISSING | Restart/race/replay real PG tests NOT_RUN |
| AF09-09 | Canonical TalkSafety report action + trusted target resolver; AF09 source and AF00 routes | AF09 UI/service IMPLEMENTED_UNVERIFIED; AF00 mount MISSING | Report negative/privacy checks NOT_RUN |
| AF09-10 | Client `PublishedTalksDestination` feature navigation, creator→detail listen, composer receipt refresh; AF09 | IMPLEMENTED_UNVERIFIED at this claim; feature-local entry available | New widget tests AUTHORED NOT_RUN; AF00 must mount into Talks |
| AF09-11 | Talks center/default in shared five-tab shell, `apps/mobile/lib/src/screens/twin/twin_home_shell.dart` and route wiring; AF00 | MISSING AF09 mount | Existing root-nav PR may be an input, not integration proof |
| AF09-12 | Actual two-account capture→upload→publish→process→feed→play/follow/comment/report/delete; AF09/AF05/AF13/AF00 | MISSING connected E2E source + tests | Qualified device/storage/session testing NOT_RUN |
| AF09-13 | Single audited **non-deploying** reviewed integration SHA, #497/local APK reconciliation; AF00 | NOT INTEGRATED | Do not merge into potentially auto-deploying main or request local pull |
| AF09-14 | Account-scoped encrypted publish attempt, read-only receipt recovery, correct microsecond feed/follow pagination; AF09 | IMPLEMENTED_UNVERIFIED or narrow SOURCE_CHECKED_ISOLATED on prior #609 commits | Full exact-head Node24/PG/Flutter execution NOT_RUN |

These entries replace no other owner's claim. AF00 owns protected root, Gateway factories, numbered migration and worker registration; AF05/15 owns real media capture/object transport/focus. The feature widget expects those canonical already-registered adapters; it is **not a claim that uploads or Gateway routes currently work**.

## Verification, blockers and next commands

At this window's runtime, `node --version` = **v22.16.0**; `pnpm`, `dart`, `flutter` and `psql` commands are not installed. `git ls-remote https://github.com/Baatiku/masanawa.git refs/heads/work/af09-published-audio-20261010-gpt6` failed `Could not resolve host: github.com`. GitHub connector source writes/readback are not an executable Flutter build or proof of navigation behavior.

**AF13 / qualified Flutter runner**, against the final exact #609 SHA, must execute:
```sh
cd apps/mobile
flutter pub get
dart format --output=none --set-exit-if-changed lib/src/audio_posts/audio_post_destination.dart lib/src/audio_posts/audio_post_detail_screen.dart lib/src/audio_posts/audio_post_feed_screen.dart test/audio_first/af09/destination_test.dart test/audio_first/af09/detail_test.dart
flutter analyze lib/src/audio_posts test/audio_first/af09
flutter test test/audio_first/af09/destination_test.dart test/audio_first/af09/detail_test.dart test/audio_first/af09/feed_test.dart test/audio_first/af09/creator_profile_test.dart test/audio_first/af09/playback_widget_test.dart
```
**AF13 / capable Node24/PG runner** at the same source SHA: `pnpm install --frozen-lockfile && pnpm -r typecheck && pnpm --filter @masanawa/gateway test` and disposable-PostgreSQL migration, visibility, idempotency, moderation and worker recovery tests. If a test fails, repair **source** on existing #609 before integration; do not hand missing code to local APK owners.

**AF00 exact-path composition transfer:** inject AF08 account-isolated session resolver, AF09 post/follow/creator/report/playback routes and AF15 verified object signer into `services/gateway/src/{app,main}.ts`; allocate/install numbered append-only DB migration in `database/migrations/**`; compose trusted moderation/startup in `services/worker/src/main.ts`; mount `PublishedTalksDestination` in Talks center/default `apps/mobile/lib/src/screens/twin/twin_home_shell.dart`, passing real session callback, post/profile/follow/report services only after API registration, shared-focus playback controller and AF05 verified-media acquisition, while preserving previous local-only edits. AF00 must publish the one reviewed safe integration target and tested SHA, without implicit production deployments.

**Next actual work:** AF05/AF15 implement and qualify microphone/verified private upload and ticket streaming; AF00 closes missing integration source; AF09 follows through on trusted listen counting and playback states only using actual media provider callbacks, not client-claimed play counts; AF13 executes the above, resolves real failures and captures device/product evidence. **Do not request local pull until all required source and shared composition are complete remotely.**

## Account-bound nested navigation follow-up

After the feature destination was introduced, same-PR commits `7b434361e0677596c68acd902becf6d4e7f2a4ac` and `c1da60a937b61ede364d15c7e1c9963c8e8b091a` added explicit tracking of creator/composer/detail routes and close those feature routes upon a replacement account/session transport. One additional authored widget case at `a30d9b13c4e8b44abc77e1452ce56001b0606ebd` exercises account A → creator profile → account B and checks that account A's nested profile is gone. The route future is normalized to `Future<void>`; no Flutter runtime validation was possible, so this increment remains **IMPLEMENTED_UNVERIFIED** and AF13 must run the exact-head commands above. AF00 must preserve this account fence when embedding the feature in the shared shell. Don't count this feature-local source as a mounted production destination.
