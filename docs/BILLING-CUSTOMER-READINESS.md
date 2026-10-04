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
  funding authority.
- Masanawa independently verifies the Flutterwave transaction by reference and binds the unique
  provider transaction ID, exact reference, successful status, NGN currency and exact quoted total.
- Bill dispatch cannot start until that verified payment is atomically reserved against the exact
  fulfillment reference.
- Funding-payment references and bill-fulfillment provider references are stored separately.
- Failed/reversed fulfillment enters refund custody. Refund POSTs use a persist-before-send
  `refund-dispatching` guard; after an unknown outcome every later request is reconciliation-only,
  preventing blind duplicate refunds.
- Refund completion is not inferred from the browser or from an empty provider query.

### Customer authentication

- Public customer OTP routes now match the existing Flutter app contract:
  `/auth/otp`, `/auth/verify`, `/auth/refresh`, `/auth/logout`.
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

- Gateway now exposes authenticated billing quote, checkout, verification and status routes.
- Server-generated ShellDocuments provide recipient, service amount, fee, total, explicit
  confirmation, checkout status, verification and terminal/refund state.
- Phone-authenticated customers can supply a checkout email in the server-owned Shell form because
  Flutterwave hosted checkout requires one.
- Shell action tokens are HMAC-bound to the customer, quote, economic revision, action and expiry.
- Economic quote revision remains immutable while shell presentation revisions advance monotonically
  through checkout, funding, reservation, fulfillment and refund states.
- PR #104 was given the remaining generic shell integration requirement: after a shell action result,
  surface the trusted HTTPS external checkout link on explicit user tap while keeping all financial
  authority server-side. No billing-specific Flutter authority has been introduced on this branch.

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
- Tests cover the category-policy split for every category listed above, exact payment verification,
  duplicate-purchase protection and refund unknown-outcome protection.

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

The currently connected Railway account does not contain a Masanawa service, so this branch has not
been pushed into an unrelated Nurain/Nasfam production service.

## Remaining release evidence — not implementation claims

1. **Mobile shell integration:** PR #104/#125 owns the app shell. It must surface the authenticated
   checkout URL as an explicit user-tapped external HTTPS action and consume the updated
   ShellDocument after each server action. The coordination requirement is posted on PR #104.
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
