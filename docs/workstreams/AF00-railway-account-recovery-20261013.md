# AF00 — Railway account recovery and canonical deploy identity (2026-10-13)

## Source scope and non-destructive boundary

- Starting main: `84fb4a75148b84304d42ac4be1fdb77e6e9fbf4a`.
- Branch: `lane/af00-railway-recovery-contract-20261013-gpt6`.
- Exact-path registry: `af00-railway-recovery-deployment-contract-20261013-gpt6`, `factory/claims`.
- Restore target, Railway project IDs, deployment IDs, secrets, volume content, current PG size, backup status and Railway billing state: **NOT_VERIFIED** in this tool session. The installed Railway app did not expose project-management actions; GitHub repository access is confirmed, not Railway access.
- **No volume, database, service, secret, account, DNS, subscription, provider or production flag has been created, deleted, migrated or modified in Railway.**

## Connected source delivered

1. Canonical Worker container in `infra/deployment/worker/Dockerfile`, built from this repository, Node 24, pnpm 12.8.2, worker workspace and dependencies. Worker `railway.toml` uses the separate `@masanawa/worker-service` and `/readyz` database-schema readiness, not the legacy `@nurain/worker` webhook proxy.
2. Gateway `start` no longer silently applies schema migration during an automatic Git-based deployment. The existing explicit `pnpm --filter @masanawa/gateway-service migrate` remains a separate operator command. Gateway Railway probes `/readyz`, not the process-only `/healthz`. Missing/outdated/drifted PG18 schema fails readiness; no false healthy promotion.
3. Dedicated GitHub Actions contract `railway-deployment-contract.yml` builds exact Gateway + Worker and checks deploy identity/migration fencing. No production credentials or Railway API calls in Actions.
4. No change to MSN financial source, `0112_msn_wallet.sql`, Rooms authorization, auto answer, mobile five-tab layout or data schema.

## Recovery and actual end-to-end gate

1. In the authorized Railway connection, **read-only** discover the new workspace/project and expired project's last deployment/volume/backup/permission/billing state. Record projects, service IDs, exact repo/ref/source SHA and health evidence. Check whether expired volumes remain mountable/exportable before any replacement operation.
2. Preserve original `masanawa-postgres` 500 MB configured volume; do not equate size with saved data. Obtain an **off-account encrypted logical backup** or verified independent provider snapshot. Confirm required pgvector/PG18 extensions and object-store refs, archive digest, row/schema/ledger summaries and attachment lineage without exposing private content in CI/chat.
3. **Restore into an isolated, non-public, disposable PG18 database**, with ALL outgoing jobs/notifications/webhooks/LLM/provider money actions fenced. Verify archive/decryption/checksums, identities, independent financial double-entry, Rooms invitations/lessons and object references. An empty new database is not a restore. The old service/volume stays intact.
4. Inspect `public.masanawa_schema_migrations` versus source manifest; prove `rooms/0006_membership_invites.sql` present/absent and checksum. If absent, only after backup/restore and explicit operator approval apply the reviewed additive migration through the dedicated Gateway `migrate` command. Never run `alpha:prepare` or auto-apply `0112_msn_wallet.sql`.
5. Configure actual **Gateway** from `weavewellindustrieslimited/masanawa:main` and **canonical Worker** from the same immutable SHA and root build contexts. Use existing `infra/deployment/gateway/railway.toml` and new `infra/deployment/worker/railway.toml`; connect both privately to the verified PostgreSQL. Keep production secrets in Railway references, neither commit nor print values. Verify logs, release SHAs and both `/readyz` responses (not only `/healthz`).
6. Stage only `MASANAWA_ROOMS_MEMBERSHIP_ENABLED=true` on the protected restored environment after schema/worker readiness; test two real distinct customer accounts, moderator invitation issuance, invite acceptance, replay denial, revoke, ban and unban, concurrent accept/revoke race, paid Room denial, session/account switch, offline retry and flag-OFF rollback. This is **NOT_RUN** until the real environment and authorized accounts are available. Keep production membership OFF until all pass.
7. Financial platform: keep **all** MSN issuance/settlement flags OFF, `0112_msn_wallet.sql` outside automatic migrations. Independently sourced NOWPayments/Flutterwave custody evidence, global backing reservation, exact NGN debit, reconciliation and qualified rollback are still required. Never infer these from fake fixtures or a source build.
8. Only after restored data, provider fencing, source identity and rollback evidence may an authorized operator cut over traffic/DNS/webhooks. Prevent split-brain writes and reconcile any in-flight financial events before restarting side effects. Never delete the original database as part of cutover.

## Verification map

- Source build and deployment contracts: dedicated Actions at exact branch/PR SHA (pending at authoring). Code review and actual CI jobs are separate from provider reality.
- Real original Railway volume access/backup: **BLOCKED** until Railway project-management actions or authorized external operator evidence.
- Backup+restore, migration 0006, live Gateway/Worker, two-account Rooms and paid-denial: **NOT_RUN**, do not activate.
- Native APK, Gemini audio/live calls, provider custody: **NOT_RUN** by this deployment-source change.

## Next window

Continue `weavewellindustrieslimited/masanawa` from fresh `origin/main`, reading
`AGENTS.md`, `CONTINUE-HERE.md`, `docs/MULTI-WINDOW-WORK.md`,
`docs/workstreams/UI-CONTINUATION-QUEUE-20261012.md`,
`docs/workstreams/AF10-room-membership-lifecycle-20261013.md`,
`docs/workstreams/AF01-msn-settlement-finance-reconciliation-20261013.md`,
this handoff and the latest Factory skill. Reconcile exact main/PR/claims.
Access the newly connected Railway workspace, inventory original expired-account
volume/backup without deletion, verify independent encrypted archive and
disposable restore, 0006 checksum and canonical Gateway/Worker deploy identity.
Qualify real two-account Rooms invitation/moderation/concurrency/paid-denial
and OFF rollback before membership activation. Keep MSN and 0112 OFF pending
real custody/global backing, exact NGN issuance/reconciliation. Preserve
Chats, Status, Wallet, Calls, Rooms, 26 titled Masana, images and lessons,
AI-answer worker and unrestricted ordinary questions. Report genuine tests,
source/merge SHAs, deployment state and next prompt.
