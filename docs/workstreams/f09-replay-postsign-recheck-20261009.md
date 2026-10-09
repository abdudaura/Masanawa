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
