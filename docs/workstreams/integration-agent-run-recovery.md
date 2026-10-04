# Workstream claim — integration / AgentRun recovery acceptance

Owner/window: ChatGPT continuation window 2026-10-04 18:23 Africa/Lagos
Workstream: integration
Branch: `work/integration-agent-run-recovery-20261004`
Base: `98b293b2020668b2123e4e7b9d6baae0ebfc1b88` (PR #89 / `task073-inference-hardening`)
Task references: 072 primarily; recovery evidence also informs 080/082 without claiming either complete.

## Exact owned paths

- `docs/workstreams/integration-agent-run-recovery.md`
- `tests/integration/agent-run-recovery-acceptance.test.ts`
- `docs/AGENT-RUN-RECOVERY-ACCEPTANCE.md`

No existing runtime, Gateway, mobile, Commerce, provider, channel, migration, package-export,
root-config, lockfile, deployment or existing acceptance-test path is owned by this claim.

## Shared-contract dependencies

This slice consumes, but does not edit, the AgentRun/CharacterSession contracts and PostgreSQL
adapters currently owned by PR #89. It depends on their public APIs and migration roots exactly
as published at the base SHA. Any required production-contract change is a dependency request
to PR #89, not an implicit ownership transfer.

## Current step

Publish and verify this claim before implementation. Then add isolated PostgreSQL acceptance
coverage for process/repository recreation, identical-request replay after a lost response,
root/child lineage continuity across recreation, terminal replay and changed-outcome conflict.
Record executable commands and limitations without changing canonical task status.

## Status

Implementation: complete on branch
Verification: static diff review complete; Foundation CI run 37220620769 failed before checkout (runner_id=0, zero steps); PostgreSQL execution still required
Deployment: not applicable
Last update: 2026-10-04 18:31 Africa/Lagos

## Collision check

Active PRs inspected before claim: #44, #89-#98. Existing integration subclaims for Core Teaching,
Flutterwave-Commerce and NOWPayments use different exact paths. This claim deliberately avoids
all files currently changed by #89, #96, #97 and #98.

## Handoff evidence

Implementation commits:
- `1a984b3d25c08d952aeec23b2f888c185a50fb29` — recovery acceptance test
- `8bcdc62b48be1e84b7cfbb178d3ddc127a08446b` — acceptance scope/evidence note

PR: #99, stacked on PR #89.

Hosted check: Foundation CI run 37220620769 / job 111490034030 failed with
`runner_id=0`, no runner name and zero steps. No repository code or test executed,
so this is not a test failure and not a pass.

Required next evidence: run the focused PostgreSQL 18 command in
`docs/AGENT-RUN-RECOVERY-ACCEPTANCE.md`, then the normal Task 072 gate. Preserve the
stacked base unless PR #89 changes; rebase only with explicit collision review.
