# R11 — localized billing quote, funding and receipt journey (ownership claim)

Updated UTC: 2026-10-08T13:35:00Z; owner: GPT-6 R11 billing interface continuation.
Base main: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`; branch: `work/r11-billing-localization-20261008-gpt6`.
Status: PARTIAL_IMPLEMENTATION (claim; source pending; do not merge).
Trace: R11/R07/R05, P02/P03, W* localization and J07/J11; must preserve real NGN amounts/provider IDs and server-owned financial state.
Exact claimed paths: `apps/mobile/lib/src/screens/billing/billing_screen.dart`, six `apps/mobile/lib/l10n/app_{en,ha,ar,fr,es,pt}.arb`, new `apps/mobile/test/localization/billing_journey_localization_test.dart`, this handoff.
Source contract: existing authenticated API/DB quote, wallet funding, receipt and history; **no duplicate payment authority or schema**. Locale presentation changes only, not authorization or financial calculations.
Collisions: old draft #426 owns shared ARBs and draft #440 owns billing_screen.dart (both activity stale by >5 min); preserving main as base and requiring semantic reconciliation, not overriding those PRs. #482 settings language preference is independent. #497 shared Work coordination and #457 Actions quota untouched.
Verification: not executed at claim. Target Flutter l10n generation/analyze/widget tests plus full build and real device, network/restart, provider qualification.
