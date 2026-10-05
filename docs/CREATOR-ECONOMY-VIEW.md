# Creator economic view

This independent item-4 slice consumes the existing authenticated
`CreatorEconomyService.read`. It renders Customer Credits, Agent Float, pending
earnings and available earnings through existing ShellDocument v1 metrics. Credits
are labeled as Credits; no fiat exchange rate or crypto principal is invented.
The no-clone view shows the real Customer Credits balance and explains how to reach
Float/earnings by creating a clone. A read failure never becomes zero balances.

Use `createCreatorEconomyShell({ economy })` to fetch fresh authorized snapshots and
documents. Feed the document into the existing conversation renderer. Optionally
register `registerCreatorEconomyShellRoutes` in the existing Gateway for
`GET /creator/economy/document`. The integration owner supplies document custody
with a fresh monotonic revision through `nextDocumentScope`. This is an integration
function, not an independent runtime or document store. Responses are private/no-store;
authentication/authorization stays in the current economic service. Outages are redacted.

The snapshot is the current canonical service projection. It does not add provider
transactions, crypto balances, per-job reserves, funding entitlements or payout routes.
It never caches authority or the previous account's balance.

## Financial actions still require coordinated integration

The old `/creator/float` route currently calls `CreatorEconomyService.allocateFloat`,
which creates a fresh ledger entry on each call. It has not yet adopted PR #90's stable
RequestId command. This view intentionally has no financial buttons. The owning
Gateway/mobile window must replace that path with the canonical
`allocateAgentFloat` command and persist the confirmed RequestId before sending,
then use scoped receipt/history recovery. Do not add a one-tap allocation or retry
the legacy transfer after an ambiguous outcome.

Customer Credits and Float remain non-withdrawable under current policy. An available
earnings balance does not prove a configured customer payout route. Crypto custody,
conversion and withdrawal remain separate operation-qualified provider journeys.
The existing body/receipt/quote confirmation contracts must be composed before these
operations are exposed as buttons. This slice makes no account-qualification promise.

## Evidence

Six focused tests pass: separate metrics, real zero/no-clone state, invalid balances,
fresh authenticated reads, account isolation, private/no-store HTTP and redacted outages.
Gateway strict TypeScript passes. The complete current onboarding/economic projection
plus architecture/compatibility batch is 85 tests in 11 files, all passing. Eight
onboarding SQL cases pass on PGlite PostgreSQL 18.3; native separate-session concurrency,
Gateway registration/deployment and physical app acceptance remain open.

## Remaining ordered feature integration

| Item | Existing work to consume | Concrete remaining dependency |
| --- | --- | --- |
| 1. Onboarding | PR #123 now includes server drafts/confirmation, ShellDocuments, and mobile save/review/resume/open | Shared Gateway registrar composition; qualified automatic Core/support; directory admission; runtime and device acceptance |
| 2. Live Teaching | #94 exact Skill/Guide; #96 runtime/shell/channel and free-response contracts | #89 owns canonical Memory/Workflow progress and evidence ports, pending exercise dispatch and Gateway runtime; real rehearsal/voice/channel acceptance |
| 3. Billing | #126 funded checkout, atomic reserve/settlement, receipt/recovery ShellDocuments | Active billing owner must reconcile current canonical auth/runtime, qualify catalog/recipient/fee policy, complete integrated deployment; billing remains disabled |
| 4. Economic UI | #90 durable Float command/history; this read-only ShellDocument view | Shared composition must mount view and replace legacy transfer with confirmed stable-RequestId command; eligible funding/payout routes |
| 5. WhatsApp/Telegram | #92 authenticated ingress; #96 compact Teaching callbacks | Shared identity linking, durable dedupe/outbox, callback custody, authorized media and outbound recovery |
| 6. Crypto operations | #124 recovery/qualification; #130 now implements mobile balances/deposit/conversion/withdrawal/history | Backend evidence/custody/settlement and shared runtime composition; actual account qualification and live acceptance must be freshly checked by its owner |
| 7. Recovery/support | #125 shell recovery merged; #123 onboarding resume | Operation-specific billing/crypto/channel reconciliation and complete outage/restart acceptance |


This records inspected source/PR boundaries, not a completion certificate. Active
ownership still forbids this window from editing shared Gateway/app/mobile/Commerce/
Teaching/channel/provider paths. No merge, production deployment or complete APK journey
is claimed by these projections.


## Current continuation evidence

PR #123 implementation 3698974204d565a6c6e0fc26505d8d92b4099e26 includes the mobile draft/review flow. Thirteen Dart controller/transport tests and analysis pass in a standalone source harness; 49 focused backend tests pass on current main plus owned source. Flutter/device execution remains separate. The old typecheck/85-test evidence above is historical: current main references missing unmerged runtime files. Latest inspection of #89/#90/#92/#94/#96/#124/#126/#128/#130 confirms those remaining integration paths have active owners; none was overwritten or imported wholesale. This handoff makes no new assertion about live provider credentials.
