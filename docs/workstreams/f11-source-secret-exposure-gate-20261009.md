# F11 — isolated source-secret exposure verification gate

**Window/owner:** GPT-6 F11 source-secret exposure recovery
**Workstream:** F11 / R16 (verification-only; not a release qualification)
**Branch:** `work/f11-source-secret-exposure-gate-20261009-gpt6`
**Base main:** `5e758673ae91082520b21b3153da53791ae2cbf3`
**Claim:** repository-visible initial commit on 2026-10-09; lease activity follows actual GitHub commit time, valid for five minutes per `docs/MULTI-WINDOW-WORK.md`.
**Exact exclusive paths:**
- `tools/secret-exposure-gate/scan.mjs`
- `tools/secret-exposure-gate/scan.test.mjs`
- `docs/workstreams/f11-source-secret-exposure-gate-20261009.md`

**Current step:** Initial path claim, *before code changes*.
**Dependencies:** F11 release/security owner and future Work integration for CI; preserve #457, #461, #497, #518, #554, #559 and all U and F existing drafts. No shared workflow, mobile, Gateway, financial authority, migrations, native, Firebase, deployment or production writes.
**Implementation:** NOT_STARTED at claim. **Verification:** NOT_RUN. **Deployment:** NOT_DEPLOYED.
**Goal:** read-only, dependency-free, fail-closed detection of accidentally committed source secrets with redacted diagnostics and test coverage, without altering existing release/integration paths.
**Handoff:** to be updated after source/test commits and exact GitHub SHA are known.