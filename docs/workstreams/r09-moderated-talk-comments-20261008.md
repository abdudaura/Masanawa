# R09 moderated public Talk comments in AI stage context — 2026-10-08

Owner/window: ChatGPT R09 bounded context lane.
Branch: `work/r09-moderated-comments-stage-20261008`. Base main SHA: `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
Claim created 2026-10-08T06:12:34.594Z.
Exact owned files: `services/gateway/src/talk_ai_worker/postgres_stage_repository.ts`, `services/gateway/src/talk_ai_worker/postgres_stage_repository.test.ts`, `docs/workstreams/r09-moderated-talk-comments-20261008.md`.
Task: R09 P1 stage events gap — PostgreSQL authorized stage currently intentionally omits all comments despite projector support for explicitly moderated public comments. Add bounded read of only comments explicitly approved with safety_enforcement visibility='public', respecting topic, tenant, Talk, author block preference, event age and ordered budgets. Do not expose ordinary unreviewed public comments, private status, hidden reports, user financial state or client messages. Write regression tests against exact SQL and projection.
Active PR collision check: none across exact paths. Does not claim voice model admission, gifting stage settlement, or full R09.
Verification currently unrun; no local checkout/CI runners working, do not merge unverified.

## Implementation checkpoint — 2026-10-08T06:13:46.247Z

- Added one bounded SQL query to the authoritative PostgreSQL stage projection, scoped to current tenant+Talk and ten-minute snapshot window. Only comments with an explicit current `talks.safety_enforcement` row `target_kind='comment' AND visibility='public'` are eligible. Public-by-default unreviewed comments are excluded.
- The effective event timestamp is the later of the comment creation and latest public enforcement decision (`GREATEST(c.created_at,se.updated_at)`), preventing future approvals from entering prior AI turns. Explicit restricted/blocked decisions and host-blocked authors fail closed through the live joins. No report/body/account identifiers or private financial data are returned.
- The previously implemented `TalkAiStageContext` projector handles the new records as `moderated_public` comments with 220-character text bound, event ID dedupe, talk/tenant scope and maximum 16 total stage events; no separate prompt or inference trigger added.
- SQL/mock Vitest verifies source query tenant+Talk binding, enforcement predicate, user block check, bounds, safe projection and rejection on moderation SQL failure.
- **Tests/production NOT verified**: no local pnpm/DB checkout and GitHub workflow jobs fail before any steps. Require `pnpm --filter @masanawa/gateway test`, gateway typecheck, database safety/migration tests, and a Host Talk with a moderator-approved, unapproved, subsequently blocked and cross-Talk comment before merge.
- **R09 overall still PARTIAL**: authoritative settled gift stage events and all reaction/event admission paths need independent production qualification. No migration, provider credential, authorization policy, audio code or active PR's files changed.
