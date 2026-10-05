# Billing customer readiness

The existing live NGN100 Airtel test succeeded through the fixed-IP DigitalOcean relay at
`209.38.107.173`. The Droplet is still present and active. That proves provider access and
one funded airtime path; it does not by itself prove customer checkout or every account-enabled
biller.

## Implemented on PR #126

### Customer NGN funding and custody

- Dedicated `commerce.billing_quotes` custody is separate from AI Credits, creator Float and
  crypto balances.
- Quote economic terms are immutable: tenant/user/category/biller/item/customer/service amount,
  fee, total, NGN currency, expiry and quote revision.
- Money is represented as exact integer kobo at the authority boundary.
- Flutterwave Standard checkout is created server-side. Browser redirect/callback state is never
  funding authority. A durable `checkout-dispatching` claim is persisted before the external
  checkout POST; concurrent/retried starts cannot create a second hosted checkout.
- Masanawa independently verifies the Flutterwave transaction by reference and binds the unique
  provider transaction ID, exact reference, successful status, NGN currency and exact quoted total.
- Bill dispatch cannot start until that verified payment is atomically reserved against the exact
  fulfillment reference.
- Funding-payment references and bill-fulfillment provider references are stored separately.
- Failed/reversed fulfillment enters refund custody. Refund POSTs use an atomic persist-before-send
  `refund-dispatching` claim; only the actual database claimant may POST. Concurrent requests
  therefore produce exactly one external refund attempt, and unknown outcomes are reconciliation-only.
- A refund is not marked complete merely from status text: final provider status and the exact full
  refunded NGN amount must match the customer's paid total. Partial/ambiguous refunds remain in
  reconciliation.
- Hosted checkout dispatch is admitted before quote expiry, so a slow provider response/payment may
  settle after the short quote TTL. Live bill terms are re-derived before fulfillment; changed terms
  fail into refund custody rather than stranding verified funds.
- NGN parsing, percentage fees and totals use exact integer/BigInt arithmetic at the safe boundary.
- Funding/payment references and bill-fulfillment provider references remain separate, and delayed
  prepaid electricity tokens/codes are recovered from durable fulfillment evidence without redispatch.

### Customer authentication

- Public customer OTP routes now match the existing Flutter app contract:
  `/auth/otp`, `/auth/verify`, `/auth/refresh`, `/auth/logout`; GET
  `/auth/capabilities` projects only OTP channels actually configured at runtime.
- Email and E.164 phone identifiers are normalized and linked to canonical Identity Users.
- First signup provisions the canonical platform tenant idempotently in the same transaction.
- OTPs are HMAC-hashed, bounded by expiry/attempt/cooldown rules and are not stored in plaintext.
- The existing two-step mobile signup flow is supported: a valid OTP is not burned when the server
  returns `NAME_REQUIRED_ON_SIGNUP`; it is consumed only when sign-in can complete.
- Access and refresh tokens are opaque random credentials stored only as SHA-256 hashes. Refresh
  rotates both credentials and logout revokes the access session.
- Per-customer platform sessions now provide financial authority. The Alpha shared token remains a
  development fallback and is not the intended public billing authority.
- Resend delivery is implemented for email OTP. The connected Resend account currently has
  `masanawa.com` verified with sending enabled. SMS is intentionally a pluggable HTTPS provider
  and requires a real SMS provider endpoint/token before SMS login may be advertised as available.

### Mobile/server checkout contract

- Gateway now exposes authenticated billing quote, checkout, verification, status and customer
  billing-history routes.
- Server-generated ShellDocuments provide recipient, service amount, fee, total, explicit
  confirmation, checkout status, verification and terminal/refund state.
- Phone-authenticated customers can supply a checkout email in the server-owned Shell form because
  Flutterwave hosted checkout requires one.
- Shell action tokens are HMAC-bound to the customer, quote, economic revision, action and expiry.
- Economic quote revision remains immutable while shell presentation revisions advance monotonically
  through checkout-dispatch, checkout, funding, reservation, fulfillment and refund states. Clients
  must treat presentation revision as opaque/monotonic rather than hard-code stage numbers.
- PRs #104/#125 are now merged into `main`. Inspection of the merged shell confirms document
  replacement works, but `shell.action.updated` currently drops `result.message`; therefore the
  secure hosted-checkout URL is not yet surfaced by that action path. The merged agent conversation
  authorizer is also still Alpha-token based, while billing uses per-customer platform sessions.
  These are integration gaps to reconcile on current `main`, not reasons to duplicate financial
  authority in Flutter.

### Bill-service policy

Flutterwave's current Nigerian category sample includes:
`AIRTIME`, `MOBILEDATA`, `CABLEBILLS`, `INTSERVICE`, `UTILITYBILLS`, `TAX`,
`DONATIONS`, `TRANSLOG`, `DEALPAY`, `RELINST`, and `SCHPB`.

- Only categories/billers/items returned by the live NG/NGN catalog may be quoted.
- Airtime/mobile-data use phone-number validation and do not call provider recipient validation.
- Every other current category uses provider customer validation before a quote is accepted.
- Fixed-price catalog items require the exact provider amount; zero-priced provider items are treated
  as variable-value items and still respect provider minimum/maximum evidence.
- Electricity uses `UTILITYBILLS`, validates the meter, and prepaid token recovery continues through
  bill-status reconciliation; a delayed token is never recovered by sending another purchase.
- Category is part of the immutable funded-reserve authority, so a client cannot relabel a
  utility/cable item as airtime to bypass recipient validation.
- Manual-review fulfillment is read-only reconcilable: corrected exact provider evidence may reach a
  terminal state without sending a second purchase.
- Tests cover the category-policy split for every category listed above, exact payment verification,
  category tamper rejection, exactly-once checkout/purchase/refund boundaries, delayed checkout after
  TTL, partial-refund handling, token recovery and refund unknown-outcome protection.

## Deployment configuration

Customer billing remains fail-closed unless the complete production composition is present:

- `FLUTTERWAVE_BILLS_ENABLED=true` only after acceptance.
- `FLUTTERWAVE_SECRET_KEY`
- `FLUTTERWAVE_WEBHOOK_SECRET_HASH`
- `FLUTTERWAVE_WEBHOOK_URL`
- `FLUTTERWAVE_RELAY_URL`
- `MASANAWA_FLUTTERWAVE_RELAY_TOKEN`
- `FLUTTERWAVE_RELAY_PROTOCOL=dual-header` for the deployed DigitalOcean relay.
- `MASANAWA_PLATFORM_TENANT_ID`
- `MASANAWA_AUTH_OTP_PEPPER` (at least 32 random characters)
- `RESEND_API_KEY`
- `MASANAWA_AUTH_EMAIL_FROM` (recommended: `Masanawa <auth@masanawa.com>`)
- Optional SMS: `MASANAWA_AUTH_SMS_ENDPOINT` + `MASANAWA_AUTH_SMS_TOKEN`
- `MASANAWA_BILLING_ACTION_SECRET` (at least 32 random characters)
- `MASANAWA_PUBLIC_BASE_URL` or explicit `MASANAWA_BILLING_REDIRECT_URL`
- `MASANAWA_BILLING_FEE_BPS` and `MASANAWA_BILLING_FEE_FIXED_KOBO` for the chosen fee policy.

The currently connected Railway account does not contain a dedicated Masanawa Gateway service.
The `@nurain/worker` variable inventory does contain Masanawa/Flutterwave/auth variable **names**
(including platform-tenant and Resend names), but values are redacted and the service remains the
Nurain worker. Variable presence there is not Masanawa deployment or billing-readiness evidence, and
this branch has not been deployed into that unrelated runtime as a release.

## Remaining release evidence — not implementation claims

1. **Current-main integration:** rebuild/reconcile this billing slice onto current `main` without
   reintroducing the historical branch's unrelated mobile/Gateway changes. The merged shell must
   surface the trusted HTTPS checkout result on explicit user tap, consume auth capabilities, and
   authorize agent/shell actions from the same per-customer platform session identity that owns the
   billing quote.
2. **Live account catalog qualification:** run read-only catalog/biller/item discovery through the
   whitelisted relay and record which categories are actually enabled for this Flutterwave account.
   Do not publish a biller merely because it appears in Flutterwave documentation.
3. **Recipient acceptance evidence:** cable/internet/utility live validation needs real non-secret
   customer identifiers suitable for acceptance testing. No real bill should be purchased merely to
   prove validation.
4. **CI/build evidence:** the latest GitHub Actions runs are currently failing before runner
   assignment: the `check` job has no steps or logs and finishes within seconds. Therefore the new
   commits are **not** being represented as CI-passing yet. The prior PR handoff had 162 passing
   tests and three package typechecks before this implementation batch.
5. **Final deployment/device acceptance:** apply migrations, deploy the final integrated Gateway with
   billing still disabled, exercise email OTP + hosted checkout in test/controlled conditions, then
   enable billing only after final APK/device acceptance. No new live financial purchase was made in
   this implementation batch.

Customer billing should remain disabled until items 1–5 have concrete evidence. The code is now
fail-closed when those dependencies are absent rather than silently falling back to an unsafe
customer path.
