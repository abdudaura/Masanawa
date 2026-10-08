# Shared CI recovery — ChatGPT Work

Owner: ChatGPT Work shared integration session. Updated 2026-10-08T07:02:00Z.
Branch: `work/shared-ci-recovery-work-20261008`. Base main: `f4cd25420ae24be78cddd7c3d17bdc34e0f8a060`.
Task: issue #457, shared executable CI and outstanding PR verification, including preservation of R16 PR #455.
Owned paths: this file. Workflow edits require fresh coordination and demonstrated need; feature source paths, migrations, secrets, deployments and other windows' changes remain unclaimed.
Lease: five minutes from substantive repository-visible work, not a permanent reservation.

## Confirmed infrastructure cause

Foundation job 113177066835 / run 37736482648 reports runner_id=0, zero steps. Authenticated GitHub UI annotation: job not started because recent account payments failed or spending limit needs increasing.
Authenticated Billing overview resolves the cause: Actions minutes **2,000 used / 2,000 included**, reset in **24 days**. Actions budget is **$0**, **Stop usage Yes**, **100% utilization**. Billable usage $0; gross usage and included discounts both $12.21. Account is GitHub Free. This is exhausted included Actions minutes with paid overage stopped, not an observed application test failure.

No spending limit, payment method, repository visibility, security protection or runner access has been changed. Enabling paid overage requires owner financial authorization; runner registration requires a separate secure infrastructure decision. Do not weaken tests to hide the incident.

## Recovery in progress

Direct terminal git clone fails for missing HTTPS credentials. Authenticated browser archive download returned a path but no file became available. Connector source recovery and local dependency/test execution are being attempted. Node 24.19.0 is present; default pnpm 11.25.0 differs from repository-required 12.8.2; Flutter not on PATH. These are independent environment gaps, not proof of code failure.

## Verification truth

No PR merged in this session. No new executable Foundation/Mobile Actions run, Flutter build, provider operation or device acceptance yet. R01–R19 remain qualified only by their existing evidence; no DONE status changes.

Next: recover exact immutable source and dependency toolchain; run main baseline, then each PR delta with isolated snapshots, preserve active lanes and publish exact results. Issue #457 remains OPEN until Foundation and Mobile jobs actually execute and affected PRs are verified.
