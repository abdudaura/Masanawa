# R15 — enforce persona safety at every paid AI Seat boundary

- **Owner/window:** ChatGPT R15 independent safety window, 2026-10-08.
- **Workstream:** talks-ai-seats security boundary; R15 (not blanket release acceptance).
- **Branch:** `work/r15-ai-seat-safety-authorization-20261008`
- **Base main SHA:** `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`
- **Last activity:** claim published 2026-10-08, immediately before implementation.
- **Owned paths:** `services/gateway/src/talk_ai_seats/postgres_repository.ts`, `services/gateway/src/talk_ai_seats/persona_safety.test.ts` (new), this claim.
- **Dependencies:** existing `talks.safety_enforcement`, `talks.persona_profiles`, canonical quote/refund transitions and host permission checks; no schema, auth/router/ledger, mobile or shared main changes.
- **Collision check:** open PR #433 touches AI Seat `model.ts` and `service.ts`, **not** this PostgreSQL repository. PRs #439/#438/#436/#435/#430/#426 own disjoint paths.
- **Current work:** enforce authoritative restricted/blocked persona visibility and safe paid quote/admission decisions under real DB transaction authority, with idempotent refund of already-sponsored requests when restricted before Host acceptance. Preserve terminal reads and neutral receipts.
- **Implementation:** pending. **Tests:** pending. **Deployment and handset:** unverified. **Merge:** forbidden until actual executable checks succeed.
- **Checks planned:** focused Vitest, TypeScript typecheck, real PostgreSQL safety-policy race/settlement tests, existing AI Seat tests, Gateway build.
- **Release gate:** does not qualify the remainder of R15 (live/removal/replay/report/channel acceptance) or R02/R03 audio readiness.
