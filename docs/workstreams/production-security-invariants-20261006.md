# Production security invariants — Task 145 security slice

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/production-security-invariants-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Production task: 145 — production security review, abuse cases, tenant isolation and secret-leak testing.

## Scope

This is a concrete automated security slice only. It does **not** claim the full Task 145 production review complete.

## Exact owned paths

- `docs/workstreams/production-security-invariants-20261006.md`
- `tests/security/tenant-authority-secret-invariants.test.ts`

## Acceptance target

- cross-Tenant CharacterSession access fails even when every non-Tenant capability/resource check would otherwise pass;
- `manage-other` cannot override Tenant isolation;
- expired authority fails;
- CredentialSecret canary never appears through string, JSON or Node inspection surfaces;
- redaction tests prove use callback remains the only explicit material-access edge;
- tests are cross-cutting security evidence only, not deployment sign-off.

State: SECURITY SLICE COMPLETE / FULL TASK 145 REMAINS OPEN.

## Completed automated evidence

- cross-Tenant CharacterSession access is denied even when user/capability/resource identity otherwise matches;
- `agents.session.manage-other` cannot override Tenant isolation;
- expired authority is denied even with matching Tenant/resource scope;
- `CredentialSecret` canary material remains absent from String, JSON, template interpolation and Node inspection surfaces;
- private secret material is absent from ordinary key/value/entry enumeration;
- explicit `.use(...)` remains the only tested material-access edge.

## Remaining Task 145 work

- broader abuse-case review across channels, billing, crypto, plugins, Device and Presence;
- production secret scanning/config review;
- penetration/fuzz testing and request-boundary abuse tests;
- deployment/network/tenant-isolation validation against production-like infrastructure;
- dependency/supply-chain/security-header review;
- remediation and signed security release evidence.

Implementation head before handoff: `30d141fd611884937509b6908f1016a11441eb3b`.

Last update: 2026-10-06.
