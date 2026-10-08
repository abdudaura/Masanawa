# R07 voice/text billing catalog and confirmation guardrails — 2026-10-08

Owner: independent ChatGPT R07 assistant lane.
Branch: `work/r07-billing-chat-ambiguity-20261008`; base main `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
Claimed: 2026-10-08T06:06:19.897Z.
Exact owned paths: `services/gateway/src/agent_billing_assistant.ts`, `services/gateway/src/agent_billing_guardrails.test.ts`, `services/gateway/src/agent_conversation.ts` (only passing original user text into billing directive validation), this checkpoint.
Scope: Eliminate ambiguous provider/plan selection, forced fallback first item and wrong fixed-plan amounts in voice/text assistant. Require uniquely identified pending quote for generic yes so multiple outstanding bills never silently purchase a different recipient; provide live qualified options. Preserve canonical wallet/checkout authentication and payment authority, no model-synthesized success. Auth, provider service and ledger remain unchanged.
No PR overlapping owned paths at claim.
Verification status: not yet tested. This is safety hardening, not evidence that R07's provider end-to-end voice/no-display bill market journeys qualify. No R07 DONE.

Claim extension after PR file diff check at 2026-10-08T06:07:37.868Z: `agent_conversation.ts` had zero open PR collisions. Scope only passing original user utterance to refuse model-invented spend confirmation; no conversation runtime architectural edits.

## Implementation handoff — 2026-10-08T06:09:38.292Z

- Replaced first-match biller and item selection with unique matches against live catalog. Unmatched/ambiguous providers and data/TV plans return actual bounded live choices instead of inventing market names or paying the first candidate.
- A fixed-price package is never quoted using an incorrect model-supplied amount. Verify money terms through canonical `parseNgnKobo`; ask to correct contradictory amounts. Quote creation stays inside the authenticated CheckoutService.
- Generic voice/text "yes" and generated `billing.confirm` no longer pick the first of several pending quotes. Scan bounded owner history and filter only same-character, unexpired, quoted transactions, rejecting truncation/multiple candidates. Do not touch other Character's pending bills.
- Bill confirmation arising from model inference also checks the original customer utterance forwarded by `AgentConversationService`; model-generated consent alone cannot initiate a wallet purchase. The wallet, quote identity, revision and Flutterwave ledger remain server-authoritative.
- Agent never asserts refund completed just because `phase=failed`; directs customer to reconciliation status.
- Added `services/gateway/src/agent_billing_guardrails.test.ts` with exact provider, ambiguous provider and plans, fixed-price mismatch, actual customer consent, cross-character pending quote separation and wrong-recipient prevention.
- **NOT QUALIFIED**: No clone/pnpm workspace in current environment, test/typecheck inaccessible; source and tests committed but not executed. User-voice yes after unrelated conversational question may still reach a single pending bill; a follow-on session-specific quote challenge is required before production voice billing is qualified. No live Flutterwave, device, error/refund/voice-only test matrix completed. R07 stays UNVERIFIED.
- No migration, deployment, credentials or other workstream files touched.

## Ownership reclaim — 2026-10-08 (new sequential R07 security increment)

Window/owner: GPT-6 R07 billing consent continuation. Existing draft #447 is retained, not duplicated; last push at 06:09:51Z and five-minute lease expired before reclaim. Verified #497, C07 #480 and R17 #493 do not edit the two claimed production/test paths.
Exact ownership: `services/gateway/src/agent_billing_assistant.ts`, `services/gateway/src/agent_billing_guardrails.test.ts`, this workstream checkpoint. `agent_conversation.ts` existing #447 original-user-text forwarding preserved unchanged; no new router, migration, ledger, payment API, Flutter root, session authority, or provider write. Branch base at reclaim `8eb7c35496b9c422e3b5276af70890b0f130ce6c` (stacked on existing R07 source, not on main). Status PARTIAL_IMPLEMENTATION before implementing source/tests. Full R07 remains unqualified and the quote-screen voice parity still requires actual device/provider checks.
Risk to fix: generic agreement after unrelated question could spend against single pending bill. Proposed deterministic challenge: user must say/type the exact current quote recipient and total with currency, before any model/directive or pre-inference path may invoke canonical wallet.confirmAndPurchase. Quote and session owner remain server authorized. Unknown/mismatch/ambiguous declines with retry guidance; never buy on generic yes.
