# R15 — server-authorized gifting eligibility and safety

- **Owner:** ChatGPT second independent R15 backend workstream, 2026-10-08.
- **Branch:** `work/r15-gift-safety-eligibility-20261008`; base main `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
- **Lane:** talks-social, narrow security review of gift target eligibility; no overlap with draft PR #443 (AI Seat safety), #433 (AI Seats service), R06 wallet or other active work.
- **Owned paths:** `services/gateway/src/talk_gifts/model.ts`, `services/gateway/src/talk_gifts/postgres_repository.ts`, `services/gateway/src/talk_gifts/postgres_repository.test.ts`, `services/gateway/src/talk_gifts/service.ts`, `services/gateway/src/talk_gift_routes.test.ts`, this file.
- **Task:** R15/R10; gift catalog and execution target currently do not check canonical safety-hidden Talks/replays or bidirectional Host/viewer block decisions; avoid allowing payments through an invisible or blocked social relationship.
- **Current step:** new independent claim published, then implement sender-scoped target eligibility through canonical authenticated user identity and existing PostgreSQL safety tables. No client-provided recipient, new ledger or mock payment.
- **Test/production state:** pending. No local package runner or live provider available, do not mark qualified without executable Vitest/PostgreSQL settlement evidence.
- **Remaining:** recheck shared ledger authorization for strict moderation/payment TOCTOU once target preflight is implemented. This task is not permission to rewrite shared commerce or mobile files.

## Committed implementation checkpoint — 2026-10-08T06:10Z

- Extended canonical gift target repository contract with `senderUserId`, derived exclusively from `PlatformSessionIdentity.userId`. Client cannot substitute a sender, target recipient or price.
- Gift catalog and gift execution both resolve eligible target server-side before presenting qualified options or invoking the existing, unchanged idempotent Credits executor.
- PostgreSQL eligibility checks: the selected Talk is visible under platform safety, ended replay is finalized+published and the selected recording is not hidden, Host public profile is not restricted, and neither party has blocked the other via canonical `talks.safety_preferences`. All checks are tenant-scoped SQL with bound sender ID.
- Authenticated route and repository regression cases added for sender binding, SQL filtering and zero ledger activity on a rejected gift target. Existing gift catalog and executor semantics are unchanged.
- **No local executable tests were run** (no usable repo package runner in connector execution); no production deploy, PostgreSQL transactional safety race, payment settlement or Android validation. Test files were authored and code read back; do not mark passed.
- **Known race / further R10/R15 work:** gift eligibility resolves via query then separate canonical ledger transfer. New moderation/block action may become effective between those steps. Full production acceptance requires a transaction-locked safety admission guard *inside the existing gift transfer authority* (coordinate with commerce ownership); no misleading claim of atomic moderation+debit. Ensure refund/reconciliation of an uncertain gift and exact long-lived replay policy.
- **Required executable checks:** `pnpm exec vitest run services/gateway/src/talk_gifts/postgres_repository.test.ts services/gateway/src/talk_gift_routes.test.ts`, `pnpm --filter @masanawa/gateway-service typecheck`, Gateway build, real PostgreSQL hidden Talk/blocked Host authorization and concurrent gift/payment tests. R10 animated recipient/stage delivery and full R15 acceptance remain open.
- **Do not merge unverified implementation.** This workstream does not own shared financial settlement/Gateway composition/migrations. Lease expires five minutes after last repository commit.
