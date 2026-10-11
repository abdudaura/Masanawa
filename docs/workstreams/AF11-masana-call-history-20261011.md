# AF11 Masana call history

Owner: Codex, sole active implementation window per owner instruction.
Base: `a8e1c84cebcec9604a6b7c9cbdafc6ba6c2b036d` (merged #668).
Branch: `feature/masana-call-history-20261011`.
State: PLANNED; no production activation.

Scope: persisted outgoing Masana live-voice history; account-scoped recents,
detail, connection report and end report. Only server-authorized token issuance
creates records. Client lifecycle reports are informational, never billing proof.
Incoming calls, group orchestration, mobile integration and provider revocation
remain separate milestones. No old human-contact call authority is restored.

Exact paths: `services/gateway/src/call_history/**`,
`packages/agents/migrations/0007_masana_call_history.sql`,
`services/gateway/src/live_voice_token.ts`,
`services/gateway/src/agent_shell_contract.ts`.
Bounded AF00 composition transfer, owner has assigned this window full ownership:
`services/gateway/src/app.ts`, `services/gateway/src/main.ts`.
No auth, ledger, native audio, existing migration or deployment edits.

Next: execute negative authorization/lifecycle tests, implement the repository and
routes, test SQL on local PostgreSQL, then publish source and exact evidence.
