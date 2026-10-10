# AF09 Published Talk playback ticket — continuing PR #609

Owner: MASANAWA-AF09-PLAYBACK-20261010, claim af09-playback-access-20261010-gpt6e on factory/claims.
Parent customer milestone: UX-A08 / UX-A09 Published Audio Talks (record, process, publish, authorized play, follow/comment). Existing PR: https://github.com/Baatiku/masanawa/pull/609
Base main: c7f7280e640d3098be3e26f05149a0d66085441b
Tested source HEAD: ac4f676abcc0d2ca4dc5aa3c684b23a9f59477b1 (refresh before integration; other AF09 owners are concurrently committing).
Exact owned code:
- services/gateway/src/audio_posts/playback.ts — Git blob 88cd5838d50e39967000427b6fc35465c8303c47
- services/gateway/src/audio_posts/playback.test.mjs — Git blob 5c794f3e96fb12f0c8374a8a2b6b514b81096001
- docs/workstreams/AF09-playback-access-20261010.md — handoff.

Connected implementation: A Fastify factory for GET /audio-posts/:postId/playback plus a service. AF08 must supply a server-authenticated actor, not client owner/tenant. The service reads the current tenant-scoped AF09 post and current blocked-author visibility; only published visible posts can request the canonical AF15 private-media signer. It requires a bounded HTTPS signed ticket from the server-configured host (<=60 seconds, no-store). AFTER signing, it rechecks AF08 identity, publication revision/asset/author, moderation state and visibility. It rejects logout, changed post, block/hold and foreign-host tickets without exposing storage keys. No new media signer, wallet, database or root-composition path introduced.

Executed on exactly matched GitHub source blobs (local git hash-object identical):
- Node v22.16.0: node --experimental-strip-types --test services/gateway/src/audio_posts/playback.test.mjs => PASS_REAL 10/10 focused tests against fake repository, visibility, principal, signer and mock Fastify application. Cases cover success, tenant isolation, unpublished/removed, blocking, principal switch, revision/delete race, signer expiry/origin, secret redaction, HTTP status/no-store.
- Node syntax for source and test => PASS_REAL.
- Global tsc strict ES2022 NodeNext => PASS_ISOLATED against temporary Fastify and canonical contract-type facades; this is NOT real workspace typechecking.

Not run: Node24/pnpm full repository checkout, real Fastify, PostgreSQL/row races, private-object storage, Flutter/analyzer/player/Android, two-account media E2E, production, restore or rollback. This container has Node22 and tsc but no pnpm, Dart, Flutter or PG; git ls-remote to GitHub failed DNS. Remote Actions runners previously executed zero steps and Vercel hit a build quota; neither proves source tests.

Next precise actions:
AF00 + AF08 + AF15: Mount the existing route factory with real AF08 requireActor, AF09 repository.byId, canonical PostVisibility.canView and existing AF15 issuePrivateMediaUrl. The AF15 binding MUST resolve current principal itself and verify passed tenant/account before signing, not trust request-owned data. Keep private object ACL, host, prefix, TTL server-configured. Audit deployment hooks before any main merge.
AF05 + AF09: Connect mobile play UI to ticket-fetch and canonical single-focus player. Handle denied, expired, offline, buffering, retry and account switch. Implement actual recorder/upload/verification and two-device published-playback E2E. Do not count card views as listens.
AF00: Allocate/execute reviewed append-only AF09 schema and protected trusted worker lifecycle wiring; do not activate before media/moderation.
AF13 or capable AF00 runner: On the latest combined PR SHA execute pnpm install --frozen-lockfile, pnpm -r typecheck, focused Fastify/source tests, PG tenant/concurrency visibility tests, Flutter analyzer/widgets and actual media authorization tests.

Integration hold: No single AF00-published, reviewed nondeploying integration baseline was found. Older integration/af15-media-cleanup-20261009, integration/af01-transfer-guard-20261010 and integration/af13-qualification-20261009 coexist; names alone do not establish safety. AF00 elects one and delegates bounded merge review. Do not merge this incomplete PR to auto-deploying main or call this verified customer playback. State PARTIAL_IMPLEMENTATION, UX-A08/UX-A09 NOT VERIFIED_E2E; no production change.
