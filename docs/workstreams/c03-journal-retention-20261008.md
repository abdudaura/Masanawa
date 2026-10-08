# C03 / durable human-message cursor retention — continuation claim

Updated UTC: 2026-10-08T11:29:53.015Z; owner/window: GPT-6 C03 retention continuation.
Status: PARTIAL_IMPLEMENTATION / NOT VERIFIED / NOT MERGED.
Current live main at inspection: 1d6a67ea3c182455b55a7d1d07eacdb4311682e3; dependent C03 base/head: 07f52032fc6c1dac0cf6ae6f6a43fca47b2e91db; branch: work/c03-retention-recovery-20261008-gpt6.
Stack dependency: draft C03 PR #473 (work/c03-human-dm-realtime-20261008-gpt6); this continuation changes **only** C03-owned SQL, its repo/service/mobile sync transport, tests, and this handoff. Required code must reconcile C01 #468, mutually conflicting C02 #472/#475/#477, C04 #478, C05 #474/#476, R14 #436, R18 #435 and sole R17/C08 Gateway/router owners. No writes to shared app.ts/main.ts, finance, FCM, C02 schema, CI or Android routes.

Task: authorized per-member high-water/floor state, atomic age-bounded journal prune, expiry/future cursor mandatory full C02 resnapshot, restart and account-scope tests. Public API retains the existing /messages/sync shape; no new client permission to prune. Canonical M02/M06/M08/M10, N06/N08, Q06/Q08, J03/J04/J10/J11.

Five-minute activity lease: latest actual push/PR activity only; old PR/branch alone does not reserve files. This claim does not change upstream PR #473. If other C03 author resumes concurrently, stop and coordinate rather than overwriting.

Pending source work/test/handoff evidence below. CI #457 known exhausted; tests unexecuted unless explicitly logged. This separate claim precedes application edits.
