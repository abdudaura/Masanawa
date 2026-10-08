# U29 – Customer support, payment uncertainty and consented escalation

**Updated:** 2026-10-08; **status: PARTIAL_IMPLEMENTATION / unverified draft, NOT DONE / NO MERGE / NO DEPLOY**.

## Ownership, immutable checkpoints and collision safety

- Repository: `Baatiku/masanawa`
- U29 exclusive owned root: `services/gateway/src/customer_support/**`, `apps/mobile/lib/src/customer_support/**`, `apps/mobile/test/customer_support/**`; this handoff.
- Branch: `work/u29-real-customer-support-20261008-gpt6`; draft PR: [#512](https://github.com/Baatiku/masanawa/pull/512).
- Latest inspected `main` at claim: `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Initial repository-visible claim SHA: `62c1dcf4cfb124d81ee9ff2c7da6e154c4f82ea5`.
- **Last substantive source commit (16 code/test files): `d6388328f12a6af5bd11babe9c91794af422433a`.** The final handoff-only commit SHA appears in PR #512 head after this file update. Review the PR head before integration.
- Scope selected after finding U21 #508, U22 #509 and active U23/U24 branches; no U29 branch/open PR at claim. U25/U26/U27/U28/U30 unclaimed at that point but U29 was independently runnable without a shared route edit.
- Shared `app.ts`, `main.ts`, Flutter root tabs/router, migration registry, Firebase #461 and Work #497, R05–R08/C06 money authority and R15 moderation source **untouched**. No competing SQL schema or production migration was installed.
- Contract: `POST /v1/support/operations/status` with authorized `{kind,reference}` -> masked `referenceMask`, phase and caution (read-only by design, no provider reconcile); `POST /v1/support/tickets` requiring requestKey UUIDv4, explicit `shareWithSupport:true`, summary 20–1000 and optional verified reference; `GET /v1/support/tickets`, `GET /v1/support/tickets/:id`; optional staff `/v1/support/admin/**` only when role authorizer is qualified.

## Implemented SOURCE (not integrated runtime)

### Database and backend

1. `0001_customer_tickets.sql` defines isolated `support.customer_tickets` with composite tenant/ticket owner PK, unique (tenant,user,request-key), digest equality for idempotency, constrained types/status and indexed user history/triage; explicit consent timestamp; `support.ticket_events` append-only status audit. Script **not yet in F11 central migration manifest**.
2. `postgres_repository.ts` stores server-issued ticket UUID, user+tenant-scoped read/list and reuse of identical idempotency key; no stored unverified operation reference. Support status is never inferred from the client's self-report.
3. `service.ts` obtains identity from canonical `PlatformCustomerSessionAuthorizer`; proves financial lookup via injected source-owner reader; uses Billing `list()` as a **read-only** scoped source, never `read()`, `verifyAndPurchase`, checkout or any refund operation. Only a verified operation becomes attached to a ticket. Unknown/other-user/hidden references respond generically. Reference lookup uses request BODY rather than route path (avoid URL logging). Unsupported/uncomposed crypto provider matching cannot claim confirmed success.
4. `routes.ts` uses strict TypeBox body/query/param validation, authenticated error envelope, `Cache-Control:no-store` for operation status and no extraneous body fields. Source registration is opt-in and **not mounted** on production Gateway.
5. `operator.ts` and `operator_routes.ts` provide bounded queue review, staff CAS state transitions with durable audit in one SQL statement, and strict status graph. **Must not register staff routes** unless a production-grade role-permission authorizer has been injected (ordinary customer tokens are insufficient). A queued ticket means durable support queue, **not email/Telegram delivery nor a human response**.

### Flutter UI, state and privacy

1. `models.dart` fails closed for unknown server payment statuses/ticket states; public responses show only masked financial references.
2. `transport.dart` uses the *existing ApiClient Dio bearer and 401 refresh* rather than a developer token; requests fail closed without a signed-in access token; random cryptographic v4 idempotency keys prevent ambiguous retries creating multiple tickets.
3. `support_screen.dart` is a nested optional support view to be wired by F12 in Assistant, Wallet and Chats (never a sixth tab). Separate money status and support-ticket list; caution on uncertain provider state; a verification failure leaves a **general** support ticket (without forwarding unverified reference); explicit checkbox and anti-OTP/private-chat disclosure text; manually refreshable ticket statuses. Requests carry no DM content or attachments.
4. Active user ID and asynchronous generation fence avoid displaying another account's data after logout or switch; protected state/draft clears on session change; failure retains a key for safe retry, never recharges the customer. Actual full reboot/handset recovery is NOT verified.

### Tests authored (not executed)

- `service.test.ts`: unauth/other account, masked pending, consent, idempotency replay/mismatch, ticket isolation, unsupported kind, read-only Billing adapter.
- `postgres_repository.test.ts`: scope in SQL and no raw ref in response, conflict digest guard.
- `routes.test.ts`: guest denied, unowned reference, consent and unknown field rejected.
- `operator.test.ts`: customer role denial, forbidden transitions, atomic audit/CAS SQL.
- `apps/mobile/test/customer_support/support_screen_test.dart`: auth gating, stale account A response after B switch, pending payment messaging, consent and same UUID retry after failure.
- `transport_test.dart`: secure v4 key shape and DTO fail-closed unknown status.

## Verification record: DO NOT MISREPORT

- **Actual test executions:** NONE. `pnpm` workspace/dependency checkout, Dart/Flutter toolchain and PostgreSQL 18 disposable database were **not available here**. Container `git ls-remote` failed because `github.com` could not resolve; local Node/tsc presence alone is not a valid repository build. Do not repeatedly retry unavailable CI #457 or claim GitHub workflow success.
- **Executed static source inspection only:** 16/16 expected code/test files fetched from exact branch; 10 source predicates PASS for auth call, tenant/user SQL, consent, masked POST status not URL, staff audit, owner switch fence, retry key, and absence of payment mutation calls. These are **NOT** typecheck, Vitest, Flutter, PG or device evidence.
- **Committed source:** GitHub git-object API, verified new branch and commit refs, independent of local checkout. Diff from base includes no shared protected source files.
- **Provider status:** no real Flutterwave/NOWPayments transaction or customer data was accessed. No support inbox, webhook, human notification or staff operator credentials configured.

## Exact next integration / qualification tasks for ChatGPT Work

1. Before starting, refetch latest `main`, #512 head and all R/C/U/F PRs/leases, check stale or duplicated paths. This code is **not merged**. Keep competing C02/C05/C06 migrations separate. Preserve the five-tab Talks · Chats · Assistant · Wallet · Agents shell, Firebase #461 and #497's composer.
2. **F11/migration owner:** classify this isolated SQL against current migration roots and choose a noncolliding canonical sequence; apply to *disposable PG18* and test create/list/idempotency under concurrent requests, indexes, locks, rollback/restart and wrong-tenant scope. Validate production permissions and retention/deletion path (R12).
3. **Gateway composer owner:** inject current tenant-aware `createPlatformCustomerSessionAuthorizer`, `createPostgresSupportTicketStore`, `createCustomerSupportService` and read-only Billing adapter; register `registerCustomerSupportRoutes` only after SQL. R08/C06 financial owner must add an independently verified owner-scoped crypto operation reader, or leave crypto status deliberately unavailable.
4. **Operator/roles owner:** build a real session+role staff authorizer (no bearer token bypass), add privileged queue routes only behind it, and hook actual support inbox/staff workflow with delivery/readback, data minimization, audit and lawful retention; do not present `queued` as delivered. Add authorization/CSRF/rate/abuse limits as needed after review.
5. **F12 Flutter router owner:** mount the standalone `CustomerSupportScreen(transport: GatewayCustomerSupportTransport(ref.read(apiClientProvider)), ...)` for explicit **Need help** from Assistant, Wallet and Chats. Existing billing quote ID may be passed only from account-owned receipt/history, not AI-generated text. Retain five-tab layout and sign-out state fencing. R14 may deliver support status via privileged push after notification privacy check.
6. **Run checks in checkout** (currently UNRUN):
   - `pnpm --filter @masanawa/gateway-service typecheck`
   - `pnpm exec vitest run services/gateway/src/customer_support`
   - `cd apps/mobile && flutter analyze`
   - `cd apps/mobile && flutter test test/customer_support`
   - PG18: migrations, parameterized SQL, concurrent duplicate requestKey and operator compare-and-set audit, wrong-tenant, logout and account-delete tests. Execute real A/B identities + support staff/anonymous cases, provider timeout/unknown, offline retry and a device API status refresh.
7. Resolve any compiler/test findings before merge. Evaluate strict size limits, support-body privacy and log redaction, operator status delivery, ticket attachments upload only if R15/R18 storage consent policy is qualified. Independently review replay/idempotency contract and compare with current invoice/custody controls. Do not initiate provider charge/refund while inspecting a support ticket.
8. **Exit criteria:** code composed + migrated, secure account/admin auth, real ticket A→staff→A readback and masked provider unknown recovery, passing gateway+mobile+Postgres+device tests and CI verified on the exact integrated SHA. Only then consider eligible merge/release. Until then **PARTIAL_IMPLEMENTATION / DRAFT / UNVERIFIED**.

## Known intentional boundaries

- Billing status supports at most the latest **100 account-owned quotes** via existing read-only history; older quotes return a generic unavailable response, not proof of failure. Refactoring a non-mutating indexed owner lookup belongs to R05 owner.
- Crypto reader is a dependency seam only: no live custody statuses guessed or unsafe number/reference matching.
- This PR does not integrate global navigation, production migrations, staff-role permissions, support delivery, customer attachments, notifications, real provider reconciliation, account deletion or signed builds. Those missing integrations are **not source-complete** and not represented as done.
- Account security/privacy controls never mean the app's assistant may ingest private human DMs by default; users must explicitly supply their own support description.
