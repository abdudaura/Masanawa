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


## Continued qualification evidence — 2026-10-06

The live Railway project `empowering-education` was inspected read-only.

Production environment:
- project: `3ab9e6ec-a3fa-47c9-be81-4f12a315ca0b`
- environment: `a7a29368-d2d5-4baf-b846-c570dfeaa6ba`
- production Gateway service: `masanawa-gateway`
- legacy billing branch service: `@nurain/worker`

Both the production Gateway and legacy worker expose the complete required billing/auth variable **names**, including Flutterwave secret/relay/webhook configuration, Masanawa platform tenant, auth pepper/from address, billing action secret, billing fee policy, public/redirect URL and Resend. OAuth access redacts all values, so presence is verified but secrets were not read or copied.

The latest legacy-worker deployment status is FAILED, but build logs prove that this is not a billing unit-test failure. On deployment `20c14144-d369-4752-9019-ae5bf5d8cf27`:
- 39 Vitest files passed;
- 368 tests passed;
- Flutterwave billing/provider tests passed;
- the deployment was stopped later by an unrelated NOWPayments custody smoke returning HTTP 403.

Historical runtime logs also show earlier Flutterwave live-read probes were blocked by an older egress-quota restriction. That historical result must not be treated as current merchant qualification.

Added `scripts/flutterwave-billing-production-qualification.mjs` as the safe one-command live qualification runner. It:
1. runs only the read-only catalog/recipient-validation collector;
2. parses the collector output before use;
3. stores the temporary report with owner-only mode `0600`;
4. runs the deterministic launch gate;
5. preserves exit code 2 for structurally valid but incomplete launch evidence;
6. deletes the temporary report directory in `finally`.

Focused exact-source verification after the final regression fix:
- both qualification scripts pass `node --check`;
- both focused test files pass together: **9/9 tests**.

A regression was found during exact-branch verification: an earlier commit had not preserved explicit-empty validation policy semantics. The live branch file was corrected at commit `cad5aa030e49cc105348c98ff42d435ac204f2a8` and the full 9-test suite passed against the corrected logic.

### Remaining live-only blocker

This connector cannot read the secret values and Railway exposes no safe one-off command execution surface here. Therefore the real collector cannot be executed from this session without either changing deployment state or copying secrets, both of which are outside this lane's safety boundary.

The authorized production owner can now run exactly:

```bash
node scripts/flutterwave-billing-production-qualification.mjs
```

inside an environment that already has the existing Flutterwave/relay variables plus non-secret validation targets. Exit 0 is required before public billing enablement. Exit 2 means billing remains disabled.
