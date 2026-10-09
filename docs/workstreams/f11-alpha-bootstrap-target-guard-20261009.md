# F11/R16 — Alpha bootstrap target protection (claim and handoff)

**Window:** GPT-6 F11 isolated release-security recovery, 2026-10-09, five-minute lease from this initial repository-visible commit. **Branch:** `work/f11-alpha-bootstrap-target-guard-20261009`. **Base main:** `5e758673ae91082520b21b3153da53791ae2cbf3`.

**Status:** CLAIMED / PARTIAL_IMPLEMENTATION; no release/deployment evidence.

## Exact claimed paths

- `scripts/alpha-bootstrap.mjs` — only early pre-DB guard invocation.
- `scripts/alpha-bootstrap-safety.mjs` — dedicated fail-closed environment/target validator.
- `scripts/alpha-bootstrap-safety.test.mjs` — executable Node isolation/security tests.
- `docs/workstreams/f11-alpha-bootstrap-target-guard-20261009.md` — own claim, evidence, handoff.

## Rationale and collision check

`scripts/alpha-bootstrap.mjs` runs migrations **and** creates demo identities/skills and must never substitute for production schema migration. F11 #479 owns the schema-only CLI (different paths); #518 PR collision checker, #554 Firebase continuity checker, #559 APK gate, #561 offline archive inspector own separate paths. No shared Gateway application or migration registry, wallet/ledger, Firebase, five-tab router, Actions or production infrastructure edits. Original PRs remain untouched. This is a bounded F11 *verification/recovery subclaim*, not F11 completion.

**Next:** implement and locally execute deterministic security regressions, commit code, update handoff with actual outcomes/SHA and open DRAFT PR. Need final integrator to compose and exercise real alpha/disposable database and all release gates. Lease renews only via visible push/claim activity; claim does not reserve unrelated F11 paths.
