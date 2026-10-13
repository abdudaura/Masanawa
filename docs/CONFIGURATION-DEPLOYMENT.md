# Production Configuration and Deployment Contracts

## Provider-neutral account redeployment verification — 2026-10-08

**Supplemental audit:** read `BACKEND-DATABASE-PORTABILITY-AUDIT-20261008.md`, `DATABASE-REDEPLOYMENT-AND-RESTORE-RUNBOOK.md`, and `BACKEND-FEATURE-TRACEABILITY-20261008.md` before claiming a new cloud/account deployment is portable. Current Railway production uses a PG18/pgvector Docker image and a legacy-labelled database service with persistent volume; the most recent Gateway deployments observed `NEEDS_APPROVAL`, while the deployed successful SHA lags `main`. Do not infer production source parity from GitHub commits.

Deployment portability must prove canonical `MASANAWA_DATABASE_URL` wiring, stable custom API DNS (rather than Flutter Railway fallback defaults), PostgreSQL version/extension/roles, **production-safe migration-only command** (not Alpha seed), `/readyz` schema admission separate from `/healthz` liveness, encrypted off-account backup + restored copy, S3/object-store continuity, secret/vault references and external providers/LiveKit/FCM/Relay/webhooks, idempotent financial job fencing, release image SHA, monitoring and rollback. Maintain provider-specific deployment manifests as adapters, not canonical domain state. Do not perform live migrations/cutovers without owner approval and verified backup.


Status: canonical production-structure contract.

This document defines the configuration, secret-reference and deployment-layout conventions
established by production Task 058.

## 1. Configuration ownership

Configuration is explicit process input. Domain packages must not read `process.env` or
vendor deployment metadata directly. Deployable services and infrastructure composition roots
may read environment variables and translate them into typed canonical configuration.

The canonical environment registry is `config/production-env.json`. It records each supported
variable's owner, classification, required environments and description. New production
variables must be registered there in the same change that consumes them.

## 2. Names and precedence

Masanawa-owned variables use the `MASANAWA_` prefix. Standard runtime variables such as
`NODE_ENV`, `HOST` and `PORT` may be accepted only at the process-hosting boundary.

Service-specific host/port variables take precedence over generic host-provided values:
`MASANAWA_GATEWAY_HOST/PORT`, `MASANAWA_WORKER_HOST/PORT`,
`MASANAWA_OPS_HOST/PORT`, and future `MASANAWA_PRESENCE_HOST/PORT`.

Compatibility aliases are bounded ingress conveniences; canonical configuration passed inward
uses typed fields, never a bag of environment names.

## 3. Secrets and references

Secrets must never be committed to this repository, checked into env examples, embedded in
deployment manifests, or copied into domain records.

Provider/device/user credential material follows the Security-owned CredentialRef boundary.
Deployment/bootstrap secrets that cannot yet use CredentialRef are injected by the deployment
platform and are classified as `secret` in the registry. Source-controlled files may contain
only variable names, descriptions and non-secret development defaults.

Logs, errors and diagnostics must not echo secret values.

## 4. Required production bootstrap

The current Gateway, Worker and Ops service processes require a PostgreSQL connection in
production. `MASANAWA_DATABASE_URL` is canonical; `DATABASE_URL` is an infrastructure-host
compatibility alias at the service composition boundary.

Production startup must fail closed when required bootstrap configuration is absent or invalid.
Tests and dependency-injected unit composition may omit a real database URL.

## 5. Deployment topology

Deployment units follow canonical service ownership, not packages:
- Gateway — public/channel ingress and synchronous admission;
- Worker — durable background execution;
- Presence — realtime media/session transport when implemented;
- Ops — operator/control-plane API;
- specialist GPU/media workers only when an ADR and workload justify them.

Do not deploy one microservice per domain package. Apps call platform APIs and do not receive
database or provider secrets.

A deployment platform may map these units to Railway, DigitalOcean, Cloudflare, Kubernetes or
another host without changing domain ownership.

## 6. Environment separation

Development, test and production are separate configuration scopes. Production credentials
must not be reused as development/test defaults. CI uses explicit test-only configuration.

The environment registry may mark a variable required for one environment and optional for
another. An empty string never satisfies a required value.

## 7. Deployment manifests

Source-controlled deployment manifests contain:
- service identity and command/build metadata;
- health/readiness paths;
- non-secret resource/topology declarations;
- environment variable names or platform secret references.

They do not contain raw credentials. Vendor-specific manifests live under `infra/deployment`
when introduced and remain adapters for the canonical service topology.

## 8. Validation and change rule

`test/architecture/environment-contracts.test.ts` validates the registry and scans production
source/deployment text for configuration-boundary violations.

Any new production environment variable requires:
1. registry ownership/classification;
2. typed parsing at the composition boundary;
3. validation tests for invalid/missing values when required;
4. deployment documentation when operators must supply it.

A new deployable service or a change to canonical service topology requires architecture
documentation and, when ownership changes, an ADR.


## 9. Alpha 1 hosted development deployment

The mobile Alpha runtime can be hosted before the full production platform is
complete, but it remains a development deployment.

Gateway container contract:
- `infra/deployment/gateway/Dockerfile`;
- Railway service config: `infra/deployment/gateway/railway.toml`;
- build scope: `@masanawa/gateway-service` plus its workspace dependencies;
- health path: `/healthz`;
- readiness path remains `/readyz`.

Use `config/alpha-development.env.example` as the variable-name template. It
contains placeholders only; no credential or generated canonical ID belongs in
source control.

### One-time bootstrap, repeated deploys

Run `pnpm alpha:prepare` **once per development database**. It applies the
canonical migration roots and creates the development Tenant/User/Character/
CharacterVersion/Relationship/Security policy/AgentPresentation, then prints
the exact `MASANAWA_ALPHA_*` values.

Persist those printed values in the deployment platform's secret/config store.
Do not configure `alpha:prepare` as a Railway pre-deploy or start command:
doing so would create a new Alpha identity graph on every deployment.

Subsequent Gateway deployments reuse the existing canonical rows and may safely
replace application code without changing the mobile Character/Relationship
identities.

The development Gemini key is a bootstrap secret and must remain deployment
configuration only. The mobile APK receives only the bounded Alpha bearer token,
never the provider or database credentials.

For a hosted test APK, use the generated HTTPS service domain as
`AGENT_BASE_URL`; the Android debug cleartext exception exists only for a
laptop-hosted local HTTP Gateway.


## 10. Customer channels: WhatsApp and Telegram

WhatsApp and Telegram are Gateway ingress adapters over the same canonical
Masanawa customer identity, Character, Relationship, Agent session, Skills,
Commerce and Wallet runtime used by the mobile app. They are not separate bot
accounts or separate memory stores.

### WhatsApp

Enable with:

- `MASANAWA_WHATSAPP_ENABLED=true`
- `MASANAWA_WHATSAPP_VERIFY_TOKEN`
- `MASANAWA_WHATSAPP_APP_SECRET`
- `MASANAWA_WHATSAPP_ACCESS_TOKEN`
- `MASANAWA_WHATSAPP_PHONE_NUMBER_ID`
- `MASANAWA_WHATSAPP_GRAPH_VERSION`

Configure Meta's callback URL as:

`<MASANAWA_PUBLIC_BASE_URL>/channels/whatsapp/webhook`

The GET challenge is validated with the verify token. Every POST delivery is
validated with Meta's `X-Hub-Signature-256` HMAC before processing. The
sender's WhatsApp phone number must already exist as the phone identity of a
Masanawa account; otherwise Gwani tells the user to sign in with that number
first. Provider message IDs are persisted before execution so webhook retries
cannot duplicate a bill payment, crypto action or Agent turn.

### Telegram

Enable with:

- `MASANAWA_TELEGRAM_ENABLED=true`
- `MASANAWA_TELEGRAM_BOT_TOKEN`
- `MASANAWA_TELEGRAM_WEBHOOK_SECRET`

Configure Telegram's webhook URL as:

`<MASANAWA_PUBLIC_BASE_URL>/channels/telegram/webhook`

Set the same configured webhook secret as Telegram's
`secret_token`; the Gateway requires the
`X-Telegram-Bot-Api-Secret-Token` header on every update.

Telegram user IDs are not treated as Masanawa identities. An unlinked user is
asked to share their Telegram contact. The Gateway accepts the contact only
when its Telegram `user_id` equals the sender and the shared phone matches an
existing Masanawa phone-auth profile. That creates the durable channel link;
later messages resume the same canonical customer/Character relationship and
Agent session.

Both channel switches fail startup closed when enabled with incomplete signing
or delivery configuration. Secrets stay in the deployment platform and must
never be committed.


## Telegram automatic webhook registration

When `MASANAWA_TELEGRAM_ENABLED=true`, the Gateway now registers and verifies the
Telegram Bot API webhook during startup. Manual `setWebhook` calls are no longer part of
normal deployment.

Required server secrets remain:

- `MASANAWA_TELEGRAM_BOT_TOKEN`
- `MASANAWA_TELEGRAM_WEBHOOK_SECRET`

The public webhook URL is resolved in this order:

1. `MASANAWA_TELEGRAM_WEBHOOK_URL`, when explicitly set;
2. otherwise `MASANAWA_PUBLIC_BASE_URL` plus `/channels/telegram/webhook`.

The resolved URL must use HTTPS. Startup calls `setWebhook` with the configured secret
token and allowed update type `message`, then calls `getWebhookInfo` and fails closed
unless Telegram reports the exact same active URL. Pending updates are preserved.

## 2026-10-13 account recovery: explicit database migration and canonical Worker

The expired Railway account cannot be considered a backup or a reproducible build
source. Preserve the original `masanawa-postgres` volume and all attached
credentials before touching that service. The canonical Gateway source is
`weavewellindustrieslimited/masanawa:main`; the previous `@nurain/worker`
Git source is a retired webhook proxy, **not** the current Masanawa AI-answer Worker.

The production Gateway's `start` now starts the server **without automatically
running migrations**. The existing `pnpm --filter @masanawa/gateway-service
migrate` remains a separate, explicit operator action, to run against the
verified restored database **only after** an independent backup-and-restore drill
and migration-manifest review. Do not call `alpha:prepare` or bootstrap identities
against real customer data. Before approved migration 0006, `/readyz` should
refuse requests to treat an outdated schema as qualified; Railway's Gateway
health check uses readiness rather than mere HTTP liveness.

The canonical Worker has its own monorepo-root Dockerfile and
`infra/deployment/worker/railway.toml`; it builds and runs
`@masanawa/worker-service` from the same pinned main SHA as Gateway.
Never reuse `@nurain/worker`, copy the old volume into a new blank database
without a verified archive, or share a public database endpoint unnecessarily.
The new Railway account must explicitly bind secrets and private PostgreSQL
host references through its secure variable store. Room membership,
all MSN issuance/provider switches and automatic financial settlement remain
OFF until their domain acceptance and genuine provider evidence.

See `docs/workstreams/AF00-railway-account-recovery-20261013.md` for the
bounded operator recovery sequence and unresolved live checks.
