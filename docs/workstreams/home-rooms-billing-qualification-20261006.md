# Home/Rooms Lane B — Billing production qualification

Status: isolated implementation complete; shared production evidence remains, 2026-10-06.

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

## Completed

The existing read-only Flutterwave qualification script remains the provider evidence collector. It performs catalog discovery and optional recipient validation only; it never dispatches a bill payment and never prints supplied customer identifiers.

Added `flutterwave-billing-qualification-gate.mjs` as the deterministic acceptance boundary for launch billing evidence. By default it requires live NGN catalog evidence for:

- `AIRTIME`
- `MOBILEDATA`
- `CABLEBILLS`
- `UTILITYBILLS`

It also requires successful real recipient-validation evidence for `CABLEBILLS` and `UTILITYBILLS`. The gate rejects malformed provider evidence, duplicate category/biller/item identities, missing billers/items, non-NGN items, missing launch families and invalid/non-catalog validation targets.

The gate exits:
- `0` when the requested qualification profile is accepted;
- `2` when the report is structurally valid but launch evidence is incomplete;
- `1` for malformed input/tooling errors.

An explicitly empty `--require-validation ""` is honored as an empty policy rather than silently restoring defaults. This is covered by regression tests.

## Usage

Generate redacted read-only provider evidence:

```bash
node scripts/flutterwave-billing-catalog-qualification.mjs > /tmp/flutterwave-billing-qualification.json
```

Apply the launch gate:

```bash
node scripts/flutterwave-billing-qualification-gate.mjs \
  /tmp/flutterwave-billing-qualification.json
```

For controlled narrower diagnostics only, without changing the report:

```bash
node scripts/flutterwave-billing-qualification-gate.mjs \
  --required-categories AIRTIME,MOBILEDATA \
  --require-validation "" \
  /tmp/flutterwave-billing-qualification.json
```

The narrower mode is diagnostic. It does not redefine the Home/Rooms launch requirement.

## Verification

Executed locally against the exact committed gate/test logic:

- `node --check scripts/flutterwave-billing-qualification-gate.mjs` — pass.
- `node --test scripts/flutterwave-billing-qualification-gate.test.mjs` — 6/6 pass.

The first run exposed a policy-parsing defect where an explicit empty validation list restored defaults. The defect was fixed before handoff and the full suite then passed.

No live bill purchase, refund, deployment, migration or production-variable edit was performed by this lane.

## Remaining integration / production dependencies

Only shared-owner or live-account evidence remains:

1. Run the read-only qualification collector in an authorized environment that has the real Flutterwave secret and fixed-IP relay credentials.
2. Supply non-secret real cable/electricity customer identifiers through `FLUTTERWAVE_QUALIFICATION_TARGETS_JSON` so provider recipient validation can be evidenced without buying a bill.
3. Preserve the generated redacted report and run the launch gate; do not enable billing if it exits 2.
4. PR #136 / production integration owner composes the qualified billing line into the current Gateway/mobile shell without replacing provider/Commerce truth.
5. Production owner performs controlled checkout/reconciliation/refund/device acceptance and only then enables public billing.
6. Exact release APK/device qualification remains Lane P / PR #136.

No further isolated Lane B code work is required unless the live qualification report reveals a provider/account-specific incompatibility that belongs in billing-owned provider logic.


## Read-only production inventory follow-up — 2026-10-06

Railway project `empowering-education` was inspected without changing service configuration,
variables, source branches or deployments.

Observed production state:

- `masanawa-gateway` is sourced from PR #136 branch
  `work/production-apk-integration-20261005`.
- legacy `@nurain/worker` is still sourced from
  `work/billing-customer-journey-20261004`.
- both services expose the required billing/auth variable **names**, including
  Flutterwave secret/relay/webhook settings, platform tenant, OTP/action secrets,
  Resend, fee policy and public-base configuration.
- the OAuth connector redacts values, so variable presence is evidence only; it does not
  permit reproducing secrets outside Railway or asserting their correctness.
- no variable was changed and `FLUTTERWAVE_BILLS_ENABLED` was not enabled by this lane.

The latest legacy-worker Railway deployment
`20c14144-d369-4752-9019-ae5bf5d8cf27` is marked failed, but its build evidence shows:

- 39 Vitest files passed;
- 368 tests passed;
- Flutterwave billing/provider tests passed within that suite;
- the deployment stopped afterward because the separate NOWPayments custody smoke returned
  HTTP 403.

Therefore that deployment status is not a billing test failure. It also does not replace
the launch qualification gate: no complete redacted live catalog + cable/electricity
recipient-validation report was found in the available logs.

Older Flutterwave live-read logs show provider probing had previously been blocked by a
Railway `exceed_egress_quota` restriction before the fixed-IP relay path became the
current qualification mechanism. Those historical failures must not be treated as current
merchant-catalog evidence.

The remaining live blocker is exact: execute the existing read-only qualification collector
inside an authorized environment with readable Flutterwave/relay values and suitable real
non-secret validation targets, then apply the committed gate. The current connector can
verify variable names and logs but cannot read the secret values, and Railway exposes no
safe one-off command primitive here that would run the repository script without changing
service/deployment state. This lane therefore does not mutate production just to obtain
qualification output.
