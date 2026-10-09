# U20 — Release qualification and evidence runner

**Status:** CLAIMED / PARTIAL_IMPLEMENTATION / DRAFT / UNMERGED. **Claim time:** 2026-10-09 01:17 Africa/Lagos (lease refresh is commit/PR activity; five-minute rule applies).

**Base main SHA:** `5e758673ae91082520b21b3153da53791ae2cbf3`. **Branch:** `work/u20-release-qualification-20261009-gpt6`.

**Scope:** exclusive new `tools/product_qualification/u20/**` and this handoff file only. Implement a fail-closed, offline-safe evidence qualification harness, its negative unit tests and reusable read-only reports. Do not edit F11's `scripts/audit-draft-pr-collisions.mjs`, global Gateway, router, Firebase, migration registry, finance, CI workflows, shared package scripts or production systems.

**Prior art reviewed:** F11 PR #518 already owns PR/file collision inventory; Work #497 owns shared integration. C01/C02/C05/C06 have conflicting open branches. U01–U07 and U21–U30 are open drafts; U08 branch exists, no U20 PR/branch/handoff was found at claim.

**Immediate plan:** require complete per-gate evidence (command, repository SHA, real exit/suite output, environment, identity and timestamps) for J01–J11, K01–K20, R01–R19 and C01–C08. Reject forged PASS, missing auth/privacy/finance evidence, invalid counts and unsupported releases. Never touch production. Capture local test results and exact blockers here after implementation.
