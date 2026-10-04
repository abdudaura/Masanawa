# Railway hosted Alpha replacement

## APK compilation checkpoint — 2026-10-04 08:00 UTC

This section supersedes older pending mobile-test statements below.
Gateway deployment `1162ccd8-4b6b-4a1c-85e0-f0417cd820eb` is live on
`5c5632cd7a7c7f6b886184bd54e732cf6525f508`: readiness is 200 and
missing Alpha authorization returns 401. All 106 Gateway/Agents tests pass.

Cloud Flutter analysis passed its compilation-error gate with 120 existing
warnings/info, and all 42 mobile tests passed, including real login routing
and splash disposal. The subsequent Android build has not produced an APK.
Initial Gradle daemon disappearance exposed the builder's hard 999,997,440-byte
memory limit; increasing it beyond 1 GB was rejected by the current plan.
The builder now uses one worker, in-process Kotlin, 512 MB heap, 192 MB
metaspace and 64 MB code cache. Android SDK platform `android-37.0` is the
actual published package; the previous `android-37` package was unavailable.

Deployment `9c2aa42f-45db-4d38-806d-8fe854fdd2df` on
`50beb8337a68fe708e4cb5f5dfe243239cf9d0b5` passed all 42 tests but failed
`:gradle:compileKotlin` with an InvocationTargetException. No underlying
cause was logged. Diagnostic source `087dca536f4df1cfc616e7488450be5aea5c8e10`
enables Gradle stack traces; deployment `3719746d-b48b-4b41-9521-b5dd247ff146`
is running. Inspect that exact deployment before retrying or changing limits.
No APK or device verification is claimed. Keep secrets private and verify the
authenticated APK manifest/hash before delivery.

Task 072 remains current: Foundation CI failed before checkout with zero
steps and runner_id=0. Preserve prior PostgreSQL acceptance evidence and do
not merge or mark the gate complete. Resend still awaits the user's API key.


## Current status — 2026-10-04

The repository-access blocker is resolved. Private `Baatiku/masanawa` source is
attached to the reused worker and call-gateway slots in project
`3ab9e6ec-a3fa-47c9-be81-4f12a315ca0b`, production environment
`a7a29368-d2d5-4baf-b846-c570dfeaa6ba`. No repository was made public or
mirrored into ChatWithStars.

The worker is the Gateway. Deployment
`17f42e04-5087-488e-9b65-5ac7d8683b3b` succeeded on
`ec2b9c798c68dec3c651b4c7a4fb3190ec6271e9`.
`https://nurainworker-production.up.railway.app/readyz` returned HTTP 200,
Gateway ready and database-schema ready. The hosted wrapper completed startup
and canonical bootstrap/adoption; no database was reseeded for verification.
Gemini generation and authenticated conversations still require live checks.

The contracts service is PostgreSQL 18.6:
`498972c8-d316-4d76-b22c-c8358666394f`,
private endpoint `nuraincontracts.railway.internal`, 500 MB volume
`72653d2d-1e4f-42bb-82d5-238ed901226f` at `/var/lib/postgresql`.
No public database proxy exists. The dashboard slot remains unchanged.

## Current APK continuation

The reused call-gateway service `6e4a8421-ff66-4d4d-9409-62631edfd2a4` now
runs the APK builder. It is not a telephony service at this checkpoint.
Diagnostic deployment `3e32b67f-e98c-4853-9519-6aa312812418` ran Flutter
analysis without compilation errors and passed 40 tests. It failed the splash
test because a polling timer survived disposal, so no APK was produced.

Source `5c5632cd7a7c7f6b886184bd54e732cf6525f508` fixes that lifecycle
and strengthens login-routing/disposal tests. It also fixes live Alpha access
rejections returning 500 instead of 401. All 46 Gateway tests, strict Gateway
typechecking and the complete dependency build pass locally.

New deployments were authorized and triggered on this exact source:
- Gateway: `1162ccd8-4b6b-4a1c-85e0-f0417cd820eb`.
- APK builder: `0abc66ae-d1fc-456a-a705-f58f2a4c822c`.

Gateway deployment succeeded; live readiness returned 200 and the unauthenticated
directory returned 401. All 106 Gateway/Agents tests pass. Foundation CI run
37186111144 failed before checkout with zero steps and runner_id=0.
Inspect APK logs/status; do not claim compilation from deployment submission.
The builder uses `infra/deployment/mobile/Dockerfile` and
`bash infra/deployment/mobile/start-builder.sh`, HTTPS Gateway URL, the existing
Alpha token, private download token and exact source commit. Flutter tests use
one worker, expanded reporting and a ten-minute process limit. Errors still
stop compilation. The download server starts only after a successful APK build.

The download token was rotated without changing the Gateway Alpha token or
identity references. Fetch the authenticated manifest/APK/hash, check source
provenance and SHA-256, then deliver the actual artifact privately. This debug
APK contains a development token and must not be publicly released.

## Credential boundary

All six enabled Nurain Gemini credential rows were imported in encrypted form
at the user's request. The source database was unchanged. The hosted migration
bridge decrypts/fingerprint-checks the complete import and fails closed.
Only the backend holds provider/database credentials; the APK builder uses
the Alpha token, Gateway URL and private download token.

One Gemini key is selected per request, with no quota-failure cycling. Startup
readiness does not prove model/key generation succeeds. Preserve the existing
configuration; do not recreate sealed credentials or print their values.
Resend remains pending the user's API key. No email integration/delivery is claimed.

## History and gates

The earlier inaccessible-source attempt
`735c979f-aa73-4bdf-89f6-f5dc8cf48258` was not a Masanawa code test.
The subsequent access grant resolved that blocker. Both DigitalOcean Droplets
were deleted at the user's request; no replacement Droplet was created.

Task 072 remains current despite the successful previously recorded 515-test
PostgreSQL run. Its implementation-head and merged-main Foundation CI gates
remain open. APK/device and authenticated hosted-inference checks are separate.
