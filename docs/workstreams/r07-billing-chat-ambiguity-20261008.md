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

## R07 follow-on implementation checkpoint — 2026-10-08, GPT-6

**Status:** `IMPLEMENTED_UNVERIFIED` for the narrow **quote-bound conversational spending guard**. Entire R07, R05, R06, C07, Android and Flutterwave market-qualified journey remain `PARTIAL_IMPLEMENTATION / UNVERIFIED`. NOT DONE. NO MERGE / NO LIVE MONEY / NO DEPLOY.
- Resumed existing original branch `work/r07-billing-chat-ambiguity-20261008`; PR [#447](https://github.com/Baatiku/masanawa/pull/447) is **draft/open/unmerged**.
- Original branch PR base main `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`, reclaimed source HEAD `8eb7c35496b9c422e3b5276af70890b0f130ce6c`.
- Claim/lease renewed at commit `9905164d308dbe534c7e12699ee3612960be5675` (repository-visible) before implementation, more than five minutes since old owner. Source implementation `586b2e050d1e23876a33b2a91d7b4a47fb46ae1b`, regex fix `1b29a724c84d0589c3e8174a9bdab72a1c457ad0`, service-name quote binding `6adb6fa788af0d71db8a825d6ac8d40c20cd2056`, regression expectation `ad40217d00b178182441545fd91d6c428a8b8ab5`. Latest handoff-only commit recorded in PR head, do not infer from source SHA.
- Requirements: R07, R05/R06 dependencies, P02 low-literacy spoken input plus equal text path, W quote/purchase, J07/J11 consent/recovery. Not a complete voice-provider release.
- Exact changed paths: `services/gateway/src/agent_billing_assistant.ts`, `services/gateway/src/agent_billing_guardrails.test.ts`, this handoff. Original #447 changes to `services/gateway/src/agent_conversation.ts` forwarding original **human** `userText` remain preserved exactly (not modified by follow-on). No DB migration, HTTP route, app UI, financial schema, reserve, wallet/ledger/provider settings or root navigation touched. Those layers are existing server authorities and external release gate dependencies, not mocked.

### Security behavior and client/server journey

The original #447 accepted a single pending owner-authorized quote on any generic `yes/okay/proceed`, even if that assent followed an unrelated AI question or speech turn. Both `beforeInference` and model `afterInference` now route `billing.confirm` through **one guarded path** that always:
1. Lists authenticated customer quote history using the existing Checkout service, filters strictly to the current Character, unexpired, `quoted` state, and fails closed for history truncation or multiple candidates.
2. Checks the ORIGINAL user utterance matches an anchored quote-specific confirmation containing exact **service itemName, recipient/customerId, fee-inclusive totalAmountKobo in naira/NGN**. NGN is parsed using canonical `parseNgnKobo`, not floating model amounts; message length bounded, exact fields compared (ASCII casing only). English e.g. `Confirm Airtime bill to 07010102053 for 100 naira`; spoken Hausa alternative `tabbatar da biya ga Airtime ga 07010102053 na 100 naira`. The displayed challenge derives exclusively from persisted trusted quote via `formatNgnKobo`.
3. On generic `yes`, mismatched recipient, item, amount/currency, malicious directive or unclear consent, returns recoverable instructions **without invoking** `wallet.confirmAndPurchase` and explicitly says no funds have been taken.
4. Only on matching authorization passes the unmodified, server-owned quote ID and revision into canonical `BillingWalletService.confirmAndPurchase`. Existing wallet quote authorizer/confirmation, funds reservation, provider idempotency and settlement remain authoritative; no model-generated success.
5. Preserves the original quote and assistant context; server quote readback after restart remains authoritative, and repeated confirmation remains the downstream server's responsibility (no duplicate client payment authority).
This intentionally requires longer spoken consent than the previous single 'yes' until C07 can bind a session-level durable consent challenge safely; **do not weaken it for voice convenience without equivalent state/expiry guarantees**.

### Tests / evidence

- New and updated Vitest cases in `agent_billing_guardrails.test.ts`: rejects generic speech/model assent, wrong recipient, wrong item, wrong total, wrong currency, appended suspicious speech, cross-character, expired quote and ambiguous history. Permits matching English and Hausa text/voice transcript, asserts exact quote ID/revision passed to wallet. Existing original 8 R07 ambiguous-catalog/quote cases preserved (now 11 total).
- **Executed here:** deterministic source-extracted RegExp recognition smoke on the committed branch with nine English/Hausa/wrong-amount/wrong-recipient/item/currency/generic cases; result **9/9 expectations matched**, *not* Vitest, TypeScript compilation, real `parseNgnKobo` integration, auth DB or live payment. Relevant source/test fetched again from GitHub.
- **NOT EXECUTED:** no runnable pnpm / TypeScript / Vitest checkout in current coding environment; historical GitHub Actions #457 zero-step/quota incident. No attempts to rerun exhausted hosted CI, no provider credentials/charges. Tests remain authored not qualified.

Work commands on a fully equipped exact branch and later integrated main:
```sh
pnpm install --frozen-lockfile
pnpm exec vitest run services/gateway/src/agent_billing_guardrails.test.ts services/gateway/src/billing_wallet_recovery.test.ts services/gateway/src/financial_billing.test.ts
pnpm --filter @masanawa/gateway typecheck
pnpm exec vitest run
cd apps/mobile && flutter analyze && flutter test && flutter build apk --release
```
Exact pnpm filter may require adaptation to current package scripts; log executable exit status, standard output and SHA. Run real owner account, two sessions and separate Character signed into authorized Gateway with real PostgreSQL migrations: wrong profile, wrong customer item, old expired quote, multiple quotes, interrupted request, cancellation, repeated approval/idempotent response, after unrelated speech, unknown provider, offline/restart and stale quote after mutable fees, plus provider sandbox authorization with explicit user consent and no unauthorized charge. Qualify Arabic/Hausa conversational speech separately from text for TTS/STT transcription and numeric code utterances.

### Integration/dependency/rollback risks

- Single existing branch #447 was resumed, **no new duplicate PR**, no collision with #497/ #480 / #493 scoped file lists. The PR base main SHA predates current `main` (`1d6a67ea3c182455b55a7d1d07eacdb4311682e3` at inspection), so rebase/semantic reconcile with its integration, provider catalog, wallet funding and any contract changes before merge. #447 still has code only, not proof of real Flutterwave fulfillment.
- Privacy: stored quote recipient/name used only to compose spoken/text consent instruction; no extra secrets/logs/database; avoid speaking a customer's private details in public Talks. Existing session authority is required, though voice-only/last quote still must be verified on real devices. Explicit quote terms may be stale between approval and purchase: existing wallet/quote service must re-check revision/expiry/funds; test it.
- Rollback: revert only this R07 follow-on commit range to restore old code, **but do not roll back to generic yes in production** unless equivalent safe challenge replaces it. No migrations / provider toggles / irreversible actions.
- Work owner must run real TS and PostgreSQL tests; if missing R07 source/user-device parity still exists, preserve draft. **Do not mark R07 DONE** from source or static smoke tests.
- Release gates: SOURCE_WRITTEN=yes for bounded guard; LOCAL_TESTED=no (source regex smoke only); CI_EXECUTED=no; DB_INTEGRATED=existing contracts only, not executed here; APP_INTEGRATED=underlying existing agent conversation source forwards human text, unverified; DEVICE_VERIFIED=no; PROVIDER_QUALIFIED=no; DEPLOYED=no; MERGED=no.
