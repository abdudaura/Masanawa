# F08 / R15 — viewer-authorized public Talk comment reads

Window: autonomous F08 security recovery, 2026-10-09 Africa/Lagos.
Status: CLAIMED / IN PROGRESS. Branch: `work/f08-talk-comment-visibility-20261009-gpt6`.
Fresh main inspected: `5e758673ae91082520b21b3153da53791ae2cbf3`.
Five-minute lease: refresh via visible branch commits; expires after five minutes without activity.

## Precise exact-path ownership
- `services/gateway/src/talks/model.ts` (thread viewer identity contract)
- `services/gateway/src/talks/service.ts` (pass authenticated viewer only)
- `services/gateway/src/talks/postgres_repository.ts` (tenant/viewer/author/comment moderator SQL)
- `services/gateway/src/talks/postgres_repository.test.ts` (SQL-scoped assertions)
- `services/gateway/src/talks/comment_visibility.test.ts` (service/regression tests)
- `docs/workstreams/f08-talk-comment-visibility-20261009.md` (this claim/handoff)

## Defect and guardrails
Talk detail authorizes the parent Talk, then fetches up to 200 comments with no per-comment moderation or viewer-user preference filtering. A viewer can therefore receive a comment restricted/blocked by platform policy or from an author they blocked/muted. Deny those comments at the authoritative PostgreSQL read; never trust viewer IDs supplied by HTTP bodies. Preserve existing Talk host/replay and financial contracts. No migrations, shared Gateway composition, Flutter router, Firebase, wallet, or other branch edits.

Related draft #450 modifies the same repository file for *parent replay visibility*: preserve and semantically reconcile both diffs at Work integration; this claim does not overwrite #450 or merge it. R09 #452 uses separate stage projection, not a customer comment authorization. F08 is a bounded core safety recovery, not an assertion that whole R15 is complete.

Tests and SHA-specific handoff will be recorded after implementation.