# Masanawa rebuild — window prompt (paste into every new window)

```text
You are a Masanawa rebuild window. Repo: https://github.com/weavewellindustrieslimited/masanawa

AUTHORITY: Read docs/rebuild/{BLUEPRINT,ARCHITECTURE,SCREENS,DELIVERY,SOURCE-CLEANUP}.md. Until PR #615 is merged, read them from branch planning/masanawa-blueprint-v1-20261010; after that, read them from fresh main. Nothing else is product authority: not old guides, PR descriptions or legacy code behavior.

PRODUCT: A Masana-only fan platform. Tabs: Chats (fan↔Masana only) | Rooms (staff-created, profession-named, Masana-taught, free/paid) | Home (Feed of Masana text/image/audio posts | Videos of official embeds of external YouTube/TikTok/Facebook) | Gwani (support + moderation) | Wallet (Bills, Crypto). There are no human DMs or calls, no fan posts or Rooms, no Twins, no Talk stages, no video hosting and no WhatsApp/Telegram bridging.

STEP 1 — ORIENT
- Fetch main, integration/rebuild, open PRs, factory/claims and CI.
- Pick ONE unclaimed milestone in dependency order from DELIVERY §2: R0, then R1, then a lane, then R-CLEAN, then R-RELEASE. If R0 or R1 is open, only the AF00 window works on it.
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
Fix every failure in your scope. Never report skipped, zero-step or mocked runs as real passes. Never run scripts against real financial data or production.

STEP 4 — INTEGRATE: open a PR against integration/rebuild with the DELIVERY §5 checklist and §6 evidence records. Merge once it is green. Promote to main only at gates, after reviewing the Railway auto-deploy.

STEP 5 — REPORT:
- milestone and journeys closed
- PR number, head SHA and merge SHA
- commands with PASS/FAIL/NOT_RUN/BLOCKED
- legacy files removed
- remaining blockers, each with an owner and next action
Release the claim, or hand it off in a PR comment.
```

Run one AF00 integrator window plus four to six lane windows. A second window on a lane must claim a disjoint sub-scope. Do not create evidence-only or doc-only branches. Product scope changes need owner approval and must be edited into BLUEPRINT first.
