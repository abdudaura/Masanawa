# F09/R13 — fail-closed replay playback authorization after S3 signing

**Owner/window:** autonomous ChatGPT F09 recovery continuation, 2026-10-09. **Status:** CLAIMED / IN_PROGRESS / DRAFT / UNMERGED, no production work.

**Original existing draft:** PR #453; previous stale HEAD `b624646dece4aeffbb1cf8c539e1e84669954299`, last GitHub-visible PR activity 2026-10-08T12:46:45Z (> five minutes before reclaim). Refreshed `main` at `5e758673ae91082520b21b3153da53791ae2cbf3`. Existing related R13 client PR #503 and Work #497 contain separate composed work; preserve all.

**Exact path lease only:**
- `services/gateway/src/talk_replay/egress/coordinator.ts`
- `services/gateway/src/talk_replay/egress/coordinator.test.ts`
- `docs/workstreams/f09-replay-postsign-recheck-20261009.md`

**Fault:** `playback()` checks DB viewer ownership, publication/safety and media readiness before awaiting S3 `presignGet`. During the async signing delay, Host unpublish/abort, moderation, or user access revocation can invalidate the initial authorization. If a pre-signed credential is returned after revocation, it can be disclosed despite DB denial now existing. After signing, re-query canonical repository access and require same object key; if denied/changed, return `null`, not the stale URL. This narrows the race; it cannot revoke an already issued presigned S3 URL and needs short TTL/real provider qualification.

**Shared ownership exclusions:** No `app.ts`, `main.ts`, API routes, replay SQL schema/migration, object signing adapter, S3 credentials, five-tab Flutter shell, Android native, finance/Firebase, or other lanes' files. Existing #503 already guards HTTP caching and Flutter playback; do not duplicate them. U16 Host consent remains a separate gate. Read `CONTINUE-HERE.md`, reconciliation and allocation docs, MULTI-WINDOW-WORK, R13 readiness and prior #453 handoff before claim.

**Verification pending:** Add delay/deferred signing regressions for revoked/replaced/authorized object. Run tests if executable locally; if unavailable, log exact limitation. Future Work must reconcile this branch with #497 preserving #503's separate signed-URL client defenses; execute PostgreSQL concurrency, LiveKit/S3, Android, and auth/device gates before merge. R13/F09 PARTIAL, NEVER VERIFIED_E2E merely from source.

## Implemented source checkpoint — 2026-10-09

**Implementation commits:** claim `cb21fb5e2b755f232683831380b79221d0efe721`; production `cc679a1b326059102b9deb308e0482fcd65608fb`; test regression declaration `8e42eea36a6b82c11a58ea717641f635be5d5a2f`; test callback TypeScript compatibility `47ed450a0bd3b1e5d642f4d995bc73c9525abaf7`. This document's own update is an additional commit on PR #453. All work is on `work/r13-replay-finalize-recovery-20261008`, not `main`.

**Actual behavior:** Existing Fastify replay service calls coordinator `playback`, whose PostgreSQL `playbackObject` enforces tenant, Talk, allowed viewer, ready recording and approved publication/safety. After S3 `presignGet` now **repeats the same canonical Postgres-authoritative access lookup** and returns `null` if denied or if a different S3 object is now authorized. Failure of the repeated lookup propagates an error without returning the credential. Existing `#503` HTTP private no-store headers/client renewal and `#453` replay finalization/aborted media CAS are preserved, not copied or reimplemented. No migration, new endpoint, auth service, mobile root change or new signing backend is required for this bounded fix.

**Tests authored (committed, not Vitest-executed):** An async four-mode `it.each` test in `coordinator.test.ts` delays the actual `presignGet` adapter, then simulates (a) revoked permission, (b) changed/rotated media object, (c) Postgres authorization query failure, and (d) unchanged permission. All assert the second query; the negative modes cannot emit a signed URL; the positive mode retains media type and expiry.

**Evidence executed here:** Six GitHub readback/static invariants PASSED (post-sign query ordering, object-key comparison, URL construction after authorization, four test modes, awaited delayed signer, and post-sign query failure assertion). Four JavaScript isolated dynamic scenarios executing the *extracted, unchanged production async playback method* PASSED **4/4** (revoked, replaced, lookup_failed, stable; two DB reads each). This is narrow **method-level** runtime evidence, not installed Vitest, TS typecheck, real SQL, API test, native player, or provider/device E2E. No repo checkout: container GitHub DNS lookup fails, `pnpm` and Flutter/Dart are unavailable; no credentials/CI runner supplied. Hosted #457 historically zero-job-step blocked; do not infer today's fresh status from that.

**Deferred executable verification before ANY merge (not run):**
1. `pnpm install --frozen-lockfile`, `pnpm exec vitest run services/gateway/src/talk_replay/egress/coordinator.test.ts services/gateway/src/talk_replay/egress/postgres_media_repository.test.ts services/gateway/src/talk_replay_routes.test.ts`; `pnpm --filter @masanawa/gateway-service typecheck`.
2. Compose #453 with #503 and Work #497 on latest main; `pnpm check` + backend security/integration suites; ensure app uses the composed coordinator and canonical error serialization.
3. In an isolated PG18 DB and S3/LiveKit Egress test environment, revoke Host/publication or moderator safety between first access query and signer resolution; ensure no URL reaches HTTP response; prove tenant/user separation and new-object identity replacement. Validate real signed URL TTL, replay stop/discard and eventual invalidation in a media client.
4. On signed Android builds test replay start/pause/seek/retry/logout/account switch/revocation with actual network/media player; test disclosure/access on previously signed URLs until TTL.
5. Resolve F09's **separately outstanding cross-Gateway Egress start race**, durable S3 cleanup when retries cease, multi-speaker recording/transcription consent, full media storage/deletion verification, and final CI/production release gates.

**Boundaries/risks:** The post-sign read narrows the await window but is **not an atomic grant**: policy can change again after the second query, and already issued S3 credentials remain usable until expiry/provider revocation. A stable, short provider-enforced TTL plus storage revocation and actual live race tests remain necessary. The second PostgreSQL query adds one read per playback URL; DB outage is fail-closed but a new outage mode and a possible slow response. F09 full replay, consent, LiveKit admission, persistence, Flutter device playback, and provider acceptance remain `PARTIAL_IMPLEMENTATION` and `UNVERIFIED`. Keep PR #453 **DRAFT/UNMERGED**; preserve #503, #497 and unrelated owner branches. No financial, Firebase, production DB, deployment, consumer recording or migration was changed.
