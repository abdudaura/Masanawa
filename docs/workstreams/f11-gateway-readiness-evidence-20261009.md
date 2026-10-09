# F11 / DB-P03 — Gateway readiness evidence verifier

Updated UTC: 2026-10-09; owner: GPT-6 isolated F11 recovery
**Status: PARTIAL_IMPLEMENTATION (F11 overall); bounded verifier source/test unit-verified only. NOT VERIFIED_E2E.**
**Claim:** `gpt6-f11-gateway-readiness-evidence-20261009` on `factory/claims` registry, commit `e99636468c325fc706acaf07d34e0a32ad577e8a`; scope paths below only.

- Baseline: `main@5e758673ae91082520b21b3153da53791ae2cbf3`.
- Work branch: `work/f11-gateway-readiness-evidence-20261009-gpt6`.
- Executed source/test checkpoint: `5c39d28a80a34e4d5d26729744a915c6ce36b9b2`.
- Handoff preparation SHA: `c42fbd439c9bfea34e19cd85a8069dcf7881ad56`; final HEAD is recorded in PR #570 after this checkpoint (a commit cannot contain its own SHA).
- PR: [#570](https://github.com/Baatiku/masanawa/pull/570), draft/unmerged.
- Requirements: F11 / R16 infrastructure security and readiness, database audit DB-P03; no separate UX journey satisfied.
- Related open work intentionally preserved: #457 shared Actions quota, #460 shared CI, #479 schema migration runner, #497 Work integration, #567 zero-step CI verifier, #559 Android manifest verifier. No collision in exact owned paths.
- Exact owned files:
  - `tools/readiness-evidence/verify-gateway-readiness.mjs`
  - `tools/readiness-evidence/verify-gateway-readiness.test.mjs`
  - `docs/workstreams/f11-gateway-readiness-evidence-20261009.md`
- No changes to schema/migrations, `app.ts`, `main.ts`, GitHub workflows, native/Firebase, financial services, live infrastructure, or Flutter five-tab shell.

## Actual source implementation

The verifier performs an explicit uncredentialed, non-caching GET to `/readyz` on a caller-supplied HTTPS DNS origin, requiring an exact expected host. It disables following redirects, limits response size and duration, requires a well-formed 200 JSON `{ service: "gateway", status: "ready", checks: [...] }`, rejects missing/duplicate `database-schema` checks and any not-ready dependency, and redacts raw remote errors/responses in CLI output. It never probes `/healthz` as a substitute or claims deployment/DB schema correctness merely from a snapshot. Its success classification is `READY_SNAPSHOT_ONLY`.

Usage by an authorized operator with a permitted endpoint only:

```sh
node tools/readiness-evidence/verify-gateway-readiness.mjs --origin https://gateway.example.com --expect-host gateway.example.com
```

Exit 0 means only a positive readiness snapshot; exit 1 is fail-closed; exit 2 is invalid CLI flag syntax. The script does not modify any production resources and has no external dependency or secret configuration.

## Executed verification

- Local environment: Node `v22.16.0`, Linux isolated container.
- `node --check tools/readiness-evidence/verify-gateway-readiness.mjs` — PASS (exit 0).
- `node --check tools/readiness-evidence/verify-gateway-readiness.test.mjs` — PASS (exit 0).
- `node --test tools/readiness-evidence/verify-gateway-readiness.test.mjs` — **10/10 passed**, 0 failed; fixture-fed Node built-in Response, **not a real network test**.
- Executed local code is byte-for-byte equal to pushed GitHub files according to Git blob SHA: source `f52951dc940f0a4ef0fd8896b63f53028d189ef9`, test `fb731c7ca4a42cc550b9b819b23414172bc39a1c`.
- Scenarios include direct argument rejection, correct GET method/target, omitted credentials, missing DB check, repeated check, misleading 200/other HTTP status, false/invalid dependency, content-type/JSON/body size violations, and transport error sanitization.

## What remains unverified or unimplemented

- No actual Gateway HTTP probe run; current environment cannot reach public GitHub/hosted services, and operator deployment target/permission is not established. The tool verifies remote self-reported status but cannot independently establish live database authenticity or deployed Git SHA.
- Postgres 18 disposable restore, real migration integrity, actual provisioned DB, frontend-to-backend scenarios, Firebase/Flutter builds and Android device, providers, release signing, GitHub Actions capacity and rollout/rollback **NOT RUN**; not evidence of PASS or FAIL.
- F11 core recovery (CI #457, off-account backups, database restoration, deploy SHA, production readiness traffic admission) remains with elected owners; no changes attempted.
- Readiness is a point-in-time snapshot and does not fix Railway's `/healthz` health-check configuration. Do **not** replace liveness with readiness unconditionally without restart-storm review.
- A malicious or rebinding DNS target could defeat a name-only operator allowlist. CLI is for a trusted human operator on a controlled runner, **not** an exposed user-submitted URL API; do not expose it to untrusted user input.

## Integration / next Work steps

1. Review exact-path claim and commit-level diff, maintain F11 independence, and integrate this check in a controlled operator-only release evidence procedure without secrets or consumer-exposed inputs.
2. Against an owner-approved staging Gateway, execute with expected canonical DNS and independently compare current schema ledger/readiness and deployed source SHA; capture timestamped, redacted terminal evidence. Fail if zero DB checks or provider errors.
3. Reconcile #457/CI, #479/schema runner, #497/Work and documented DB-P03 before altering any admission/release automation. Execute disposable PG18 migration + fresh/replay/rollback tests and off-account backup restore with explicit approval.
4. Run full application/Flutter/Android/provider tests on integrated SHA, then review before merge. Unverified PR must remain **draft/unmerged**.
