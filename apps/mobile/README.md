# apps/mobile — Masanawa Voice-First Agent Shell (Flutter)

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
authorized `/agent/directory` projection. Each conversation is keyed by canonical
`CharacterId`; admin-configured role labels are presentation metadata and never imply
Skills or authority.

Turns can return text plus typed audio/image/file/artifact/work/approval/operation/call
result parts so files and useful work stay in the same conversation. Local threads are
cache only (`masanawa_threads_v2.json`); server session/run/file references are truth.

When the live runtime is not configured, the roster is deliberately empty rather than
inventing Characters. The old civic preview transport remains only as a compatibility
fallback for an already selected Character.

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

A simple local database is enough for phone testing:

```bash
docker run --name masanawa-alpha-db \
  -e POSTGRES_PASSWORD=masanawa \
  -e POSTGRES_DB=masanawa \
  -p 5432:5432 \
  -d postgres:18
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
shows. Alpha model prompting also consumes the current presentation, so name/role/about
changes affect subsequent Alpha replies without changing Character identity.

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
