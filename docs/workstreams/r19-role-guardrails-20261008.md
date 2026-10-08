# R19 — role-appropriate private persona response guardrails
Updated (UTC): 2026-10-08T12:4xZ (claim initiation, exact commit timestamps authoritative)
Owner window: GPT-6 role guardrails
Status: PARTIAL_IMPLEMENTATION — initial repository-visible claim
Lease: five minutes from the latest commit or activity on this branch; do not overlap active windows.
Base main SHA: `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`.
Branch: `work/r19-role-guardrails-20261008-gpt6`.
Exact owned paths: `services/gateway/src/production_strategy.ts`, new `services/gateway/src/production_strategy_role.test.ts`, this handoff.
Feature: R19/A09 private agent role framing and trustworthy consent-sensitive conversation using already-authorized server profiles. No direct edits to `main.ts`, `app.ts`, shared shell/router, ledger, migrations, C07 workspace, worker AI audio path, or R15 persona reports.
Known overlap audit: R02/R19 #448 owns `talk_ai_worker/worker.ts`; C07 #480 owns `assistant_workspace/`; R15 #491/#489 own persona profile UI; Work #497 owns integration and several backend files. This claim does not replace, overwrite or preempt them.
Next: implement complete isolated strategy prompt contract, deterministic production-path tests, verification/handoff and draft PR. No claims of passed tests or deployed model outcomes.
