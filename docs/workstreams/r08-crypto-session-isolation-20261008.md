# R08 mobile crypto authenticated session isolation — 2026-10-08

Owner/window: ChatGPT independent crypto session-ownership lane.
Branch: `work/r08-crypto-session-isolation-20261008`.
Base main SHA: `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
Scope: Fail closed when signed out/restoring, attach current rotated bearer identity to financial routes and prevent pending crypto balance/transaction results from repopulating another user's UI after session change. Preserve canonical custody, server authority and provider payout gating.
Exact owned code: `apps/mobile/lib/src/finance/crypto_state.dart`, `apps/mobile/lib/src/finance/crypto_wallet_screen.dart`, `apps/mobile/test/crypto_session_isolation_test.dart`, `apps/mobile/test/crypto_wallet_test.dart` (only as needed) and this checkpoint. No core authentication changes; transport type/client already supports token callback.
No overlap with current PRs #426,#430,#433,#435,#436,#438,#439,#440,#441,#442 at claim inspection.
Status: claim before code edits at 2026-10-08T06:01:32.139Z; source investigation done, tests/typecheck/device/deployment **not verified**.
Acceptance: signout never triggers financial load or reveals cached user data, signed-in reload is session-scoped, async financial response after user switch fails closed, bearer token reads current session source. Does not claim payout 2FA, NOWPayments qualification, or all R08 acceptance.
