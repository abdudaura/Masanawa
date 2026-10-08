# R18 profile avatar end-to-end integration

Owner: ChatGPT R18 avatar integration window, 2026-10-08.
Branch: `work/r18-avatar-end-to-end-20261008`, base main `88e67cc6c79de1ca09e02f11e929065dcfb2ea82`.
Reconciliation: prior R18 PR #419 merged as `af0f425`; PR #421 closed without merge; shell avatar display #425 merged. Separate research branch `work/r18-avatar-media-20261008` holds tested-source-only media modules. Reuse its files, do not restart or overwrite merged #419/#425.

Owned paths: `services/gateway/src/profile_avatar/`, `apps/mobile/lib/src/profile_avatar/`, `apps/mobile/test/profile_avatar_*.dart`, `packages/talks/migrations/0015_profile_avatar_objects.sql`, `services/gateway/src/app.ts`, `services/gateway/src/main.ts`, `apps/mobile/lib/src/screens/profile/edit_profile_screen.dart`, `docs/workstreams/r18-avatar-end-to-end-20261008.md`.
No current open PR overlaps these shared Gateway/profile paths (reviewed #426/#423/#418/#417). Changes to main/app shell apply atop latest main and must preserve #419/#425 and other unrelated integrations. No historical migrations overwritten.
Goal: HTTPS S3 object storage (same S3-compatible foundation as Talk replays); strict normalized PNG, owner-authenticated upload/remove; durable staging/clean-up; native image pick+crop; actual editor controls; truthful readiness if storage unconfigured; regression tests. Deployment requires explicit S3 credentials, public CDN mapping and real-device test; no enabling by flag alone.
Initial state: newly claimed, copying vetted reusable modules. Unit tests have NOT run yet. No deployment.
