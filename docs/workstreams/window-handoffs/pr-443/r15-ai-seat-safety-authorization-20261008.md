# R15 — enforce persona safety at every paid AI Seat boundary

- **Owner/window:** ChatGPT R15 independent safety window, 2026-10-08.
- **Workstream:** talks-ai-seats security boundary; R15 (not blanket release acceptance).
- **Branch:** `work/r15-ai-seat-safety-authorization-20261008`
- **Base main SHA:** `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`
- **Last activity:** claim published 2026-10-08, immediately before implementation.
- **Owned paths:** `services/gateway/src/talk_ai_seats/postgres_repository.ts`, `services/gateway/src/talk_ai_seats/persona_safety.test.ts` (new), `services/gateway/src/talk_safety/repository.ts`, `services/gateway/src/talk_safety/repository.test.ts`, this claim.
- **Dependencies:** existing `talks.safety_enforcement`, `talks.persona_profiles`, canonical quote/refund transitions and host permission checks; no schema, auth/router/ledger, mobile or shared main changes.
- **Collision check:** open PR #433 touches AI Seat `model.ts` and `service.ts`, **not** this PostgreSQL repository. PRs #439/#438/#436/#435/#430/#426 own disjoint paths.
- **Expansion before editing:** Coordinate admissions with authoritative `talks.safety_enforcement` writes using the same tenant/persona PostgreSQL transaction advisory lock. No active PR owns these safety repository paths; other R15 moderation services remain untouched.
- **Current work:** enforce authoritative restricted/blocked persona visibility and safe paid quote/admission decisions under real DB transaction authority, with idempotent refund of already-sponsored requests when restricted before Host acceptance. Preserve terminal reads and neutral receipts.
- **Implementation:** pending. **Tests:** pending. **Deployment and handset:** unverified. **Merge:** forbidden until actual executable checks succeed.
- **Checks planned:** focused Vitest, TypeScript typecheck, real PostgreSQL safety-policy race/settlement tests, existing AI Seat tests, Gateway build.
- **Release gate:** does not qualify the remainder of R15 (live/removal/replay/report/channel acceptance) or R02/R03 audio readiness.

## Implementation checkpoint — 2026-10-08T06:05Z

- **Branch HEAD:** `84cdbee55b102e5414de0305667097c3b8007dd0`; [draft PR #443](https://github.com/Baatiku/masanawa/pull/443). Base SHA above; PR reports GitHub mergeable but that is not an executable test.
- **Implemented code:** candidate query filters authoritative restricted/blocked personas before ordering; individual persona lookup reads effective safety; new quote/confirmation cannot create paid authorization for restricted/unavailable personas; blocked pending sponsorship follows existing canonical decline/hold-release and activity cleanup when Host acts; a newly fetched runtime seat is hidden when restricted.
- **Safety serialization:** tenant/persona PostgreSQL transaction-scoped advisory guard shared by quote creation, confirmation, Host admission and platform safety CAS insert/update. Tested SQL shape includes a nonambiguous `INSERT … SELECT … WHERE TRUE ON CONFLICT` and `UPDATE … FROM` guard. This prevents the moderation write and the paid admission check from passing one another while both hold DB transactions.
- **Auth/financial isolation:** unchanged `TalkAiSeatService` authenticated caller and canonical quote/settlement/Host authorization. No direct API, ledger, provider or client price bypass; no new database schema.
- **Regression tests AUTHORED, not run:** `persona_safety.test.ts` exercises tenant-scoped candidate safety, new quote denial, preexisting quote confirm denial/rollback before funds move, runtime seat filter; `talk_safety/repository.test.ts` exercises atomic guarded insert/CAS update.
- **Readback/limited static verification:** branch source read back via GitHub; guard appears 3 times at corresponding transactional call sites and effective restriction checks at candidate, individual, dispatch paths; PR compares cleanly to inspected main.
- **EXECUTABLE VERIFICATION:** **NOT PERFORMED**. No working Node package workspace/Vitest/TypeScript/PG runner in this connector session. Latest unrelated GitHub Actions fail before runner allocation, zero steps. No real PostgreSQL isolation/deadlock/restriction/refund race test, application build, deployed SHA, or device/provider qualification.
- **Required checks:** `pnpm exec vitest run services/gateway/src/talk_ai_seats/persona_safety.test.ts services/gateway/src/talk_safety/repository.test.ts services/gateway/src/talk_ai_seats/runtime_dispatch.test.ts services/gateway/src/talk_ai_seats/moderation_bridge.test.ts`; `pnpm --filter @masanawa/gateway-service typecheck`; Gateway build; test a real PostgreSQL transaction race (new quote vs restrict, confirm vs restrict, sponsor accept vs restrict), funds release idempotency and dispatch isolation.
- **Remaining R15 scope:** active restricted AI removal/mute, paid AI dispatch already accepted before restriction, unmatched queued holds until Host action/TTL, full report/block/mute, safety across public live/recording, WhatsApp and Telegram; operator/release approval. **R15 is PARTIAL and PR MUST STAY DRAFT; DO NOT MERGE until actual executable tests and financial/live safety acceptance.**
- **Handoff:** maintain disjoint ownership from PR #433 (`talk_ai_seats/model.ts`/`service.ts`); before merging reconcile current main and other PRs. This activity lease expires five minutes after the last branch push. Another window may reclaim without overwriting these commits.
