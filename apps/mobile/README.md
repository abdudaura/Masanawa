# apps/mobile — Masanawa Voice-First Agent Shell (Flutter)

## Runtime verification after pulling updates

Keep the existing PostgreSQL 18 container and bootstrap-generated Alpha IDs/token.
From the repository root, point the test URL at that running PostgreSQL instance:

```powershell
$env:MASANAWA_TEST_DATABASE_URL = "postgres://postgres:masanawa@localhost:5432/masanawa"
pnpm.cmd alpha:verify
```

The tests create isolated test databases and require a PostgreSQL role allowed to
create databases. The helper builds/types Gateway and Ops, runs their unit and
architecture/contracts checks, then runs CharacterSession/AgentRun acceptance.
It does not rerun bootstrap, reseed identities or replace the Alpha token.
`pnpm.cmd alpha:verify --unit-only` deliberately excludes PostgreSQL acceptance
and cannot establish Task 072 completion. Flutter checks and the APK build remain
the separate commands below.

Alpha routes now use `/v1/agent/...`. Rebuild Gateway and the debug APK together;
the Gateway base URL stays `http://127.0.0.1:3000`. Keep the existing USB reverse
and generated development token.

Thin phone shell for the Masanawa platform. It renders login, a dynamic
server-configured Character roster, voice-first conversations, structured work results
and settings. It owns no brain: no Character store, no memory authority, no Skill
registry and no Workflow engine. The canonical brain lives in the Masanawa
packages/services in this repo.

## Toolchain

Flutter manages its own toolchain via `pubspec.yaml`. This directory is
intentionally OUTSIDE the pnpm workspace (pnpm skips it: no `package.json`).
Run Flutter commands from this directory:

- `flutter pub get`
- `flutter analyze`
- `flutter test`
- `flutter run --dart-define=API_BASE_URL=<url>`

Phone + web builds (signing, flags, CI): `docs/BUILDS.md`. Agent gateway
contract (draft, lights up when Task 099 ships): `docs/AGENT-GATEWAY-CONTRACT.md`.

## Auth

OTP-only. Phone and email both verify a one-time code. There is no silent
phone sign-in. A debug-only test shortcut exists behind `kDebugMode` and never
ships in release builds. Tokens live in encrypted platform storage.

## Agents and chat

No production agent identities are hard-coded in the app. The roster comes from the
authorized `/v1/agent/directory` projection. Each conversation is keyed by canonical
`CharacterId`; admin-configured role labels are presentation metadata and never imply
Skills or authority.

Turns can return text plus typed audio/image/file/artifact/work/approval/operation/call
result parts so files and useful work stay in the same conversation. Local threads are
cache only (`masanawa_threads_v2.json`); server session/run/file references are truth.

When the live runtime is not configured, the roster is deliberately empty rather than
inventing Characters. The explicit civic preview transport is for an unconfigured runtime. A live Gateway
failure stays on the real transport and offers an explicit user-safe retry.

## Boundary rules (from `docs/AGENT-PHONE-EMBODIMENT.md`)

1. Losing the phone must not lose the Character.
2. Local threads are cache; session/run IDs are truth.
3. Consequential actions need server Operation ID + receipt (future).
4. Release builds require a real signing key — never ship debug-signed.


Product UX rules: `docs/MOBILE-AGENT-EXPERIENCE.md`. Mobile gateway projection: `docs/AGENT-GATEWAY-CONTRACT.md`.


## Masanawa Alpha 1 — test the app before the platform is complete

Alpha 1 deliberately uses the canonical CharacterSession and AgentRun stores with a
temporary replaceable conversation executor. It is for development testing only and
does not claim later AgentStrategy, Workflow, Presence or Device tasks are complete.

Plain-text attachments are decoded as UTF-8 user content at the inference edge,
with a 128,000-character limit. PDF, image and audio attachments retain their
media MIME/data path. Skills are not executed by this temporary Alpha strategy.

### What works in Alpha 1

- admin-configured agent directory;
- real CharacterSession admission;
- one durable AgentRun per text/media turn;
- Gemini-backed text conversation through the Gateway;
- actual voice-note/image/document bytes sent as multimodal input;
- optional Android local TTS for spoken replies;
- local conversation cache and real latest AgentRun ID;
- debug Developer screen with Gateway health/readiness and runtime diagnostics.

### Local PostgreSQL 18

The Character context compiler reads canonical relationship memory. Use PostgreSQL 18 with pgvector for this branch:

```bash
docker run --name masanawa-alpha-db \
  -e POSTGRES_PASSWORD=masanawa \
  -e POSTGRES_DB=masanawa \
  -p 5432:5432 \
  -d pgvector/pgvector:0.8.6-pg18-bookworm
```

Set:

```bash
export DATABASE_URL=postgres://postgres:masanawa@localhost:5432/masanawa
```

Then build and bootstrap:

```bash
pnpm install --frozen-lockfile
pnpm alpha:prepare
```

The bootstrap prints the exact Alpha Gateway environment and mobile Dart defines.
It creates real canonical Tenant/User/Character/CharacterVersion/Relationship,
Security policy and AgentPresentation records. It does not create a parallel demo
identity store.

Add the printed values plus your development Gemini values to the Gateway shell:

```bash
export MASANAWA_ALPHA_ENABLED=true
export MASANAWA_ALPHA_DEV_TOKEN=...
export MASANAWA_ALPHA_TENANT_ID=...
export MASANAWA_ALPHA_USER_ID=...
export MASANAWA_ALPHA_POLICY_REVISION=alpha-1
export MASANAWA_ALPHA_RELATIONSHIPS_JSON='{"character_...":"relationship_..."}'
export MASANAWA_ALPHA_GEMINI_API_KEY=...
export MASANAWA_ALPHA_GEMINI_MODEL=...
export DATABASE_URL=postgres://postgres:masanawa@localhost:5432/masanawa

pnpm --filter @masanawa/gateway-service build
pnpm --filter @masanawa/gateway-service start
```

### Run/build the Android Alpha app

Use the laptop LAN address if the phone is on the same network. With an Android
emulator, use the appropriate host alias for your environment.

```bash
cd apps/mobile
flutter pub get
flutter run \
  --dart-define=AGENT_RUNTIME_ENABLED=true \
  --dart-define=AGENT_BASE_URL=http://<laptop-ip>:3000 \
  --dart-define=ALPHA_DEV_ACCESS_TOKEN=<same-alpha-token> \
  --dart-define=ALPHA_TTS_ENABLED=true \
  --dart-define=ALPHA_TTS_LANGUAGE=en-US
```

For an installable debug APK:

```bash
flutter build apk --debug \
  --dart-define=AGENT_RUNTIME_ENABLED=true \
  --dart-define=AGENT_BASE_URL=http://<laptop-ip>:3000 \
  --dart-define=ALPHA_DEV_ACCESS_TOKEN=<same-alpha-token> \
  --dart-define=ALPHA_TTS_ENABLED=true
```

Install `build/app/outputs/flutter-apk/app-debug.apk`. On the login screen choose
**Skip for now — explore as a test user (debug)**. That local dev sign-in uses the
provided Alpha token, so OTP is not required for this test build.

Open **Settings → Developer** to check Gateway health/readiness, directory loading and
the latest AgentRun ID.

### Admin changes

The user app still consumes the server-driven AgentPresentation directory. Changing
display name, role, about/greeting, visibility or order in Ops changes what the app
shows. Alpha model prompting now loads the authored Constitution pinned by the CharacterSession.
Presentation name/role/about edits change UI labels; they do not replace authored identity
or grant capabilities. A newly activated Constitution applies when opening a new session.

Skill assignment remains independently persisted. Alpha 1 carries the assigned exact
SkillVersion IDs into CharacterSession bindings, but does not yet execute Skills; that
starts with the production orchestration tasks rather than a fake Alpha tool layer.

### Alpha boundaries

- The Gemini executor is a temporary development inference seam and is replaced by the
  production AgentStrategy boundary in Task 073.
- Android TTS is local presentation only; canonical reply text remains server truth.
- Media payloads are capped for Alpha testing and are not the future durable file store.
- No consequential Tool, phone, Workflow or external side effect is simulated as real.


### Hosted Alpha Gateway

For phone testing away from the development laptop, deploy the Gateway using
`infra/deployment/gateway/Dockerfile` (or
`infra/deployment/gateway/railway.toml`) against an isolated development
PostgreSQL database.

Run `pnpm alpha:prepare` once against that database, save the printed
`MASANAWA_ALPHA_*` values in the hosting platform, then deploy Gateway.
Do **not** rerun bootstrap as part of each deployment.

Build the APK with the hosted HTTPS URL:

```bash
flutter build apk --debug \
  --dart-define=AGENT_RUNTIME_ENABLED=true \
  --dart-define=AGENT_BASE_URL=https://<dev-gateway-domain> \
  --dart-define=ALPHA_DEV_ACCESS_TOKEN=<same-alpha-token> \
  --dart-define=ALPHA_TTS_ENABLED=true
```

The provider/database secrets remain server-side.


### Fast USB phone loop on Windows

When the Android phone is connected by USB and authorized in `adb devices`,
you do not need the phone and laptop to share a Wi-Fi/LAN address.

From PowerShell:

```powershell
$env:ALPHA_DEV_ACCESS_TOKEN = "<token printed by pnpm alpha:prepare>"
cd apps/mobile
.\tool\build_alpha.ps1 -Install
```

The helper:
1. runs `flutter pub get`;
2. builds the debug APK with the Alpha runtime enabled;
3. runs `adb reverse tcp:3000 tcp:3000`;
4. installs/replaces the APK with `adb install -r`.

The debug APK is built with `AGENT_BASE_URL=http://127.0.0.1:3000`, so the
phone reaches the Gateway process running on the laptop through the USB reverse
tunnel. The debug Android manifest allows this cleartext localhost path; release
builds do not.

To build without installing:

```powershell
.\tool\build_alpha.ps1
```

On Linux/macOS/WSL with Flutter + adb available:

```bash
export ALPHA_DEV_ACCESS_TOKEN="<token>"
cd apps/mobile
bash ./tool/build_alpha.sh --install
```

Before running either helper, start the Gateway on laptop port 3000 with the
Alpha environment values printed by the bootstrap.

## Phone testing: local and hosted Gateways are separate

A debug APK built for the laptop cannot reach that laptop through phone localhost
unless USB reverse is active. The token printed by a local bootstrap belongs to
the local Gateway; it does not authenticate against the hosted Gateway.

After pulling the mobile testing fixes, build once:

```powershell
cd apps/mobile
flutter pub get
flutter build apk --debug --dart-define=ALPHA_TTS_ENABLED=true
```

Install `build/app/outputs/flutter-apk/app-debug.apk`, use the debug test-login
shortcut, then open **Settings → Developer → Connect test app**. Enter:

- Gateway: `https://nurainworker-production.up.railway.app`
- Alpha access token: the existing `MASANAWA_ALPHA_DEV_TOKEN` from Railway project
  **empowering-education**, service **@nurain/worker**, Variables. Use that
  hosted value, not the token printed by a new laptop bootstrap. Do not paste
  provider keys, database credentials or tokens into Git/chat.

Tap **Connect**. The app verifies the authorized directory before saving the
connection in platform secure storage. It never replaces a working connection
when verification fails. Return to Agents and open Amina if the directory admits
her. The debug connection persists after reopening; it is disabled in release
builds and cannot turn the user app into an admin/runtime authority.

For a preconfigured hosted build, the PowerShell helper supports:

```powershell
.\tool\build_alpha.ps1 -GatewayUrl "https://nurainworker-production.up.railway.app" -Install
```

Without an Alpha token, enter it through the debug connection screen after
installation. With `ALPHA_DEV_ACCESS_TOKEN` set privately, the helper verifies
that token against the selected directory before compiling. HTTPS hosted builds
do not run USB reverse. Local loopback builds use the selected port for reverse.
No helper runs bootstrap or changes existing identities.

### Small device acceptance pass

1. Open Agents, choose the visible agent, and send a short text.
2. Record a voice note; confirm a real response and optional spoken playback.
3. Attach a small image, PDF or text document and ask about its contents.
4. Reopen the app; confirm connection settings and local conversation cache remain.
5. Interrupt connectivity, send once, restore connectivity, and tap **Try again**.
   The original user message stays in the thread; retry does not add a duplicate
   user bubble or silently route to the legacy civic preview API.

Chat waits up to 75 seconds for the server's 60-second inference limit. Directory
refresh has its shorter timeout. Failed refreshes preserve the last roster except
on denied/expired access; changing account or Gateway resets directory custody.
Internal/vendor error messages are never rendered as agent feedback.

Operator smoke checks can run inside the hosted Gateway using the existing
private token: `node scripts/verify-hosted-alpha.mjs http://127.0.0.1:8080`.
The check opens and closes a real session, runs one text and one small document
turn, and prints only pass/fail summaries. It does not qualify Android recording,
TTS, Skills, phone calls or durable Workflows.
