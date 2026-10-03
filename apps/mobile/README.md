# apps/mobile — Masanawa Agent Shell (Flutter)

Thin phone shell for the Masanawa platform. It renders login, chats, and
settings. It owns no brain: no Character store, no memory authority, no skill
registry, no workflow engine. The canonical brain lives in the Masanawa
packages/services in this repo.

## Toolchain

Flutter manages its own toolchain via `pubspec.yaml`. This directory is
intentionally OUTSIDE the pnpm workspace (pnpm skips it: no `package.json`).
Run Flutter commands from this directory:

- `flutter pub get`
- `flutter analyze`
- `flutter test`
- `flutter run --dart-define=API_BASE_URL=<url>`

## Auth

OTP-only. Phone and email both verify a one-time code. There is no silent
phone sign-in. A debug-only test shortcut exists behind `kDebugMode` and never
ships in release builds. Tokens live in encrypted platform storage.

## Chat (preview)

Sends go to the civic preview endpoint until the Masanawa runtime exposes
CharacterSession/AgentRun APIs. Failures fall back to an honest on-device
reply. Threads persist locally as a preview cache only
(`masanawa_threads_v1.json`); server session/run IDs are the truth when
pairing ships (see `lib/src/agents/agent_session.dart`).

## Boundary rules (from `docs/AGENT-PHONE-EMBODIMENT.md`)

1. Losing the phone must not lose the Character.
2. Local threads are cache; session/run IDs are truth.
3. Consequential actions need server Operation ID + receipt (future).
4. Release builds require a real signing key — never ship debug-signed.
