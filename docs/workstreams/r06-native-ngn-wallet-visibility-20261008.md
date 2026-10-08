# R06 — Native NGN wallet visibility and independent balance recovery (2026-10-08)

- **Owner/window:** ChatGPT independent R06 mobile wallet vertical slice after R14 checkpoint
- **Branch:** `work/r06-native-ngn-wallet-visibility-20261008`
- **Base SHA:** `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`
- **Latest visible update:** 2026-10-08T05:53:49.002Z
- **Exact owned paths:** `apps/mobile/lib/src/commerce/wallet_models.dart`, `apps/mobile/lib/src/commerce/wallet_http_transport.dart`, `apps/mobile/lib/src/screens/wallet/wallet_screen.dart`, `apps/mobile/test/wallet_models_test.dart`, `apps/mobile/test/wallet_http_transport_test.dart`, `apps/mobile/test/wallet_native_balance_test.dart` (new), this claim.
- **Dependencies:** existing authenticated `/v1/wallet` Credits/earnings projection and `/v1/wallet/ngn` NGN ledger API. No new currency entitlement, transfers, quote, provider rail, Gateway composition or migrations. Main shell/other workstreams not owned.
- **Purpose:** Native NGN balance is currently fetched and merged but never shown. An absent/malformed response can silently read as zero; one NGN API outage hides unrelated Credits. Implement honest separate native NGN projection + mobile rendering, error/retry behavior, non-floating exact formatting and deterministic tests.
- **State:** CLAIMED / implementation pending. R06 global/voice-first contract remains PARTIAL, not DONE.
- **Checks:** Flutter SDK/build unavailable in connector-only environment unless runner starts; never claim tests passed without execution. Other R06 fiat rails/voice-first cards require explicit server qualification.
