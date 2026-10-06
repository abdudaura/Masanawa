# Production security hardening foundation — Task 145

Owner/window: current ChatGPT continuation window — Task 145
Branch: `work/production-security-hardening-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Production task: 145 — security review, abuse cases, tenant isolation and secret-leak testing.

## Exact owned paths

- `packages/security/src/public-projection-audit.ts` (new)
- `tests/security/production-security-hardening.test.ts` (new)
- `docs/PRODUCTION-SECURITY-HARDENING.md` (new)
- `docs/workstreams/production-security-hardening-20261006.md`

## Explicitly excluded/shared paths

- existing Security barrel/source owners;
- Gateway/Worker/Ops/mobile and PR #136;
- provider/device/plugin/social/commerce active feature branches;
- migrations, secrets, production environment and deployment;
- final Task 149/150 pilot/cutover sign-off.

## Implementation boundary

- reusable fail-closed audit for public/admin-safe projections that detects credential-bearing field names, high-confidence secret/token material and credential-bearing URLs;
- bounded recursive traversal to avoid audit DoS on attacker-controlled output;
- exact TenantId scope guard for arrays of public projections/evidence records;
- focused regression tests for nested secret leakage, redacted metadata, cyclic/deep objects, URLs, bearer/private-key/token patterns and cross-tenant records;
- concrete production abuse matrix covering tenant substitution, authority substitution, replay mutation, SSRF, callback forgery, self-payment/withdrawal, plugin escalation, device stale credentials, social impersonation and secret projection;
- matrix distinguishes implemented contract evidence from still-required converged production execution.

State: CLAIMED. Implement the reusable security audit foundation and review matrix; Task 145 remains production-incomplete until the converged release executes the matrix.
