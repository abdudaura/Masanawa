# J22: authorized per-Masana Telegram inbound and reply — source-to-release acceptance

State: **SOURCE_IMPLEMENTED_UNVERIFIED (partial integration)**, never production-activated. This is a continuation of L-SOCIAL existing PR #626 and J21. The existing verified social identity, connections, provider event dedupe, and canonical events.outbox are reused; there is no personal WhatsApp automation or second fan chat database.

## Exact source components

- Consumer C44/C78/C79: `MasanaTelegramScreen` reads only verified published J21 social links; explicitly explains link-only and permission; clears content on account/Masana switch; opens only official `t.me` / `telegram.me`.
- Android staff A22/A24/A25: `TelegramConnectionAdminPage` reads the server's existing social accounts, shows status, and uses existing audited pause/revoke mutations. Never collects or displays bot tokens.
- Canonical contract: strict official private fan updates, per-Masana/tenant HMAC fan identity; `/start` records pending consent, `/agree` opts in, `/stop` revokes.
- Fastify: webhook requires default-off flag, published and verified platform Masana, current server-side official Telegram bot permission and expiry, exact 32+ character vault-sourced `X-Telegram-Bot-Api-Secret-Token`, bounded payload. Never trusts caller-supplied tenant/character.
- PostgreSQL: forward-only `packages/masana_social/migrations/0002_telegram_inbound.sql`, tenant composite consent; dedupe `masana.social_events` and atomic `events.outbox`; no raw chat ID, access token, or message body in SQL. Staff pause/revoke and consent are checked again by the worker.
- Worker: event ID + opaque encrypted private reference handed to the **existing** Masana session executor; default off when no authorized provider, consent or canonical dispatcher.

## Mandatory executable acceptance (NOT yet run)

1. On disposable PG18, apply existing migration checks and both social migrations. Verify fresh, restored upgrade, checksum immutability, correct tenants and no changes to existing ledger records.
2. Register an actual verified Telegram bot with official Bot API credentials in the server vault. Review bot ownership for the target platform Masana; record authorized inbound/outbound capabilities with expiry, approval evidence, and per-character rate budgets. No client token injection.
3. In Android Admin, verify/publish a Masana Telegram identity. Verify link-only mode does *not* run an automated reply. Provision audited eligibility through AF00's server credential authority; use a provider sandbox/test bot.
4. POST forged webhook secret, unknown bot, other Masana, group chat, bot sender, invalid payload and expired authorization. Expect denial, zero durable fan text and zero outbox.
5. As one private Telegram fan, send `/start`, then non-consented text. Expect no outgoing answer. Send `/agree` and text: expect one committed provider event, encrypted private payload, one outbox dispatch and only that Masana's pre-existing session. Re-send identical update ID: no second execution. Kill worker after lease and resume without duplicate delivery. After `/stop`, pause or revoke: previous queued work cannot deliver.
6. Switch accounts/Masana in Flutter/Admin. Verify no stale social link or account data, loading/offline/retry/403 and external-app fallback. Verify staff role restrictions and audit.
7. Run Node24/pnpm12 TypeScript, Vitest, PG18 fresh/upgrade/restore, Flutter analyze/widget, signed Android debug/release and device tests on pinned unified SHA. Record actual failures; no mocked success substituted for real Telegram provider evidence.

## AF00-protected integration prerequisites

- Root shared modules/worker registration, session principal and event lease worker belong exclusively to AF00.
- Add `@masanawa/masana-social` workspace dependency to the Gateway/worker/PostgreSQL manifests, generate frozen `pnpm-lock.yaml` on Node24/pnpm12; mount migration root exactly once.
- Inject vault-backed webhook secret, independent HMAC key and private encrypted object storage plus permissioned Masana session dispatcher. Sender must handle Telegram API ambiguous outcomes without blind retries. Staff eligibility must be reviewed and documented before any `verified_automation_eligible` mode can be entered.
- Wire both feature screens through AF00's root route/admin drawer using authenticated tenant-scoped Dio.
- Even after source merge into non-deploying `integration/rebuild`, keep all provider and automation kill switches OFF. No Railway-linked `main` or real automation until verified provider authorization and release gates.

No claim of deployed Telegram bot, provider credentials, runnable APK, PG migration execution or qualified end-to-end J22 is made.
