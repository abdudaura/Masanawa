# R15 — server-authorized gifting eligibility and safety

- **Owner:** ChatGPT second independent R15 backend workstream, 2026-10-08.
- **Branch:** `work/r15-gift-safety-eligibility-20261008`; base main `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
- **Lane:** talks-social, narrow security review of gift target eligibility; no overlap with draft PR #443 (AI Seat safety), #433 (AI Seats service), R06 wallet or other active work.
- **Owned paths:** `services/gateway/src/talk_gifts/model.ts`, `services/gateway/src/talk_gifts/postgres_repository.ts`, `services/gateway/src/talk_gifts/postgres_repository.test.ts`, `services/gateway/src/talk_gifts/service.ts`, `services/gateway/src/talk_gift_routes.test.ts`, this file.
- **Task:** R15/R10; gift catalog and execution target currently do not check canonical safety-hidden Talks/replays or bidirectional Host/viewer block decisions; avoid allowing payments through an invisible or blocked social relationship.
- **Current step:** new independent claim published, then implement sender-scoped target eligibility through canonical authenticated user identity and existing PostgreSQL safety tables. No client-provided recipient, new ledger or mock payment.
- **Test/production state:** pending. No local package runner or live provider available, do not mark qualified without executable Vitest/PostgreSQL settlement evidence.
- **Remaining:** recheck shared ledger authorization for strict moderation/payment TOCTOU once target preflight is implemented. This task is not permission to rewrite shared commerce or mobile files.
