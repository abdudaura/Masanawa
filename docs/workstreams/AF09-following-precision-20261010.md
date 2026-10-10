# AF09 Following and creator-feed precise paging — 2026-10-10

**Parent customer milestone:** Published audio Talks (UX-A08/A09, UI-04/UI-07), existing [PR #609](https://github.com/Baatiku/masanawa/pull/609), not a new PR or milestone close. **State: PARTIAL_IMPLEMENTATION / IMPLEMENTED_UNVERIFIED** for this increment; entire feature remains unintegrated, not deployed or verified E2E.

**Owner/claim:** AF09 PR #609 GPT-6 continuation, registry claim `af09-609-following-precision-20261010-gpt6-0435`, published and read back on `factory/claims`. Base main observed `7c443966be97e9092cbc1fb98562c75253434326`; source PR base is older, reread PR HEAD before integration. Existing receipt, feed cache, composer, processing, root and media ownership preserved.

## Source closed in this continuation

- `adapters/storage/postgres/src/audio_posts/following_repository.ts`: Both **Following** and **Creator profile** queries now sort by exact PostgreSQL `p.created_at` plus `post_id` and expose a canonical UTC six-microsecond SQL `cursor_time`. The keyset is carried in bounded, validated, canonical base64url JSON, never reconstructed from pg's millisecond-rounded Date. Hidden/blocked author scans advance through the last examined source row. Invalid SQL cursor aliases fail closed. No new DB schema or duplicated feed authority.
- `services/gateway/src/audio_posts/following.ts`: Both established service endpoints pass opaque cursors through and map only recognized repository malformed-cursor to typed `VALIDATION` (400), invalid-row to `CAPABILITY_UNAVAILABLE` (503). Actual PG/policy outages propagate rather than becoming false 404/empty feed. This replaces the previous `milliseconds:postId` protocol **on as-yet unintegrated AF09 source**; no live deployed cursor migration is claimed.
- `adapters/storage/postgres/src/audio_posts/following_repository_pagination.test.mjs`: Six Node tests authored for exact same-millisecond ordering, creator/following pagination, hidden author, malformed/noncanonical cursor, bad SQL alias, and tenant/author scope.
- `services/gateway/src/audio_posts/following.test.mjs`: Three service tests authored for opaque cursor forwarding, typed error boundaries and nondisguised DB errors. Existing tests preserved. Dart Following and CreatorProfile transports already pass the returned cursor opaque; no AF00 root or owned Flutter paths edited.

Commits on same PR: adapter `ae92f1708eef90e6de50a26591bf3738cc88a7c6`; cursor contract `d85f7b59e19926ddb3f2fd928f491a531cc618b1`; adapter tests `99ad2988ef338d1864e3fca07628e4b7504d8ac7`; error mapping `ad8bfc987c4887a8dc78cdf4a22f7cf7b20f1720`; service tests `1c9d6f42f7c0414ca7712d9206ac0d8d39eafff6`. **Final shared branch SHA must be re-read**.

## Finite customer milestone source closure

| ID / required source | Source state | Owner / next action |
| --- | --- | --- |
| AF09-01 post/comment/like/save/delete/feed and tenant visibility `services/gateway/src/audio_posts/{contract,service,routes}.ts`, `adapters/storage/postgres/src/audio_posts/repository.ts` | IMPLEMENTED_UNVERIFIED | AF09 existing PR; AF13 exact-head executable Node/PG checks |
| AF09-02 Following and Creator page keyset `following.ts`, `following_repository.ts`, two tests above | IMPLEMENTED_UNVERIFIED (this increment) | AF09 committed source; AF13 real PG/Node test and review new cursor format |
| AF09-03 composer, durable account-scoped publish attempt and receipt `apps/mobile/lib/src/audio_posts/{audio_post_composer_screen,audio_post_draft_store,audio_post_transport}.dart` | IMPLEMENTED_UNVERIFIED / ongoing parallel same PR | Existing AF09 claim holders preserve their work; AF13 Flutter tests |
| AF09-04 signed playback ticket and client player `services/gateway/src/audio_posts/playback.ts`, `apps/mobile/lib/src/audio_posts/audio_post_playback.dart` | IMPLEMENTED_UNVERIFIED; real signed-media binding MISSING | AF05/15 plus AF00 bind canonical playback without public object URL |
| AF09-05 trusted processing/lease/revision settlement `processing_worker.ts`, `processing_queue.ts` | IMPLEMENTED_UNVERIFIED, registration MISSING | AF09 owns feature; AF00 worker composition |
| AF09-06 **real** mic record/preview/trim/private upload, verified asset, shared audio focus/retention | MISSING/disconnected | AF05 and AF15 implement canonical media adapters, actual object authorization |
| AF09-07 append-only reviewed `social.audio_posts`, reactions, comments, follows/queue migrations and tenancy/FKs | MISSING installed registry | AF00 owns `database/migrations/**`; validate disposable PostgreSQL |
| AF09-08 verified AF08 actor, PostVisibility, AF15 signer and existing AF09 route/worker imports | MISSING composed source | AF00 owns `services/gateway/src/{app,main}.ts`, `services/worker/src/main.ts`; AF08/AF15 supply dependencies |
| AF09-09 real Talks navigation: mount Discover/Saved/Following/My Talks, composer, creator profile and player in five-tab shell | MISSING composed source | AF00 owns `apps/mobile/lib/src/screens/twin/twin_home_shell.dart` and router; preserve unseen owner's APK edits |
| AF09-10 one **audited non-deploying unified integration SHA** plus conflicts/security review | NOT INTEGRATED | AF00 elects one target, audits main auto-build/migration trigger and publishes exact commit |
| AF09-11 two-account record→upload→process→publish→follow/comment→play/delete/offline/restart/device recovery + rollback | NOT_RUN / BLOCKED | AF13/AF05/AF15 execute on pinned unified SHA, device and disposable DB; production separately gated |

**Current integration SHA:** NONE; unmerged PR #609 remains draft, and main can trigger builds. Do not request owner's local pull while AF09-06/07/08/09/10 remain missing/disconnected; missing runner only defers AF09-11 execution.

## Actual check/toolchain evidence

- GitHub CAS claim and committed file readbacks plus static review were performed. **This is not a test PASS.**
- This runner provides Node 22.16.0 and global TypeScript 5.8.3; repository requires Node >=24 <25, pnpm 12, pinned TS 7.0.2. No pnpm/Flutter/Dart/PostgreSQL client, private checkout or Android media test device.
- Executed `git ls-remote https://github.com/Baatiku/masanawa.git refs/heads/work/af09-published-audio-20261010-gpt6` -> exit 128, `Could not resolve host: github.com`. Therefore tests were **AUTHORED / NOT_RUN**, not run on an alternate handwritten simulation.
- **AF13/capable AF00 runner:** checkout final #609 head; `pnpm install --frozen-lockfile && pnpm -r typecheck && node --experimental-strip-types --test adapters/storage/postgres/src/audio_posts/following_repository_pagination.test.mjs services/gateway/src/audio_posts/following.test.mjs && pnpm --filter @masanawa/gateway test`. Run `cd apps/mobile && flutter pub get && flutter analyze lib/src/audio_posts && flutter test test/audio_first/af09`, then disposable PostgreSQL microsecond/hidden-author/tenant and concurrent-delete tests, media/private ACL, signed player and two Android accounts. Fix actual failures before reviewed safe integration.
- **AF00 bounded request:** take exact migration, verified actor/visibility/asset/worker registration and Talks root paths listed above through registry-approved transfer; no competing integration branch or implicit production activation.

**Next AF09 continuation:** finish an unclaimed actual creator/report/play-count or remaining publication failure/recovery source item after inspecting fresh claims, not another pagination helper. Source-completion-before-local-pull rule remains in force.
