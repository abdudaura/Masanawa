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

OTP-only. Phone and email both verify a one-time code. There is no silent or
developer-token sign-in. The verified platform session is the single mobile
credential and its token pair lives in encrypted platform storage. The Gateway
validates that same platform session and maps it to canonical Masanawa identity;
the app never asks the user to paste a runtime token.

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



## Runtime and local testing

The universal shell is enabled by default and points at the hosted Gateway. A normal
local `flutter build apk --debug` therefore contains the same agent renderer, chat,
voice, structured cards/actions, deep-link/push, clone, Skills and creator-economy
client code used by production. Server-driven presentation and Skill configuration can
change without rebuilding the APK.

For an endpoint override or USB-local Gateway, use `docs/BUILDS.md` and the helper
scripts under `tool/`. The historical `build_alpha.*` filenames are retained for
developer convenience, but they no longer accept or embed an Alpha access token.
Users always sign in with the normal phone/email OTP flow.

The server may retain an explicitly enabled Alpha authorizer as an operator-only
fallback during migration, but that credential is never a customer-app setting and is
never compiled into the mobile application.
