# R06 — Authenticated NGN balance visibility and independent recovery (2026-10-08)

- **Owner:** ChatGPT, isolated R06 native fiat visibility lane.
- **Branch:** `work/r06-native-ngn-wallet-visibility-20261008` — PR #438 (draft/unmerged).
- **Base main:** `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
- **Latest repo-visible update:** 2026-10-08T05:58:15.610Z.
- **Owned paths:** `apps/mobile/lib/src/commerce/wallet_models.dart`, `apps/mobile/lib/src/commerce/wallet_http_transport.dart`, `apps/mobile/lib/src/screens/wallet/wallet_screen.dart`, `apps/mobile/test/wallet_models_test.dart`, `apps/mobile/test/wallet_http_transport_test.dart`, `apps/mobile/test/wallet_native_balance_test.dart`, this checkpoint.
- **Shared contract:** Existing authorized `/v1/wallet` and `/v1/wallet/ngn` endpoints only, no new server APIs, funding rail, financial ledger, migration, or currency promise.
- **Implementation:** CODE IMPLEMENTED, test cases AUTHORED, build/test EXECUTION UNVERIFIED, production/device NOT VERIFIED. R06 as a whole remains PARTIAL. Lease released to permit others to continue non-overlapping tasks.

## Code delivered

1. Wallet displays native NGN fiat, *separately* from spendable Credits and pending/available creator earnings. Existing Credits and history remain visible with no new transaction/control shortcuts.
2. Native money is formatted from exact integer kobo, with locale number grouping and no floating-point conversion. Source of truth remains authenticated NGN ledger, not converted Credits.
3. Missing/unavailable/fractional/negative/out-of-bounds native balance is never represented as a verified ₦0. A real ledger balance of 0 is distinctly verified. Retry is available on the native-balance unavailable state.
4. Native NGN endpoint is fetched independently. Temporary NGN transport/5xx/malformed response no longer hides successfully authenticated Credits/earnings; native HTTP 401/403 fails closed. Credits endpoint failures still fail the wallet rather than display unauthorized data.
5. Wallet balances, entries, and transfer/gift receipts reject fractional/out-of-bounds Credit values rather than silently truncating with `num.toInt()`.
6. New regression cases exercise model exact values/unavailability, HTTP NGN/credits failures and auth, integer formatting and actual widget rendering/retry states; legacy wallet-transfer idempotency tests were preserved.

## Changes and verification

- Commits: `edc911fb38dd38d4b29d2f35e16770b7f124a4ce`, `45cbb2c77015fbe319d7ef8e2c4f1d4a9a226af5`, `b6297afb3e3fc55ca276f65aa687e29bd216e6c8`, `caa1204da6ac6fc0d434cc97cbc01bbe38385b4a`, `2e523d3ba6a0c442bba7fe2d05a75f0dd8276bcc`, `0dcd47e6e20944d5933fe29d44c63832a44516af`, `4cde15ef7bdbdf596a0aec9d739f6323986be5f5`.
- Readback verified all 6 owned implementation/test paths on branch, 15 preexisting/new tests across two edited tests plus 3 newly authored widget/format tests. **These were counted/read, not run**.
- GitHub branch-head `4cde15ef7bdbdf596a0aec9d739f6323986be5f5` Foundation CI #37734923451 and Mobile Build #37734923500 reported failures **with zero job steps**; no application code/test actually ran. Available execution environment has no Dart/Flutter SDK and no private repository working tree.
- **Do not merge solely from source inspection.** Once checkout/CI capable: `cd apps/mobile && flutter analyze`, `flutter test test/wallet_models_test.dart test/wallet_http_transport_test.dart test/wallet_native_balance_test.dart test/wallet_service_shortcuts_test.dart`, full mobile suite, Android debug/release build, signed-in real backend NGN vs zero/error device matrix; inspect current main and rebase safely.

## Remaining R06 acceptance (not implemented here)

- Canonical multi-currency fiat metadata/capabilities and balances where actual provider/market qualification permits (not invented currencies).
- Private voice-first durable funding/send/withdraw intents, text/tap parity, exact quotes/fees/confirmation and ledger-backed recovery; coordination with R05/R07/R08 and API owner required.
- Localization of wallet labels, Arabic RTL/accessibility, small devices and device/provider acceptance.
- Add Money/Send/Withdraw are still not enabled without correct supported server authorization; do not infer a working financial service from balance rendering.

## Handoff

PR #438 is safe to review, but must stay draft while tests/build and real backend/device verification remain unavailable. Preserve unrelated `main` integration work and avoid editing another window's owned shell, server financial ledgers or shared roadmap. The old zero-on-error bug is addressed in the branch, *not* deployed to users.
