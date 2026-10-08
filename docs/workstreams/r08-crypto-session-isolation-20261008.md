# R08 mobile crypto authenticated session isolation — 2026-10-08

Owner/window: ChatGPT independent crypto session-ownership lane.
Branch: `work/r08-crypto-session-isolation-20261008`.
Base main SHA: `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
Scope: Fail closed when signed out/restoring, attach current rotated bearer identity to financial routes and prevent pending crypto balance/transaction results from repopulating another user's UI after session change. Preserve canonical custody, server authority and provider payout gating.
Exact owned code: `apps/mobile/lib/src/finance/crypto_state.dart`, `apps/mobile/lib/src/finance/crypto_wallet_screen.dart`, `apps/mobile/test/crypto_session_isolation_test.dart`, `apps/mobile/test/crypto_wallet_test.dart` (only as needed) and this checkpoint. No core authentication changes; transport type/client already supports token callback.
No overlap with current PRs #426,#430,#433,#435,#436,#438,#439,#440,#441,#442 at claim inspection.
Status: claim before code edits at 2026-10-08T06:01:32.139Z; source investigation done, tests/typecheck/device/deployment **not verified**.
Acceptance: signout never triggers financial load or reveals cached user data, signed-in reload is session-scoped, async financial response after user switch fails closed, bearer token reads current session source. Does not claim payout 2FA, NOWPayments qualification, or all R08 acceptance.

## Implementation checkpoint — 2026-10-08T06:04:55.201Z

- `cryptoWalletTransportProvider` passes a live read of `ApiClient.accessToken` to every finance call, so independently configured Dio transports receive the bearer without embedding static tokens. Existing gateway 401 refresh/rotation remains canonical.
- `CryptoWalletController.build` watches the complete `sessionProvider` identity; it performs **no financial network calls** for logged-out, restoring or OTP states. Signed-in A -> B invalidates the financial snapshot, not merely sign-in boolean.
- Async finance operations capture and re-check their owner identity before UI/history mutations and returned status, including account balances, deposits, withdrawal and conversion quotes/commits, fiat purchases, status refresh, and manual full-wallet refresh. Late prior-owner balance responses cannot clobber a new owner's history or selection.
- `CryptoWalletScreen` does not subscribe to crypto balances/history or display action buttons while unauthenticated; restoration state shows a spinner and signed-out state requires login.
- Regression cases in `crypto_session_isolation_test.dart`: live bearer rotation, no unauthenticated network fetch, A/B account history switch, delayed balance on logout, delayed deposit on A/B switch, and signed-out/restoring widget.
- **Verification blocked**: this ChatGPT container does not have a mounted Masanawa checkout or Flutter/Dart SDK, and GitHub clone DNS is unavailable. Tests, Dart analyzer and Android build were NOT RUN; do not merge without a real Flutter test run and an integration check of session rotation on device.
- **R08 remains PARTIAL**: NOWPayments payout credentials, IPN qualification, 2FA provider review, signed wallet reconciliation and real-money end-to-end settlement are not established here. No price, custodian balance, payout or user key is spoofed.
