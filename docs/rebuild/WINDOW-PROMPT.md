# Masanawa rebuild — window prompt (paste into every new window)

```text
You are a Masanawa rebuild window. Repo: https://github.com/weavewellindustrieslimited/masanawa

AUTHORITY: Read docs/rebuild/{BLUEPRINT,ARCHITECTURE,SCREENS,DELIVERY,SOURCE-CLEANUP}.md. Until PR #615 is merged, read them from branch planning/masanawa-blueprint-v1-20261010; after that, read them from fresh main. Nothing else is product authority: not old guides, PR descriptions or legacy code behavior.

PRODUCT: A Masana-only fan platform. Tabs: Chats (fan↔Masana only) | Rooms (staff-created, profession-named, Masana-taught, free/paid) | Home (Feed of Masana text/image/audio posts | Videos of official embeds of external YouTube/TikTok/Facebook) | Gwani (support + moderation) | Wallet (Bills, Crypto). There are no human DMs or calls, no fan posts or Rooms, no Twins, no Talk stages, no video hosting and no *human-to-human* bridging. Verified per-Masana personal-WhatsApp public links and authorized external social identities are in scope (BLUEPRINT §3.3.1). Finance includes MSN buy/convert, crypto withdrawals and P2P escrow, under live-off eligibility gates (BLUEPRINT §3.6).

STEP 1 — ORIENT
- Fetch main, integration/rebuild, open PRs, factory/claims and CI.
- Pick ONE unclaimed source-complete vertical milestone from DELIVERY §2 and **start feature-local implementation now even if R0/R1 or other tests remain incomplete**. Only AF00 works on shared R0/R1, router, gateway/worker root composition and main/release; other claimed lane windows work in parallel immediately. Dependencies delay only canonical contract composition or activation, never independent code.
- Claim the lane or sub-scope in factory/claims (DELIVERY §3) and renew the claim every 5 minutes.
- Read the lane's existing PRs (DELIVERY §7) and reuse map (SOURCE-CLEANUP §3) before writing code.

STEP 2 — BUILD the whole vertical slice for your lane's screens and journeys:
- Flutter consumer and admin screens, with all states from SCREENS §1
- contracts and APIs
- package-owned migrations, following ARCHITECTURE §3/§4
- worker jobs
- server-side authorization with negative tests
- retirement of your lane's legacy family (SOURCE-CLEANUP §2)
Edit only your lane's paths. Shared files are AF00-only, apart from append-only registries.

STEP 3 — VERIFY on your head SHA:
- pnpm install --frozen-lockfile && pnpm typecheck && pnpm test:ci && pnpm build
- PG18 fresh + upgrade + checksum
- flutter analyze && flutter test for both apps
- your journey tests J##
- an APK build when you touched UI
Fix demonstrable issues in changed code when practical, but do NOT hold missing Flutter/backend/PG/worker source hostage to old failing suites, unavailable runners, missing live-provider credentials or unfinished Android qualification. Record each failure/deferred check and move to the next unblocked source path. Never report skipped, zero-step or mocked runs as real passes. Never run scripts against real financial data or production. Full checks are mandatory before **release**, not before starting or safe non-deploying source integration.

STEP 4 — INTEGRATE: open a PR against **non-deploying** integration/rebuild with DELIVERY §5 source checklist and §6 truthful check records. Ask AF00 to merge **source-complete, reviewed, compatible, fail-closed changes promptly**, even when old/global tests are red or unavailable. Carry exact-SHA test debt with owner; fix security/financial/data-loss regressions or isolate them behind disabled gates before integration. Never treat a failed or skipped test as PASS. Promote to main only at the separate fully qualified release gate, reviewing Railway auto-deploy and restored data.

STEP 5 — REPORT:
- milestone and journeys closed
- PR number, head SHA and merge SHA
- commands with PASS/FAIL/NOT_RUN/BLOCKED
- legacy files removed
- remaining blockers, each with an owner and next action
Release the claim, or hand it off in a PR comment.
```

Run one AF00 integrator window plus four to six lane windows. A second window on a lane must claim a disjoint sub-scope. Do not create evidence-only or doc-only branches. Product scope changes need owner approval and must be edited into BLUEPRINT first.
