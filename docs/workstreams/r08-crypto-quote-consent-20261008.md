# R08 — Server-authenticated quote-specific crypto consent (2026-10-08)

Owner/window: ChatGPT R08 Gateway crypto assistant consent lane.
Branch: `work/r08-crypto-quote-consent-boundary-20261008`
Base main SHA: `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`
Scope: R08 P0 security / voice-first authorization guard, **not** provider/payout/2FA or whole crypto release qualification.
Exact owned paths:
- `services/gateway/src/agent_crypto_assistant.ts` — only quote-specific user consent path.
- `services/gateway/src/agent_crypto_assistant.test.ts` — regression coverage.
- this claim.

Preflight: verified latest main and relevant canonical R08 / VOICE-FIRST-INTERACTIONS.md. Open PR #444 is scoped to mobile Crypto wallet state, not these Gateway files. R07 #447 is Billing confirmation, not this crypto path. No modifications to financial service, ledgers, migrations, app router, AI runtime or provider credentials. Respect all other active leases.

Confirmed source defect: `beforeInference` treats unscoped "yes" as approval when any pending quote exists; `afterInference` accepts LLM-generated `crypto.confirm` and dispatches conversion/withdrawal, even though model output is not user consent. Require a quote-bound explicit approval from authenticated user text, safe quote code, and prevent model-driven money movement. Code is not a second authentication factor. Must preserve identical idempotent requestId and fail closed on stale/wrong consent.

## Implementation checkpoint and explicit handoff

Status: **SOURCE IMPLEMENTED, TESTS AUTHORED, NOT EXECUTED; NOT PRODUCTION VERIFIED.**
Draft PR #454: https://github.com/Baatiku/masanawa/pull/454

- Latest focused source HEAD: `00ca97d1e5c91a1fdfa230aa472d18a79328e1b6` on the own branch at 2026-10-08; base remains `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`. Review full head again before integration.
- Existing `beforeInference` accepted an unrelated `yes`, `go ahead` or `continue` whenever any pending crypto quote existed. It now intercepts vague assent, explains that it does not authorize settlement, and requires the signed-in user to say/type `Confirm crypto <six-digit-code>` referencing exactly the latest server-stored pending quote.
- Every quote reply and existing conversation work document now displays the code, canonical request ID and expiry. Code comes from a digest of persisted canonical request ID; it is a **user-intent disambiguator, not a password/second-factor**, and does not replace session authentication, amount/route/destination validation, expiry, rate limits, or idempotent atomic claim.
- `afterInference` previously permitted LLM-generated `crypto.confirm` and `crypto.cancel` directives to mutate pending actions. Both now return bounded read-only pending quote instructions. `Cancel crypto` is direct user input only. The only conversion/withdrawal execution branch keeps the original pending request ID and `input.pending.claim` atomicity.
- Composition review: current `services/gateway/src/main.ts` constructs `createAgentCryptoAssistant` only when `composedFinancial` and `database.cryptoChatActions` are present; it injects this into `createAgentConversationService`. Current `agent_conversation.ts` invokes the hook's `beforeInference` with authenticated conversation `request.text` and admitted account scope, and separately invokes `afterInference` on `generated.reply`. This validates the static call path but **does not qualify the actual deployed environment, channel identity, voice transcription or provider**. R07 draft PR #447 independently changes `agent_conversation.ts` and its Billing-first gating; re-evaluate this cross-flow interaction at integration without writing that active file.
- Tests authored in `agent_crypto_assistant.test.ts`: only exact user consent can execute, vague phrases never reach model/provider while pending, bad and stale code cannot claim, model-generated confirm/cancel cannot mutate, explicit cancel works, duplicate authorization cannot submit twice, conversion and withdrawal quote projections include exact user code/requestId, absent/expired pending fails closed.
- Static readback verified only exact two TS files changed plus this handoff; a minimal lexical delimiter scan found balanced groupings and no conflict marker. **This is NOT a TypeScript parse, typecheck, or Vitest success.**
- GitHub Foundation CI run `37736937765` on implementation SHA and run `37736942027` both failed before a runner executed any steps (`runner_id=0`, `steps=0`). Therefore the job status cannot establish a code regression or passing checks.
- **NOT RUN**: `pnpm exec vitest run services/gateway/src/agent_crypto_assistant.test.ts`, `pnpm --filter @masanawa/gateway-service typecheck`, root `pnpm check`, replay/provider integration, production IPN/payout reconciliation and actual authenticated device acceptance. **NOT DEPLOYED.**
- This bounded patch does **not** complete R08: provider credentials/2FA fee mode, full voice-first secure UI/confirmation cards, network/market eligibility and refund/payout/reconciliation/device testing remain open. An 6-digit spoken reference is not per se high-risk step-up authentication. Any unlock still needs canonical authorization.
- Coordination: PR #444 only changes `apps/mobile/lib/src/finance/crypto_state.dart`, `crypto_wallet_screen.dart` and its test, not these files. Preserve all other work; recheck active claims before follow-ups. This 5-minute claim expires without further repository-visible work.

**Merge gate / continuation:** Execute focused Vitest and Gateway typecheck on Node 24 + pnpm 12, correct failures, confirm the deployed assistant runtime calls `beforeInference` with authenticated actual user text and never feeds LLM output through that path, then review quote-code speech/multilingual/accessibility and account/session/wallet reconciliation on real devices. Keep PR draft/unmerged until all required verification evidence exists.
