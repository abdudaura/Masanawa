# Masanawa portability contract

Masanawa must be movable between Railway accounts or to another infrastructure provider without application refactoring.

## Source of truth

Git owns:
- application code;
- PostgreSQL migrations;
- service build/start definitions;
- stable public hostnames under `*.masanawa.com`;
- required environment-variable names;
- bootstrap and database transfer scripts.

Git does **not** own plaintext secrets. Provider-generated hostnames are never part of the application contract.

## Stable public endpoints

- `https://api.masanawa.com` — authentication and public platform API.
- `https://gateway.masanawa.com` — agent/runtime Gateway.
- `https://billing.masanawa.com` — billing/webhook public endpoint.
- `https://calls.masanawa.com` — call/mobile-device Gateway.
- `https://admin.masanawa.com` — administration UI/API.
- `https://relay.masanawa.com` — fixed-egress relay where needed.

Cloudflare DNS is the indirection layer. A hosting move changes DNS/provider configuration, not app code or APK constants.

## Secrets

`infra/portable/secrets.manifest.json` is the canonical list of secret names.

For account portability, store application secret values once in the GitHub `production` Environment/Actions secret store using the same names. The Railway rebuild workflow copies those values into a fresh runtime. A new Railway account therefore needs only its new `RAILWAY_TOKEN` deployment credential; the application credentials are not manually re-entered one by one.

Never commit plaintext secrets or provider tokens.

### One-time migration of today's Railway secrets

Run this once from a machine authenticated to both Railway and GitHub:

```bash
bash scripts/railway/migrate-secrets-to-github.sh Baatiku/masanawa production
```

The script reads the approved secret names from Railway and sends their values directly to GitHub Environment secrets with `gh secret set`. It does not print or write the plaintext values to disk beyond Railway CLI's temporary JSON output, which is removed on exit. After this migration, future Railway-account moves do not require copying every application key again.

## PostgreSQL portability

Masanawa uses ordinary PostgreSQL migrations and connection strings. Provider-specific database APIs are not a dependency.

Export:

```bash
DATABASE_URL='postgresql://...' scripts/database/export.sh backups/masanawa.dump
```

Restore:

```bash
TARGET_DATABASE_URL='postgresql://...' scripts/database/import.sh backups/masanawa.dump
```

The dump uses PostgreSQL custom format and includes schema + data. The destination may be Railway Postgres, Render Postgres, Neon, DigitalOcean Managed PostgreSQL, or self-hosted PostgreSQL, provided the destination supports the extensions actually used by the schema.

After restore, application migrations remain authoritative and should be run before traffic is switched.

## Moving to a new Railway account

1. Create/obtain one Railway account token and update GitHub secret `RAILWAY_TOKEN`.
2. Run the **Rebuild Railway Production** GitHub workflow.
3. The workflow creates/connects infrastructure, sets portable variables/secrets, and deploys from this repository.
4. Restore the latest Postgres dump if this is a migration rather than a new blank environment.
5. Point the stable Cloudflare CNAMEs to the new runtime.
6. Verify health/readiness and then retire the old account.

No APK rebuild is required when only the hosting provider/account changes.

## Rule for future development

Any new external service must:
1. use a stable `*.masanawa.com` public hostname if clients call it;
2. read credentials from environment variables;
3. add secret names to the secret manifest;
4. add schema changes as migrations;
5. avoid embedding Railway/Render/DigitalOcean URLs in application code.
