# Masanawa Admin Mobile

Separate Android-first Flutter operations console derived from the customer mobile shell without copying customer chat, media, commerce, creator or wallet UX.

## Implemented

- Agent Blue identity and theme.
- Independent Android application id: `ng.masanawa.admin`.
- Secure operator credential storage.
- Ops health and readiness overview.
- Agent listing and presentation editing.
- Skill catalog.
- Per-Agent Skill assignment editing.
- Explicit placeholders for Users and Transactions until scoped admin server contracts exist.

## Ops API

The current app uses:

- `GET /healthz`
- `GET /readyz`
- `GET /v1/agents`
- `PUT /v1/agents/:characterId/presentation`
- `GET /v1/skills`
- `GET /v1/agents/:characterId/skills`
- `PUT /v1/agents/:characterId/skills`

Operator credentials are stored with `flutter_secure_storage`; no admin credential is committed.

Run with:

```bash
flutter run --dart-define=ADMIN_BASE_URL=https://your-ops-host
```

The production admin identity/login flow is still a backend dependency; the current credential screen is a secure bootstrap surface, not the intended final login UX.
