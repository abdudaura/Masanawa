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

Status at claim: newly claimed; implementation/test evidence pending. CI and local executable tests must be reported separately.
