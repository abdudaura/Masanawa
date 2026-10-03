# Railway hosted Alpha replacement

The user authorized retiring the Nurain deployment connected to ChatWithStars in
favor of Masanawa, using existing service slots. Both DigitalOcean Droplets were
deleted at their explicit request. No new Droplet was created.

## Verified resources

Project: `3ab9e6ec-a3fa-47c9-be81-4f12a315ca0b` (`empowering-education`).
Environment: `a7a29368-d2d5-4baf-b846-c570dfeaa6ba` (`production`).

The former contracts service `498972c8-d316-4d76-b22c-c8358666394f` now runs
`postgres:18-bookworm` on the private endpoint `nuraincontracts.railway.internal`.
Its 500 MB volume `72653d2d-1e4f-42bb-82d5-238ed901226f` mounts at
`/var/lib/postgresql`. Deployment `fd4cab85-1874-4486-9aeb-2edbe06621c4`
succeeded; real logs confirm PostgreSQL 18.6 ready for connections. No public
database proxy was created. Masanawa migrations/bootstrap remain unrun here.

## Repository access blocker

Railway rejected `Baatiku/masanawa` as not found/inaccessible. The worker
`68191f50-7189-4ebe-88f2-db8ef2077d81` remains connected to ChatWithStars.
Masanawa configuration was mistakenly applied before source attachment succeeded,
causing failed deployment `735c979f-aa73-4bdf-89f6-f5dc8cf48258`; restoration of
the original build/start/health/watch settings was subsequently applied live.
Do not reuse that failed deployment as validation of Masanawa code.

The repository owner must grant the Railway GitHub App access to Masanawa through
GitHub Settings / Applications / Installed GitHub Apps / Railway / Configure.
Do not publish the private repository or copy it into ChatWithStars to bypass
installation access. After access is granted, attach the reviewed Masanawa branch
at an exact verified commit. Stop on any source-attachment error before committing
coordinated deployment settings.

For the Gateway use the hosted Dockerfile at
`infra/deployment/digitalocean/Dockerfile` (host-neutral Node/bootstrap image),
start `node --conditions=production scripts/start-hosted-alpha.mjs`, clear old
Nurain pre-deploy commands, and use `/healthz` as deployment healthcheck.
`/readyz` must independently succeed before calling the Agent runtime ready.
Keep port 8080 to match the existing domain. The private admin database URL and
Alpha development token are already configured; never print their values.

## All-six-key import

The user's explicit instruction authorized pulling all six enabled Gemini
credentials from Nurain Supabase. The encrypted rows and fingerprints were copied
to `MASANAWA_ALPHA_GEMINI_IMPORTED_CREDENTIALS_JSON` on the Railway worker.
The source database was not modified. The app connection withholds environment
values, so the existing encryption secret was not extracted or displayed.

At startup, the explicit infrastructure migration bridge decrypts the imported
AES-256-GCM rows using the worker's existing `CREDENTIAL_ENCRYPTION_KEY` and any
configured previous encryption secrets. It checks source fingerprints and rejects
duplicates, tampering and partial imports. The resulting private in-process key
array goes to `MASANAWA_ALPHA_GEMINI_API_KEYS_JSON`; do not also configure the
single-key alternative. No provider key is embedded in the APK or canonical
Memory/Identity. The encrypted configuration and encryption secret must remain
restricted to the backend, not copied to the APK builder.

The inference edge selects one key per request. It does not retry quota failures
across keys; several keys in the same Google project do not multiply its quota.
This Alpha selector does not claim durable credential health/cooldown/operator
management. Live decryption, key validity and model inference remain unverified.
`gemini-2.5-flash` is explicitly configured from official model documentation;
verify it with the actual credentials after deployment and replace it if needed.

## APK builder after access is fixed

Use `infra/deployment/mobile/Dockerfile` and
`bash infra/deployment/mobile/start-builder.sh` on an authorized reused builder
service. Supply the actual HTTPS Gateway URL, the same Alpha development token,
the private download token and the exact reviewed source commit via
`MASANAWA_APK_SOURCE_COMMIT` (or Railway's Git commit metadata). Do not put these
credentials in Docker build arguments or source control.

SDK installation, Flutter analyze/tests and APK compilation run before private
downloads are served. Allow enough startup time for the cloud build. The debug
APK embeds a development token and is not a public release. Return the actual
artifact privately after the real build succeeds. The dashboard/call service
sources have not been switched at this checkpoint.

Local validation passed: Gateway build, 96 Gateway/architecture tests and two
Node credential-import tests. No Docker image, Flutter/APK build, live Gemini
inference or full PostgreSQL AgentRun acceptance result is claimed. Task 072
remains current; the full acceptance/merged-main gate is still open.
