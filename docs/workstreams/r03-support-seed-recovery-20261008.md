# R03 — Interrupted Gwani/Gwana default support bootstrap recovery (2026-10-08)

- **Owner/window:** ChatGPT, isolated R03 support bootstrap lane.
- **Branch:** `work/r03-support-seed-recovery-20261008`, draft PR #441.
- **Base main:** `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
- **Last repository-visible activity:** 2026-10-08T06:01:25.393Z.
- **Exact owned paths:** `services/gateway/src/platform_agent_bootstrap.ts`, `services/gateway/src/platform_agent_bootstrap.test.ts`, this note.
- **No shared changes:** migrations, Gateway composition, Talk AI Seat eligibility, pricing, runtime voice, package contracts, canonical ledger and mobile code unchanged.
- **Status:** CODE IMPLEMENTED / TEST CASES AUTHORED / RUN NOT VERIFIED / DEPLOYMENT AND AUDIO NOT QUALIFIED. Lease released; R03 remains PARTIAL.

## Discovered and corrected

Existing startup returned immediately when it found any support profile, even after partial provisioning: a recovered Gwani profile meant Gwana was permanently omitted. New bootstrap conservatively resolves existing profile IDs against visible canonical presentations and repairs only the absent canonical identity. It refuses to convert a noncanonical admin roster, duplicate/ambiguous support profile, hidden presentation or same-name admin specialist. Existing voice selections, presentation content, revisions and chosen default remain unchanged; if Gwana is already the admin default the newly completed Gwani is not made a second default. A matching canonical presentation left before profile creation is reused instead of creating a duplicate Character.

The original full Gwani+Gwana empty-tenant bootstrap behavior remains; new recovery never alters the other 15 planned experts or creates unqualified paid Talk AI Seats.

## Authored tests and verification state

- `00503bcf3d5bd3b77e0024bc2fd81e02b4c4daa8` — conservative interrupted-seed algorithm.
- `9a9f73f6af279a36ecd8d1d6d796aa1637b708e7` — partial support, admin default/voice, hidden presentation cases.
- `d95e96b9c86c0844e520bae6699ee7d9303ab5fd` — missing-profile presentation reuse and same-name admin specialist regression tests.
- Readback checked modified source and **7 authored Vitest cases** total in the existing suite. This is source inspection, not successful unit or integration execution.
- Foundation CI workflow #37735371016 completed **failure**, with job steps empty and log fetch returning a 404 BlobNotFound. This did not execute tests or reveal a code failure. The earlier run #37735324997 was also observed with zero steps. The remote workflows consistently fail before job steps, and this environment has no checked-out repository or installed Node 24/pnpm 12 dependencies. **Do not claim passing typecheck/test/build.**

## Required follow-on work

1. Recheck current main/PR conflicts; run `pnpm exec vitest run services/gateway/src/platform_agent_bootstrap.test.ts`, `pnpm --filter @masanawa/gateway-service typecheck`, repository tests/build and a PostgreSQL tenant bootstrap integration test in an executable environment.
2. Prove concurrent duplicate-startup safety under a durable tenant-scoped lock; this small recovery patch does not add a distributed provisioning lock, so do **not** mark initialization fully production-qualified.
3. Add the remaining **15** canonical AI Experts with stable seed keys, profile/voice suitability and readiness; preserve admin customizations, verify supported provider audio/role on devices, and gate paid public AI Seat admission on real provider/worker availability.
4. Qualify Gwani Bodi / Gwana Sulafat voices against actual Gemini Live backend and multilingual interruptions; no assumed availability or model credentials are supplied.
5. Leave R03 PARTIAL until complete staged/live acceptance. Keep PR #441 draft and unmerged pending executable test/production qualification.

## Reclaim — 2026-10-08T11:38:00Z (UTC)

Previous window's last repository activity was 06:01Z and its handoff explicitly released the lease. Reclaim only its existing draft PR #441 and preserve its Gwani/Gwana recovery changes. New exact owned paths: `services/gateway/src/platform_agent_bootstrap_lock.ts`, `services/gateway/src/platform_agent_bootstrap_lock.test.ts`, additive bootstrap-lock seams in `services/gateway/src/main.ts`, and this handoff. The `main.ts` edit is a tiny additive producer/caller change and must be semantically reconciled with C01 #468, R18 #435 and any newer shared Gateway composer edits before merging. No other window's source will be overwritten. New base remains original PR base; current main at inspection `1d6a67ea3c182455b55a7d1d07eacdb4311682e3`. Priority: prove cross-replica mutual exclusion around current persisted identity/assignment/profile sequence and failure recovery. Status: **PARTIAL_IMPLEMENTATION** pending source and executable integration proof.

