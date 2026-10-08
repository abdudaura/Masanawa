# U23 — secure invitations and opt-in sharing (2026-10-08)

**Status: PARTIAL_IMPLEMENTATION — DRAFT / UNMERGED / NOT END-TO-END VERIFIED.**
**Owner: isolated U23 workstream; five-minute ownership claims were made before coding and renewed through consecutive commits.**
**Branch:** \`work/u23-safe-invite-share-20261008-gpt6\`
**Exact base main:** \`5e758673ae91082520b21b3153da53791ae2cbf3\`
**Substantive source/test checkpoint:** \`c10f4cc87b25653dd86150cad74652de0731f177\`.
This handoff commit follows that source checkpoint; inspect the PR head for the final handoff SHA. No production/CI/device deployment was performed.

## Collision and ownership audit

Read \`CONTINUE-HERE.md\`, \`docs/UNFINISHED-SCOPE-RECONCILIATION-20261008.md\`, \`docs/ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md\`, the Contacts spec, final handoff format, and \`docs/MULTI-WINDOW-WORK.md\`. Live branch/PR search found U21 and U22 independently active; U24 has \`work/u24-message-requests-privacy-20261008-gpt6\`. U23 had no matching existing branch/PR. C01 #468, U21, U22, R15 and F12 are separate authorities. No shared composer, Flutter root router, native Firebase, payment, ledger, contact import or C01 migration edited.

## Committed implementation

**Backend / security**
- \`services/gateway/src/contact_invites/token.ts\`: AES-256-GCM versioned authenticated encryption, purpose-bound key derivation, random nonce, canonical unpadded base64url parser, 24h issue TTL (7d hard max), clock/future bound, strict types/lengths and generic rejection. Internal tenant/user IDs are **not visible as plain base64** in shared links. Token is a *suggestion*, never DM/contact access, referral credit, or evidence of identity.
- \`services/gateway/src/contact_invites/service.ts\`: existing Platform customer bearer session authorizer + canonical TalkProfileService self read; mandatory injected C01/R15 \`InvitePrivacyAuthority\` on both issue and each readback, and mandatory durable \`InvitationQuota\`. No fail-open implementation of privacy or quota is provided. Returns only a signed link/expiresAt or suggested public @handle, not name/phone/DM.
- \`services/gateway/src/contact_invites/routes.ts\`: isolated POST \`/invites\`, GET \`/invites/:token\`, no-store and no-referrer response restrictions. Must be registered by the **single Gateway composer** after real dependencies are supplied.
- \`services/gateway/src/contact_invites/postgres_quota.ts\`: atomic tenant/user/UTC-day Postgres quota (20/day) with conditional upsert; DB errors propagate fail-closed.
- \`services/gateway/src/contact_invites/001_invite_quota.sql\`: isolated quota schema; **NOT registered or applied**, requires sequencing and review by migration authority. No raw number/token/addressbook storage, no referral money ledger changes.

**Flutter mobile**
- \`apps/mobile/lib/src/contact_invites/invite_share.dart\`: generic nonpersonal HTTPS app invite, server-issued personal invitation URL validator, OS chooser via already-declared \`share_plus\`, account-session identity fencing before/after server issuance, no persistent token cache.
- \`apps/mobile/lib/src/contact_invites/invite_share_http_transport.dart\`: authenticated canonical ApiClient POST, typed 401/403/429/unavailable/malformed-result behavior, rejected expired links; no fake offline signed fallback.
- \`apps/mobile/lib/src/contact_invites/invite_share_sheet.dart\`: opt-in share and copy controls, generic invitation usable with denied phonebook permission, optional personal invite only when permitted by the parent, busy/error/accessibility-safe state. Not mounted into Chats/Contacts while U21/F12 own that route.

**Public web fallback**
- \`apps/web/src/app/invite/page.tsx\`: generic landing, safe sign-in explanation, no payment/contact acceptance promises.
- \`apps/web/src/app/invite/[token]/page.tsx\`: no-index personalized landing, strict token format, HTTPS-only configured Gateway resolution, no redirects, no-store and timeout. Invalid/expired/hidden/unavailable link has one generic fallback. Token never launches an authenticated DM.

**Tests authored (not executed):**
- \`services/gateway/src/contact_invites/service.test.ts\`
- \`services/gateway/src/contact_invites/postgres_quota.test.ts\`
- \`services/gateway/src/contact_invites/routes.test.ts\`
- \`apps/mobile/test/contact_invites/invite_share_test.dart\`
- \`apps/mobile/test/contact_invites/invite_share_sheet_test.dart\`

Coverage written: bearer/self-read, privacy denial/revocation, quota fail-closed, tamper/expiry/future/wrong-key rejection, no leaked IDs in URL, API result/status/no-cache, invalid origins and query redirects, sign-out isolation and explicit system-share gesture.

## Missing source / integration (hard blockers to feature availability)

1. **P0 C01/F14 + R15:** provide a real \`InvitePrivacyAuthority\` adapter backed by canonical tenant/user/handle/profile discoverability, account active state, block/revoke/deletion and policy. \`mayShare\` and \`mayResolve\` must recheck current server state. Draft C01 #468 isn't on main. No dummy \`true\` implementation is allowed in production.
2. **Migration authority:** review and register \`001_invite_quota.sql\` in the canonical ordered migration manifest; run disposable PG18 apply/reapply/rollback and concurrency tests. Arrange old quota retention and deletion cleanup with R12. Do not run alpha/demo bootstrap on production.
3. **Gateway composer:** inject existing session authorizer, TalkProfileService, privacy authority, Postgres quota and a random >=32-byte \`MASANAWA_INVITE_SECRET\` (server-only, from secrets manager), then register routes exactly once. Add edge/public GET IP/abuse budgets without logging or indexing encrypted URL tokens. Secret rotation invalidates existing invites; specify rotation/incident procedure.
4. **U21/F12/mobile:** mount \`InviteShareSheet\` in the real nested Contacts screen and hand it \`GatewayInviteLinkTransport(ApiClient)\` and a stable full account/session key. Never add a sixth tab, import device numbers, or route to AI Chats. Actual C01 recipient consent and exact @handle lookup after normal auth must be reused.
5. **Web/mobile deployment:** set \`MASANAWA_PUBLIC_GATEWAY_URL\` to the actual HTTPS Gateway endpoint. Verify \`masanawa.com/invite\` hosting, Android app/web sign-in/install link, authenticated return after OTP (without persisting tokens in analytics or referrers), and official store fallback. Existing web home is only a foundation page, not a real signup/install site. Existing canonical Talk/Twin sharing is separate; verify public eligibility and web fallback there without copying those implementations.
6. Confirm real anti-abuse lifecycle for issuer identity/privacy across contact revoke, hidden account and user deletion and add account-swap/restart/replay checks. Personal invitations are not enabled until this is wired.

## Executable evidence vs deferred checks

**Actual tests executed:** NONE. The current GitHub Actions budget/runner problem is tracked as #457; this window has no runnable Flutter SDK or installed monorepo dependencies and did not deploy/test signed Android, a real PG18 DB, hosted Next, or two actual user accounts. Test files are source coverage, **not E2E evidence**.

**Work reproduction commands** after reconciling dependencies and registering schema/routes (from repo root, adapt to current package script paths):
- \`pnpm --filter @masanawa/gateway-service exec vitest run src/contact_invites\`
- \`pnpm --filter @masanawa/gateway-service typecheck\`
- \`pnpm --filter @masanawa/web-app typecheck\`
- \`cd apps/mobile && flutter test test/contact_invites && flutter analyze\`
- disposable PG18 migration/tenant concurrency test + Fastify inject with the REAL privacy service
- Android/iOS: consented system share, device contact permission declined/revoked, malformed/expired link, full registration/OTP return, A signs out/B signs in, account hidden/blocked/deleted, recipient manually chooses whether to request contact
- Final CI/Android/provider verification and merge only after current Work #497, C01/F14, R15, U21/F12 and shared migration integration are reconciled.

**No changes to financial controls, Firebase credentials/config, five-tab root, public Talks identity, or internal money transfer authority.**
