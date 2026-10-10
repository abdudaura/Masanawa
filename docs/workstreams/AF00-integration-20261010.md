# AF00 — one non-deploying reviewed integration baseline (2026-10-10)

**State: SOURCE_INTEGRATED_UNVERIFIED — NOT READY TO MERGE/DEPLOY/APK.**

- Existing root PR: #600, branch `work/af00-root-navigation-20261010-masanawa01-c`. Pinned pre-report HEAD: `42146af020e9ca8d57137c6b52b3bc6f46034c9f`. Preserve this branch; no alternative integration branch, no changes to `main` or live payments.
- Main reference: `7c443966be97e9092cbc1fb98562c75253434326`.
- Cross-window ownership: `factory/claims:.factory/leases.json` exact-path lease `af00-600-source-migration-20261010-gpt6-0520`. All transfers were checked for root-source path overlap and committed with original source PR HEAD as a second parent. No source branches or history deleted.

## Integrated source and immutable proof

| Source PR | Pinned head | Root integration | Material result |
|---|---|---|---|
| AF09 #609 | `5bbf3cebd4bebf23d108d103babab5220020ab16` | `416fa33b388ff884ef2524f2290ca400b54aa2ae` | 98 disjoint published Talk files: contracts, SQL proposals, repository/services, routes, Flutter screens/transports, tests/docs |
| AF00 internal | root branch | `f63f11e6d36c8835d963a37c43f8576f74690e4f` | Signed-in, account-fenced Talks tab mounts `PublishedTalksDestination` with stable canonical API client; Rooms remains gated |
| AF00 Gateway | root branch | `27c54f610bfcaba106a4a0240d542bd65754561e` | Gateway optional fail-closed `publishedAudio` route pack registration; cannot enable without fully authenticated injected dependencies |
| AF00 migration | root branch | `238b7526d68e4f63f70f315da3996821ba6c7674`, refined `801197d2de4f5b22d7e6d6906fbda62d540a0951` | Append-only `packages/talks/migrations/0015_published_audio_posts.sql`: six social tables + checkpoint once, no feature-local BEGIN/COMMIT, no alternate listen proposal |
| AF13 #596 | `e2f30c74033e96369e173f6536d295bcaf54bcf3` | `b0ee9e8d827df7855d06cf2fb424f9339eb0453a` | Six read-only evidence/qualification CLI and security files; never promotes release automatically |
| AF08 #597 | `bf9bfbfb96904ec3384ca1d9409b26d4846b4b20` | `6a000df81961e0da197cedb8d5af5474aa82f9d9` | Eight neutral day/night native launch, splash and test files; six modified blobs matched current main before transfer |
| AF05 #602 | `52bd5d2ab0e85bd3f5570d7d3744ee01d3068513` | `42146af020e9ca8d57137c6b52b3bc6f46034c9f` | Three PCM16 input guard, test, handoff files; modified source matched main before transfer |

Source from other drafts remains preserved on their original PRs; integrating bytes is not acceptance. AF09 pinned head at last check remained unchanged from integrated source. Root branch is not a separately deployed release.

## Central GitHub Actions incident — repeated zero-step failures

- Repository private. **Foundation CI and Mobile Build** on current PR heads and **Foundation CI on main** fail before checkout; observed job metadata `steps: []`, empty `runner_name`, no workflow job log (404 BlobNotFound).
- Examples [Foundation CI 38026440116](https://github.com/Baatiku/masanawa/actions/runs/38026440116), [Mobile 38026440078](https://github.com/Baatiku/masanawa/actions/runs/38026440078), [main 38020154370](https://github.com/Baatiku/masanawa/actions/runs/38020154370). They do **not** prove source/test failure; stop pointless re-runs until runner admission is resolved.
- GitHub public status reports no Actions incident on Oct 10. A private-repo Actions budget/minutes/spending cap, billing/payment or job provisioning policy is **plausible, not yet verified**. This connector has no permission/API surface to read account-level billing budget, runner administration or individual annotations.
- **One external owner action:** account owner inspect Settings → Billing and licensing → Usage/budgets and Actions minute/budget availability; open failing run's job/check annotation and record exact red banner. Restore runner admission or engage GitHub Support if budget healthy. Do not add card/spending limit without explicit account-owner approval. No real log can exist when no runner starts.

## Finite source and verification checklist

- [x] Pin main and source PRs, verify claim registry, review changed-path collisions, integrate AF09 #609 isolated implementation into existing root #600.
- [x] Mount signed-in published Talks screen with stable account-fenced Gateway transport, preserve non-Talk tab routes.
- [x] Add canonical Gateway optional AF09 registration seam, refusing any fake identity/media authority.
- [x] Write one additive numbered SQL migration for posts/reactions/comments/follows/listens/checkpoint, no duplicate/conflicting listen table DDL.
- [x] Incorporate selected AF13 evidence gate, AF08 launch and AF05 PCM guard bounded non-overlapping source without moving main.
- [ ] **Required SOURCE:** AF00 must bind real AF08 platform session principal → authenticated `PostActor` (tenant/account/human-or-Masana author) and existing TalkSafety block/restriction/moderation to `createPostgresAudioPostRepository`, Following, reporting and route pack in `services/gateway/src/main.ts`. No self-signed actor, client-supplied asset or public moderation endpoint.
- [ ] **Required SOURCE:** AF05/AF15 approved private mic/upload asset verification, server-issued private playback signer with shared audio focus, retention/erasure; process/publish worker safely composed in `services/worker/src/main.ts`. AF09 route pack remains disabled until all these real injected dependencies are present.
- [ ] **Required SOURCE:** AF10 durable Rooms API + actual root destination. AF07 Masana/Contacts is still a separate source PR; human contacts need canonical C01/C02 identity and message rights, not a fabricated directory.
- [ ] **Required SOURCE REVIEW:** Reconcile any unpublished AF15 media, AF05 Gemini native audio, other current pull-request modifications and original local APK against root source. Resolve owners' shared-file collisions before acceptance.
- [ ] **EXECUTION BLOCKED:** Restore GitHub Actions runner; exact intended backend commands `pnpm install --frozen-lockfile && pnpm typecheck && pnpm test:ci && pnpm build`; service-specific `node --test services/gateway/src/audio_posts/*.test.mjs adapters/storage/postgres/src/audio_posts/*.test.mjs` may require compiled JS under repo harness.
- [ ] **EXECUTION BLOCKED:** `cd apps/mobile && flutter pub get && flutter analyze && flutter test && flutter build apk --release --dart-define=API_BASE_URL=https://masanawa-gateway-production.up.railway.app --dart-define=AGENT_BASE_URL=https://masanawa-gateway-production.up.railway.app`. Do not present an APK before it actually exists.
- [ ] **EXECUTION BLOCKED:** Disposable PostgreSQL 18 migration/rollback/tenant isolation, two-account private-media upload/playback/processing, two-device/Android live PCM/permissions, authorized object/provider checks; AF13 CLI report pinned to the **exact final combined HEAD** and independent real-evidence review.
- [ ] **Release blocked:** Main merge/production deploy/local pull only AFTER real code completion, migration safety and qualifying checks. Gateway `start` runs migrations automatically, so no main merge while DB migration remains untested.

**Evidence classification:** GitHub source readbacks + commit parent SHA inspections PASS_STATIC; TypeScript, Flutter, PG18, Android and device tests NOT_RUN. Do not convert prior isolated author test counts to an integrated-head PASS. All PRs remain reviewable and original source retained.
