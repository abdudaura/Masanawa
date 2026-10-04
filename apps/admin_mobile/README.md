# Masanawa Admin Mobile

Android-first Flutter operations console derived from the customer mobile shell without copying customer chat, media, commerce, creator or wallet UX.

Current live Ops contracts:
- `GET /healthz`
- `GET /readyz`
- `GET /v1/agents`
- `GET /v1/skills`

Operator credentials are stored with `flutter_secure_storage`; no admin credential is committed.

Run with:
```bash
flutter run --dart-define=ADMIN_BASE_URL=https://your-ops-host
```

Android application id: `ng.masanawa.admin`.
