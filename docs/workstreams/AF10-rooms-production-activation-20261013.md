# AF10 — production Rooms startup qualification (2026-10-13)

Starting main `d547dcdccf3ec448c65ee8dd995ca29e91d1d3e2`; branch `lane/af10-rooms-production-build-20261013-gpt6`. This is **production build preparation**, not production release or proof of a deployed Room.

## Discovered live blocker
Railway production project `empowering-education`, environment `production` (`a7a29368-d2d5-4baf-b846-c570dfeaa6ba`), reported Gateway `masanawa-gateway`, old worker `@nurain/worker` and PostgreSQL `@nurain/contracts` **OFFLINE** on 2026-10-13. Gateway's most recent deployment `5d8b3ef0-e568-40ad-bd00-a17f05a00588` failed building `services/gateway/src/call_history/routes.ts` TS2379 because optional query fields were forwarded as explicit `undefined`. The existing worker points to an October 4 billing/proxy branch, **not** main's `services/worker/src/main.ts`, so no Rooms worker is actually deployed. Railway service connectivity and production data/backup cannot be qualified while these are offline.

## Repair and evidence
Change CallHistory's existing authenticated GET route to omit unspecified optional fields instead of passing `undefined`, preserving server-side defaults, actor resolution and cursor-bound search. Add route regression. Add standalone hosted Node 24, frozen pnpm production builds for BOTH canonical Gateway and Worker plus customer Calls/Rooms authorization, canonical Room queue tests and isolated real PostgreSQL18 migration/upgrade suite. Do not bypass disabled paid functionality, authentication, rollback, provider or financial safety.

## Activation blockers, not acceptance
PR #716 merged a default-OFF review-only scheduler, **not** Gemini answer generation; it moves durable questions to authorized staff review. To actually activate free Rooms requires online protected Gateway, an authenticated real customer journey, confirmed migrated/correct PostgreSQL18 schema, and an actively deployed canonical Worker on main with its own runtime and necessary environment (or an independently qualified cohost integration). Setting `MASANAWA_ROOMS_BACKEND_ENABLED` and `MASANAWA_ROOMS_TEACHER_REVIEW_ONLY_ENABLED` cannot activate an absent/crashed service. Current missing release evidence: production service health, backup/restore, actual database migration/permissions, real two-account question→review→answer, mobile installed run and rollback. Paid subscriptions, provider spend and financial issuance must not be activated simply by setting feature flags.

## Hosted checks
Test/production build results are **NOT_RUN until the exact SHA's GitHub workflow job is inspected**. Append exact run evidence before merging. Live deployment remains separate. Do not claim production ready or invent a released tenant record.
