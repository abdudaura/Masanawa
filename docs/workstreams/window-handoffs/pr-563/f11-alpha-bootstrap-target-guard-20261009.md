# F11/R16 — Fail-closed alpha bootstrap database target guard

**Window:** GPT-6 independent F11 release-security recovery · **2026-10-09** · exact-path five-minute claim originally published in commit `fefd513e8f8ce46e6821d7512fe3204b27cc9790`.

**Status:** **PARTIAL_IMPLEMENTATION** for F11/R16 as a whole; this bounded source safeguard has executable local unit evidence but **NO real DB or release E2E qualification**. **DRAFT / UNMERGED / NOT DEPLOYED**.

## Baseline, ownership and collisions

- Base latest `main`: `5e758673ae91082520b21b3153da53791ae2cbf3` (rechecked before handoff). Branch `work/f11-alpha-bootstrap-target-guard-20261009`. Source/test HEAD before handoff: `1e6553843b747d361fb4d2f224d07b66d4f37794`.
- Initial repository-visible claim occurred **before** source edits; no new claim on main. Only exact paths below were changed:
  1. `scripts/alpha-bootstrap.mjs`: five additive lines; invoke preflight before any Pool construction or migration/demo identity writes.
  2. `scripts/alpha-bootstrap-safety.mjs`: independent no-database-import target/environment validator.
  3. `scripts/alpha-bootstrap-safety.test.mjs`: Node built-in test harness.
  4. `docs/workstreams/f11-alpha-bootstrap-target-guard-20261009.md`: claim and durable handoff.
- Live open PR collision review: #479 owns schema-only migration CLI, #518 PR collision audit, #554 Firebase preflight, #559 effective APK qualification, #561 archive inspector; none touch these four paths. #497 Work, #461 Firebase, #493 navigation and finance/C06 owners remain unchanged. **Do not duplicate or replace #479**.

## Why this matters

Audit `docs/BACKEND-DATABASE-PORTABILITY-AUDIT-20261008.md` documents that `pnpm alpha:prepare` runs schema migrations **and creates demo tenant/users/skills/agents**. It is therefore not suitable as a production migration CLI. Before this change the bootstrap took whichever `MASANAWA_DATABASE_URL` or `DATABASE_URL` was supplied, without a target guard.

## Implemented fail-closed behavior

- Explicit `MASANAWA_ALPHA_BOOTSTRAP_CONFIRM=I_ACCEPT_DEMO_IDENTITY_WRITES`.
- Explicit `MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_HOST`, `...EXPECTED_PORT` and `...EXPECTED_DATABASE` must equal URL hostname, port (including default 5432) and decoded name.
- Reject production/live labels in common runtime environment markers, malformed/non-Postgres URLs, URL query/fragment overrides, system database names, encoded slash/control characters and target mismatches.
- Any non-loopback host additionally requires `MASANAWA_ALPHA_BOOTSTRAP_REMOTE_CONFIRM=I_ACCEPT_NONLOCAL_DEMO_WRITES` and a visibly nonproduction DB name containing dev/test/sandbox/staging/rehearsal as a token.
- Sanitized error text never includes raw URI, username/password, hostname or database name.
- This is a **preventive operator preflight, not proof of physical host isolation**: tunnels, changed DNS, proxies or privileged credentials can still target unintended data. Production schema operations must use #479's reviewed migration-only mechanism and independent disposable-database qualification. Do not treat these acknowledgement flags as authorization to access customer data.

## Reproducible verification and immutable evidence

- **Executed locally on Node `v22.16.0`:**
  - `node --check scripts/alpha-bootstrap-safety.mjs` — PASS.
  - `node --check scripts/alpha-bootstrap-safety.test.mjs` — PASS.
  - `node --test scripts/alpha-bootstrap-safety.test.mjs` — **10 passed / 0 failed** (unit-level, no DB).
  - `git hash-object` of *executed local copies* matched published GitHub blobs exactly: production guard `633bd4a4cedd18fe9d9108cf5b7c0ca591ba9d5d`, regression test `56d42e4365e8bb37a0a33f5a62ecda5dd87de2d7`. The first local run failed 1 assertion expecting the wrong safe rejection message (9/10), corrected in the committed test; final 10/10 passed.
  - GitHub source readback confirmed the invocation before `createPostgresPool`. Compare to `main`: exactly the four owned paths; no shared mutations.
- **NOT executed:** entire root pnpm/Vitest/TypeScript/Gateway/Flutter suite (no local repository checkout/pnpm Node 24/Flutter SDK), actual `alpha:prepare` with real dependencies, disposable PostgreSQL 18, production/database migration, credential/CI #457 tests (known zero-step Actions failures), Android/Firebase/finance/provider checks. No real DB/financial accounts were accessed.
- This test harness isolates URL/env control logic using in-memory fixtures; it proves neither actual database isolation nor full production wiring.

## Safe operator example — on an authorized local disposable database ONLY

```bash
export MASANAWA_DATABASE_URL='postgresql://demo:LOCAL_ONLY_PASSWORD@127.0.0.1:5432/masanawa_dev'
export MASANAWA_ALPHA_BOOTSTRAP_CONFIRM='I_ACCEPT_DEMO_IDENTITY_WRITES'
export MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_HOST='127.0.0.1'
export MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_PORT='5432'
export MASANAWA_ALPHA_BOOTSTRAP_EXPECTED_DATABASE='masanawa_dev'
# pnpm alpha:prepare  # ONLY after independently checking disposable credentials/host
```

Production startup is unmodified. Do not put real credentials in shell history or PR artifacts. This example uses a placeholder, and `alpha:prepare` was not run.

## Work/integrator next steps

1. Re-read #479, #497, #561, current `main` and this PR's exact changed files/SHAs. Preserve the schema-only migrations CLI; do not silently promote alpha bootstrap to production operations.
2. In a **separate authorized disposable** PG18 environment, verify that a denied target results in zero database interactions and a confirmed target creates only demo data, including retry/restart. Test localhost port-forward + remote DNS failure cases. Keep logs scrubbed.
3. Run the exact `node --test scripts/alpha-bootstrap-safety.test.mjs` with Node 24 and all relevant root scripts on the final composed SHA; qualify DB migration checks, CI #457 and backup/restore/release gates.
4. Preserve five-tab app, Firebase and finance safeguards. No device/provider claims apply to this isolated backend preflight. No merge/deploy until central review and complete feature/release gates.

**Leasing:** No further writes are reserved once this SHA-specific draft handoff is published; if resuming after five minutes, recheck live file ownership and PR activity rather than overwriting later changes.
