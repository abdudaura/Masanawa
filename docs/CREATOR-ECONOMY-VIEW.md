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
| 1. Onboarding | PR #123 draft persistence, six HTTP routes, profile/support ShellDocuments and action bridge | #104/#89 compose ports/routes/actions, enforce private directory visibility, supply qualified automatic personal-clone Core and support Characters |
| 2. Live Teaching | #94 exact Skill/Guide; #96 runtime/shell/channel contracts | #89 compose canonical progress/evidence ports and pending exercise dispatch; actual rehearsal and voice/channel acceptance |
| 3. Billing | #95/#97 provider and orchestration; #100 live webhook/relay work | canonical admission/custody/settlement, authenticated quote actions, full product receipts and restart/unknown-outcome journey |
| 4. Economic UI | current service; #90 durable Float command/history; this ShellDocument view | #104 mount view; Gateway replace legacy Float transfer with confirmed stable-RequestId command; eligible funding/payout routes |
| 5. WhatsApp/Telegram | #92 authenticated ingress and custody contracts | shared-owner identity linking, durable dedupe/outbox, callback resolution, authorized media and outbound replies/audio/receipts |
| 6. Crypto operations | #93/#98 catalog/live provider probe; #124 recovery hardening | qualified custody/customer-management/payout evidence and credentials, segregated reconciliation, fee-confirmed conversion/withdrawal and live acceptance |
| 7. Recovery/support | onboarding resume plus #104/#125 shell recovery | compose operation-specific status/reconciliation/support and exercise the complete customer journeys across outages/restarts |

This records inspected source/PR boundaries, not a completion certificate. Active
ownership still forbids this window from editing shared Gateway/app/mobile/Commerce/
Teaching/channel/provider paths. No merge, production deployment or complete APK journey
is claimed by these projections.
