# Talks backend domain/API/persistence — 2026-10-07

- **Owner/window:** current ChatGPT backend Talks window
- **Branch:** `work/talks-backend-domain-api-20261007`
- **Base SHA:** `6a944c310deb881cdbc9e987e4c4119d7f9d4289`
- **Lane:** backend Talk domain, persistence, authenticated HTTP API, comments persistence
- **Locked product contract:** human-hosted public Talks; human host required; Human Seats free; AI Seats monetizable separately; comments supported; Billing/Crypto remain the only standalone services.
- **Exact owned paths:**
  - `services/gateway/src/talks/**`
  - `services/gateway/src/talk_routes.ts`
  - `services/gateway/src/talk_routes.test.ts`
  - `services/gateway/src/app.ts` only for isolated Talk route registration after a fresh collision check
  - `docs/workstreams/talks-backend-domain-api-20261007.md`
- **Explicitly not owned:** all `apps/mobile/**`; canonical Talks/mobile product docs owned by `work/talks-home-vertical-feed-20261007`; Commerce/Twin/voice/channel/security implementations; shared migrations outside the lane.
- **Dependency:** consume existing authenticated customer identity shape and Fastify composition; no changes to mobile contract files.
- **Current step:** implement domain + durable SQL repository + API routes matching PR #335 mobile transport.
- **Last repository-visible update:** claim creation on this branch.
- **Implementation status:** in progress.
- **Verification status:** pending focused tests/typecheck.
- **Deployment status:** not deployed.
