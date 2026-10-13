# AF01 — Staged MSN settlement integrity and NGN reconciliation (2026-10-13)

## Scope and authority
- Base: `main@6ed4af48fe4ea2fc53c8447dc83434c9c86d25e3`.
- Branch: `lane/af01-msn-settlement-integrity-20261013-gpt6`; exact-path claim `af01-msn-settlement-integrity-20261013-gpt6` on `factory/claims` (acquired before edits).
- Existing canonical source only: `services/gateway/src/msn_wallet/store.ts`, `reconciliation.ts`, their tests and real PostgreSQL18 reconciliation tests. No shared Gateway/Worker composition, migration registry, new ledger, prices, customer issuer endpoint, payment provider calls, or flags.
- Preserve imported immutable quote journal, existing Flutterwave/NGN authority, the PG double-entry constraint, global settlement-ID uniqueness and normal billing wallet lock.

## Source milestone
1. Bind MSN settlement issuance to the exact immutable persisted quote (tenant/account/rail/funding reference/NGN kobo/asset/network/minimum backing/price/provider quote and both times) inside its debit-and-issuance transaction.
2. Reject a missing durable provider fiat verification, a conflicting credited intent provider receipt, a differently bound funding quote, and forged pricing/admission. Compare full integer micros and kobo, not floating point.
3. Lock credited funding intent **before** the canonical NGN wallet advisory lock, preserving the order used by Flutterwave creditFunding and avoiding issuer-versus-webhook lock inversion. Check the shared spendable NGN balance before debit.
4. Scan the exact NGN conversion debit alongside the immutable MSN two-sided ledger: detect absent, duplicate, underpaid, malformed and orphan debits; never infer custody from this internal accounting.
5. Add unit negative tests and real PG18 tests for missing verified events and actual posted NGN conversion debit.

## Production/verification boundary
- This is **source-only pending executable checks** until exact-HEAD hosted CI succeeds. Use existing `AF01 Staged MSN Reconciliation` and `AF01 MSN Qualified Balance` workflows; execute Gateway/Worker builds, Vitest and real PG18. Mock settlement fixtures are **not** independent provider evidence.
- `packages/commerce/migration_proposals/0112_msn_wallet.sql` stays a **proposal**, outside production migrations. No production MSN wallet, issuance, reconciliation worker or customer activation is authorized; keep **all** MSN flags OFF.
- Railway `empowering-education` on 2026-10-13: Gateway, old Worker and PostgreSQL offline; `masanawa-postgres` volume remains attached to legacy `@nurain/contracts`. Its contents, backup/restore and migration ledger were not accessible/verified. Current Gateway tracks `weavewellindustrieslimited/masanawa:main`; old worker tracks `Baatiku/masanawa:work/billing-customer-journey-20261004`. No destructive operations performed.
- New source does **not** qualify real NOWPayments/Flutterwave custody, acquired and globally reserved backing, licensed conversion, live DB deployment or two-account Rooms acceptance. An actual custodian/provider verifier and independently authorized operator must supply truthful evidence; do not set booleans true from customer JSON, a hash alone, mocked CI or read-only reconciliation.

## Live Rooms blocker and next actions
- `packages/rooms/migrations/0006_membership_invites.sql` is present in main, membership gate remains OFF, and staged Rooms CI/PG checks on prior PRs are not a live migration.
- When the existing Railway subscription/database is operable without replacement infra, verify provider deployment identity and relevant Gateway/Worker versions, record a non-destructive independent backup-and-restore drill, inspect migration ledger and apply only reviewed additive migrations. On protected stage, test two genuine accounts: invite, join, replay, revoke, ban/unban/concurrent join, paid-denial, account switching, rollback with feature flag OFF.
- No staff-review gates for ordinary Room questions. Preserve Chats, Status, Wallet, Calls, Rooms and 26 titled Masana professionals, portraits and lessons.

## Next-window direct prompt
Continue `weavewellindustrieslimited/masanawa` from fresh `origin/main`. Reconcile merged PRs, CI and exact-path claims; read `AGENTS.md`, `CONTINUE-HERE.md`, `docs/MULTI-WINDOW-WORK.md`, `docs/workstreams/UI-CONTINUATION-QUEUE-20261012.md`, `docs/workstreams/AF10-room-membership-lifecycle-20261013.md` and this handoff. Preserve completed MUI/AF07/AF05/AF10 work and all five tabs. Qualify the existing Railway Gateway/PG/canonical Worker by verifying deploy identity, volume backup/restore, migration 0006 and real two-account Rooms invitation/moderation/paid-denial/rollback; do not replace DB or activate membership until live proof. Continue the canonical, custody-backed MSN issuance journey only with real verified provider backing and globally reserved settlement, exact NGN debit and immutable reconciliation; keep every MSN flag and 0112 production migration OFF until qualified. Merge compatible source after real executable CI; report exact SHAs, test outcomes, unresolved provider/handset/production blockers and next prompt.
