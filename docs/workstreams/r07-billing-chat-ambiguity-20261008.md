# R07 voice/text billing catalog and confirmation guardrails — 2026-10-08

Owner: independent ChatGPT R07 assistant lane.
Branch: `work/r07-billing-chat-ambiguity-20261008`; base main `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
Claimed: 2026-10-08T06:06:19.897Z.
Exact owned paths: `services/gateway/src/agent_billing_assistant.ts`, `services/gateway/src/agent_billing_guardrails.test.ts`, `services/gateway/src/agent_conversation.ts` (only passing original user text into billing directive validation), this checkpoint.
Scope: Eliminate ambiguous provider/plan selection, forced fallback first item and wrong fixed-plan amounts in voice/text assistant. Require uniquely identified pending quote for generic yes so multiple outstanding bills never silently purchase a different recipient; provide live qualified options. Preserve canonical wallet/checkout authentication and payment authority, no model-synthesized success. Auth, provider service and ledger remain unchanged.
No PR overlapping owned paths at claim.
Verification status: not yet tested. This is safety hardening, not evidence that R07's provider end-to-end voice/no-display bill market journeys qualify. No R07 DONE.

Claim extension after PR file diff check at 2026-10-08T06:07:37.868Z: `agent_conversation.ts` had zero open PR collisions. Scope only passing original user utterance to refuse model-invented spend confirmation; no conversation runtime architectural edits.
