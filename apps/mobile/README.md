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

## Production login and build

The mobile app has one authentication path: normal OTP sign-in through the
Masanawa Gateway. There is no Developer screen, debug test user, Alpha access
token, runtime-enable switch or user-configurable Gateway credential.

The checked-in production defaults point to:

- API + authentication: `https://nurainworker-production.up.railway.app`
- Agent/creator shell: `https://nurainworker-production.up.railway.app`

A normal local build therefore needs no secret Dart defines:

```sh
cd apps/mobile
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
```

Install the APK and sign in with a verified phone/email OTP. The resulting
encrypted app session automatically authorizes the Agent directory, chat, live
voice token minting, clone setup, creator economy/Float and clone Skills. Access
tokens refresh from the stored refresh token; users never copy or type platform
tokens.

For a staging deployment, build-time URL overrides are still supported:

```sh
flutter run \
  --dart-define=API_BASE_URL=https://staging.example.com \
  --dart-define=AGENT_BASE_URL=https://staging.example.com
```

Those values select a deployment origin only; they are not credentials. Provider
keys, database credentials, Supabase server keys, Gemini keys and service secrets
stay server-side.

## Production acceptance

Before publishing a release, verify on a real Android device:

1. OTP sign-in and first-time profile completion.
2. App restart restores the encrypted session without asking for another platform token.
3. Agents loads the server-authorized roster; another user's clone is never visible.
4. Text, voice note, image/document and live voice requests work after access-token rotation.
5. Clone creation, Skill changes and Agent Float use the same signed-in account.
6. Offline/retry does not duplicate user turns; an actually expired/revoked session returns to sign-in.
7. Logout unregisters push state and clears account-scoped local conversation/action state.

The app shell remains server-driven: ordinary Agent presentation, Skill assignment,
work cards and supported shell-document/action changes do not require a new APK when
they stay inside the existing mobile shell contract.
