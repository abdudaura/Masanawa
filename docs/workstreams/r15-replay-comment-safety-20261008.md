# R15 — replay comment publication safety

- **Owner:** ChatGPT third independent R15 backend lane, 2026-10-08.
- **Branch:** `work/r15-replay-comment-safety-20261008`; base SHA `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
- **Task:** Prevent public comment insertion into an ended Talk whose published replay recording has subsequently been restricted/blocked by canonical platform moderation.
- **Owned paths:** `services/gateway/src/talks/postgres_repository.ts` (addComment SQL hunk only), `services/gateway/src/talks/replay_visibility.test.ts` (focused regression additions), this document.
- **Coordination:** R02 #439 works `talk_live/postgres_repository.ts`, not this Talk repository. R15 #443 works paid AI seat/safety writer; #446 works gifting; no code overlap. Keep other Talk query/contract paths unchanged.
- **State:** claimed, implementation and executable tests pending. No mobile, financial ledger, migrations, worker or shared main edits.
- **Release:** R15 global acceptance still requires real database concurrency and deployed client/channel tests. This sublane must stay draft until tests run.
