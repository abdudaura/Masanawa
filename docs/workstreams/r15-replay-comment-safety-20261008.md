# R15 — replay comment publication safety

- **Owner:** ChatGPT third independent R15 backend lane, 2026-10-08.
- **Branch:** `work/r15-replay-comment-safety-20261008`; base SHA `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
- **Task:** Prevent public replay discovery/detail for viewers or new public comment insertion after a published recording is restricted/blocked. Preserve Host-only private detail access for moderation.
- **Owned paths:** `services/gateway/src/talks/postgres_repository.ts` (listTalks/getTalk/addComment replay safety SQL hunks only), `services/gateway/src/talks/replay_visibility.test.ts` (focused regression additions), this document.
- **Coordination:** R02 #439 works `talk_live/postgres_repository.ts`, not this Talk repository. R15 #443 works paid AI seat/safety writer; #446 works gifting; no code overlap. Keep other Talk query/contract paths unchanged.
- **Expansion before edits:** Initial audit found that Explore and non-Host detail have the same missing replay recording safety gate. Expanded exact hunks here before editing to avoid inconsistent leak between feed/detail/comments. No other window claims this repository file.
- **State:** claimed, implementation and executable tests pending. No mobile, financial ledger, migrations, worker or shared main edits.
- **Release:** R15 global acceptance still requires real database concurrency and deployed client/channel tests. This sublane must stay draft until tests run.
