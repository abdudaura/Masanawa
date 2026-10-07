# Talks backend domain/API/persistence — 2026-10-07

- **Owner/window:** current ChatGPT backend Talks window
- **Branch:** `work/talks-backend-domain-api-20261007`
- **Original base SHA:** `6a944c310deb881cdbc9e987e4c4119d7f9d4289`
- **Main synchronization:** merged current Talks-mobile mainline into this lane at `e57cfeb67568e5040eddb42a33d8eef6dee20d07`
- **PR:** #337 — Implement durable Talks backend API and persistence
- **Lane:** backend Talk domain, persistence, authenticated HTTP API, comments persistence
- **Locked product contract:** human-hosted public Talks; human Host required; Human Seats free; AI Seats monetizable separately; comments supported; Billing/Crypto remain the only standalone services.

## Owned paths

- `services/gateway/src/talks/**`
- `services/gateway/src/talk_routes.ts`
- `services/gateway/src/talk_routes.test.ts`
- `services/gateway/src/app.ts` only for isolated Talk route registration
- `services/gateway/src/main.ts` only for Talk repository/auth/service composition
- `adapters/storage/postgres/src/readiness.ts` only to add the Talk migration root
- `packages/talks/migrations/**`
- this workstream handoff

Explicitly not owned: `apps/mobile/**`; AI Seat mobile presentation/transport owned by `talks-ai-seat-mobile-20261007`; Commerce/Twin/live-audio/channel/security implementations; unrelated shared migrations.

## Implemented

- `GET /talks?feed=explore|live` matching the merged mobile transport.
- `POST /talks` creates a live Talk only after platform customer-session authorization.
- The authenticated customer is persisted and projected as the required **Human Host** participant.
- `GET /talks/:talkId` returns Talk detail plus persisted comments.
- `POST /talks/:talkId/comments` persists authenticated comments.
- Durable tenant-scoped PostgreSQL Talk/comment repository.
- Explore includes live/reconnecting/ended Talks; Live only returns live Talks.
- Talk/comment count projection matches the mobile JSON model.
- PostgreSQL migration creates Talk/comment tables and feed/comment indexes.
- Production migration/readiness roots include the Talks migration.
- Gateway startup composes the Talk repository, customer-session authorizer and Talk service.
- Focused HTTP contract tests and PostgreSQL repository-boundary tests are included.

## Product/security invariants preserved

- No anonymous or AI-only Talk creation path exists in this lane.
- Public Talk Host identity comes from the existing authenticated platform customer session, never from request body fields.
- All persistence reads/writes are tenant scoped.
- AI Expert/Twin paid Seat money movement is **not** invented here; the independent AI Seat/Commerce lane remains authoritative.
- Billing, Crypto, Twin, voice and channel foundations are reused and untouched except for isolated Gateway composition.

## Verification / handoff

- PR #337 is currently mergeable.
- Foundation CI run `37599272700` for branch head `bff88b027d74259aee594cd514676989ac5e3c19` fails before any workflow step is created.
- This is a repository baseline/runner failure, not unique to this branch: current-main run `37598861735` and pre-Talk-reset main run `37592247418` have the same completed/failure result with **zero job steps**.
- Because the shared CI runner never reaches checkout/install/typecheck/test, there is no honest green CI claim for this lane. Tests are committed and ready to execute as soon as the repository CI service-startup problem is repaired.
- No production deployment or database migration was executed from this window.

## Follow-on boundaries

- Live audio state/media transport should consume this Talk identity/persistence rather than create a parallel Talk store.
- AI Seat backend/Commerce should consume Talk identity and enforce 6-seat / max-3-AI policy, quote authority, Host acceptance and refunds without editing the mobile AI Seat lane.
- Host moderation, replay/recording, ranking/search and notifications remain independent lanes.

**Implementation status:** complete for the claimed backend Talk feed/create/detail/comments + persistence slice.  
**Claim status:** handoff-ready via PR #337; do not treat the lane as abandoned while the PR remains open.
