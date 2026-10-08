# R15 — replay comment publication safety

- **Owner:** ChatGPT third independent R15 backend lane, 2026-10-08.
- **Branch:** `work/r15-replay-comment-safety-20261008`; base SHA `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
- **Task:** Prevent public replay discovery/detail for viewers or new public comment insertion after a published recording is restricted/blocked. Preserve Host-only private detail access for moderation.
- **Owned paths:** `services/gateway/src/talks/postgres_repository.ts` (listTalks/getTalk/addComment replay safety SQL hunks only), `services/gateway/src/talks/replay_visibility.test.ts` (focused regression additions), this document.
- **Coordination:** R02 #439 works `talk_live/postgres_repository.ts`, not this Talk repository. R15 #443 works paid AI seat/safety writer; #446 works gifting; no code overlap. Keep other Talk query/contract paths unchanged.
- **Expansion before edits:** Initial audit found that Explore and non-Host detail have the same missing replay recording safety gate. Expanded exact hunks here before editing to avoid inconsistent leak between feed/detail/comments. No other window claims this repository file.
- **State:** claimed, implementation and executable tests pending. No mobile, financial ledger, migrations, worker or shared main edits.
- **Release:** R15 global acceptance still requires real database concurrency and deployed client/channel tests. This sublane must stay draft until tests run.

## Implemented checkpoint — 2026-10-08T06:15Z

- The public Explore/Live projection only includes ended Talks when a finalized/published replay is **not** safety-restricted or blocked under the canonical recording ID.
- Non-Host Talk detail uses the same server safety gate; the existing real Host private detail override is deliberately preserved for moderation and appeal.
- Comment publication requires a non-restricted finalized published replay for non-Hosts; all ended-Talk comments, including Host comments, additionally reject when the linked recording is restricted/blocked. Existing Talk/Host block and user moderation checks are preserved.
- SQL authorization is tenant+recording scoped and checked in the INSERT SELECT statement for comments, not an unchecked client flag.
- Added regression tests for feed, viewer detail and Host-author comment restriction.
- **Verification:** Source readback and SQL-shape check only. No Vitest, TypeScript typecheck, PostgreSQL integration test or Android/deployed acceptance was executable from this GitHub connector. Must run `pnpm exec vitest run services/gateway/src/talks/replay_visibility.test.ts services/gateway/src/talks/postgres_repository.test.ts services/gateway/src/talk_safety/enforcement_integration.test.ts`, Gateway typecheck/build and actual DB safety filter tests.
- **Remaining:** authenticated end-to-end feed/detail/comment with real publishing/moderation races, safety-hidden existing comments and cache invalidation, replay audio access, channel/moderation rollout. Do not claim full R15 success.
- **Ownership:** limited to the above SQL hunks and regression file; no activity in other owners' live backend, financial or mobile paths. Branch must remain draft pending executable proof.

## Additional isolated feed/detail block audit

An authorized viewer's personal block of a Host was already honored in feeds and detail. The inverse Host-blocks-viewer relationship was enforced for new comments but **not** for Talk discovery/detail. The same owned `listTalks/getTalk` SQL hunks and `replay_visibility.test.ts` will now enforce bidirectional block before public visibility; Host-own access and existing muted-subject behavior remain intact. This expands the current claim before editing, does not modify shared financial/live files, and is still subject to real DB/CI verification.

## Reciprocal block checkpoint — 2026-10-08T06:20Z

- Public Explore/Live listing now filters a Host's viewers who were explicitly blocked by that Host (in addition to existing viewer-block/mute rules).
- Public `getTalk` detail applies the same reciprocal block. The existing self-Host private detail exception remains for moderation/appeal. Public comment insertion already checks both block directions and was not changed here.
- Focused regression added to `replay_visibility.test.ts` for both read paths.
- **Executable verification remains blocked:** no runnable repo workspace and hosted Actions do not schedule steps. Source readback only. Run focused tests, Gateway typecheck/build, actual DB test and API acceptance before merge. Draft PR #450.
