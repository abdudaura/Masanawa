# Production private-session policy bootstrap repair

Owner: current Gwani failure investigation window.
Branch: work/platform-policy-bootstrap-20261008
Base: f91519fb05ae6b244ba9a721479aada03e7e08ba
Evidence: authenticated user reproduction 2026-10-08T05:47:51–05:48:13Z emitted agent.session_open_failed stage=session-create code=authority.policy_unavailable. Directory/history/auth work. POST session-open and live/token 500.
Owned: adapters/storage/postgres/src/security/policy-bootstrap.ts and test; security/index.ts export line; services/gateway/src/main.ts only policy initializer dependency/default factory/platform-tenant startup/authorizer revision hunks; this record.
Shared file check: active PR435 avatar composition also touches main.ts; preserve its disjoint profile/avatar hunks and integrate additively. No ownership of avatar/app.ts or R14.
Implementation: insert configured initial policy only if absent, read and assert existing revision, never overwrite existing policy/revocations. Startup validates before serving consumer sessions. Fail closed on mismatch/missing initializer.
Tests: insertion/restart/mismatch/concurrent initialization and bounded input; production restart/actual customer acceptance required.
Updated: 2026-10-08T05:51Z. Active root-cause repair.
