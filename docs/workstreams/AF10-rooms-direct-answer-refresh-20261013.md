# AF10: auto-display Gemini Rooms answers and PG18 end-to-end evidence

Base main: `ca2ab3d121a378d4a799536d830c22b2ba44f2ae`; parent direct-answer implementation: PR #718 merged `ca2ab3d121a378d4a799536d830c22b2ba44f2ae`.

## Customer journey
The free Room already accepts nonempty fan questions and processes them via the Gemini worker without any staff review or arbitrary question quota. This addition makes a pending answer update automatically inside the Flutter Room detail screen, avoiding reload/refresh gestures and full-screen spinners. Polling stops on completion, leave, unmount, auth failure or Room/client identity switch, and backs off on errors. The user's actual answer remains tenant-fenced in canonical PG18 storage.

A disposable PostgreSQL 18 integration test migrates the production schema, seeds two tenants, joins a Room, asks even a one-character question, proves idempotency, claims the exact canonical outbox, directly publishes a model answer, verifies authenticated Room repository readback and a single notification, denies cross-tenant reads, and verifies provider-failure retry without staff intervention. Real Gemini provider call and deployed Android/Railway are separate unverified release checks.

## Verification
Hosted exact-head production Gateway/Worker build, focused Rooms Vitest/PG18, Flutter widget+analysis must pass before merge. Preserve identity, paid Google Play and financial gates. Production Railway recovery remains open; main merge alone does not constitute service health. MUI-09/MUI-10/AF11 remain OPEN.
