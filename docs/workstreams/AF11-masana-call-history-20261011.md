# AF11 Masana call history

Owner: Codex, sole active implementation window per owner instruction.
Base: `a8e1c84cebcec9604a6b7c9cbdafc6ba6c2b036d` (merged #668).
Branch: `feature/masana-call-history-20261011`.
State: IMPLEMENTED_UNVERIFIED for production; backend source and local tests
implemented. No provider/device/deployment activation.

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

Verification: 24 tests passed across call-history, Gateway app and paid-voice
suites; five SQL tests executed on isolated local PostgreSQL, including migration
registration/rerun, tenant/account fencing, pagination and lifecycle races.
Gateway production build passed. Full Gateway typecheck remains failing: 37
normalized diagnostic entries match untouched `a8e1c84ce`, with no new entries.
The billing startup assertion in `main.test.ts` fails identically on that base
(expected error wording differs). No checks were weakened or disabled.

Independent review: no actionable findings; reviewer separately executed all
10 route/token tests successfully. PostgreSQL evidence is the implementation
window's executed local run, not an independent provider qualification.

Next: mobile recents/lifecycle integration. API and remaining qualification:
`services/gateway/src/call_history/README.md`.
