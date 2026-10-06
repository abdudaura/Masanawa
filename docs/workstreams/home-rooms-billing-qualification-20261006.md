# Home/Rooms Lane B — Billing production qualification

Status: active isolated claim, 2026-10-06.

Base: PR #126 billing customer-journey head `caa85d9ecf3615ddc48810ed60881ba63ac6f2e7`.

## Ownership

This window owns only production-qualification tooling and handoff documentation for Lane B:

- `scripts/flutterwave-billing-catalog-qualification.mjs`
- `scripts/flutterwave-billing-qualification-gate.mjs`
- `scripts/flutterwave-billing-qualification-gate.test.mjs`
- `docs/workstreams/home-rooms-billing-qualification-20261006.md`

It does not own or edit:
- PR #136 shared Gateway/mobile/router/APK composition;
- `services/gateway/src/app.ts`, `services/gateway/src/main.ts`;
- mobile source;
- Commerce/Event migrations;
- production environment variables;
- crypto/NOWPayments paths;
- another Home/Rooms lane.

## Goal

Finish the isolated, reproducible qualification boundary for launch billing so production integration can consume concrete evidence rather than documentation assumptions.

Deliver:
- read-only live NG/NGN catalog discovery through the fixed-IP relay;
- deterministic machine-checkable report acceptance for launch bill families;
- explicit validation-target evidence requirements for recipient-validated families;
- no payment dispatch in qualification tooling;
- safe redaction/no customer identifiers in report output;
- focused Node tests for the qualification gate;
- exact handoff of remaining production-only dependencies.

No public billing enablement is authorized by this claim.
