# DigitalOcean hosted Alpha

The selected hosting target is DigitalOcean. This deployment is an isolated Alpha,
not an adoption of the Windows database or of the existing Nasfam services.
It uses the canonical bootstrap to generate its actual Tenant/User/Character/
Relationship identifiers. Restarting reuses saved nonsecret bootstrap references;
Identity and PostgreSQL remain canonical. No provider key or development token is
stored in the reference table or printed by the hosted wrapper.

## Provisioning and credit

Use the installed DigitalOcean app and its provisioning skill. Confirm remaining
promotional credit and its expiry before creating a billed resource. The balance
API returning zero does not establish the available promotional balance. On
2026-10-03 the September invoice showed $2.12 of Inference Cloud Trial credit
offsetting Droplet usage; no remaining trial amount or expiry was verified.
The user selected credit confirmation before provisioning. No Masanawa Droplet
has been created. Existing Nasfam Droplets are outside this deployment's scope.

The proposed default is `nyc3` / `s-2vcpu-4gb` (approximately $24/month), subject
to region/size selection and the account's actual credit terms. Billing continues
until deletion, including while a Droplet is powered off.

## Deploy from a reviewed checkout

Use a full authenticated repository checkout at the reviewed commit. Install
Docker Engine with Compose on the provisioned host, and point a real hostname's
DNS at it. Permit HTTPS/HTTP and restricted administrator SSH; PostgreSQL and the
Gateway have no public host port. The Caddy proxy obtains HTTPS certificates.

Copy `.env.example` to a private path outside Git, populate it with real secrets,
and restrict its permissions. Use URL-safe random values for the database password
and Alpha token. Select an available Gemini model explicitly; vendors and models
remain replaceable. Do not run `docker compose config` in shared output because
it expands secrets.

```sh
docker compose --env-file /root/masanawa-alpha.env -f infra/deployment/digitalocean/compose.yaml up --build -d
curl --fail https://YOUR_REAL_GATEWAY_HOST/healthz
curl --fail https://YOUR_REAL_GATEWAY_HOST/readyz
```

PostgreSQL 18 persists in `postgres_data`. Initialization creates a dedicated
`masanawa_alpha` database, runs canonical migrations/bootstrap, and saves only
the generated identity references for reuse. An existing unregistered canonical
database is rejected rather than reseeded. A bootstrap failure after committing
identity data requires operator recovery; retry does not silently create a
second identity. Missing provider/configuration values do not expose a fake Agent
API or successful readiness.

Back up and verify restoration of PostgreSQL before treating this deployment as
durable production hosting. Do not use `down -v` on a live database. This single
server Alpha has no high-availability guarantee.

## Verify and build an APK in the cloud

Run verification on the host from that same checkout. Supply a PostgreSQL 18 test
connection via `MASANAWA_TEST_DATABASE_URL`; the acceptance harness creates
isolated test databases. The full gate remains mandatory for Task 072.

```sh
pnpm alpha:verify
bash infra/deployment/mobile/build.sh
```

The APK script requires a real HTTPS Gateway URL, the same development token as
the backend, and a private APK download token. It verifies SDK downloads, runs
Flutter analyze/tests, and builds a debug APK. It writes the APK, SHA-256 and a
commit-bound verification manifest to `build-artifacts/mobile` only after those
steps succeed. Return the APK directly through the private chat/file workflow;
it embeds a development credential and must not be published as a public release.
The optional artifact server requires bearer authorization and must only be used
behind HTTPS or an SSH tunnel.

## R2 media boundary

`@masanawa/r2` signs short-lived, Relationship-scoped private upload/download
grants with current policy and revocation checks. This is adapter groundwork:
no live bucket, public poster hosting, Gateway media ownership route, upload
receipt or durable media lifecycle has been enabled by this deployment. A public
poster bucket/CDN and a private conversation-media bucket require distinct access
policies. Providers never acquire independent canonical private-data retrieval.

## Evidence at preparation checkpoint

R2 signing and architecture tests passed locally (68 tests), and the R2 package
build/typecheck passed. Hosting script syntax was checked. Docker deployment,
hosted PostgreSQL acceptance, Flutter checks and APK generation have not run.
Task 072 remains current; no task completion or successful deployment is claimed.
