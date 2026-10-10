# Masanawa — start here (current rebuild)

**Product direction locked 2026-10-10.** Rebuild inside the existing [weavewellindustrieslimited/masanawa](https://github.com/weavewellindustrieslimited/masanawa) monorepo (formerly abdudaura/Masanawa), executing docs/rebuild/DELIVERY.md R0 → R1 → lanes → R-CLEAN → R-RELEASE, using tested reusable code and a clean feature-first design. Do not follow old branch planning, readme history, deleted plans or stale PR descriptions as product instructions.

## Reading order (only)
1. [AGENTS.md](AGENTS.md) — product constraints, safety, claims and testing.
2. [Product master blueprint](docs/rebuild/BLUEPRINT.md) — **what to build and what not to build**.
3. [Screen and journey registry](docs/rebuild/SCREENS.md) — all mobile/admin interactions and states.
4. [Architecture and data](docs/rebuild/ARCHITECTURE.md) — modules, DB, APIs, workers and provider restrictions.
5. [Delivery milestones and test gates](docs/rebuild/DELIVERY.md) — source recovery, owners, tasks, validation/merges.
6. [Single window prompt](docs/rebuild/WINDOW-PROMPT.md) — use when opening additional development windows.
7. [Seed profiles](docs/rebuild/SEED-MASANA.json) and [sample content](docs/rebuild/SEED-CONTENT.json) for the **12** professional Masana; fixture only until a verified staging seed runs.

## The platform
**Chats / Rooms / Home / Gwani / Wallet**; Home **Feed | Videos**. Chats/calls are fan-to-Masana **only**, Rooms platform-created and professionally led, Home original Feed Masana-only, Videos sourced from eligible external channels/official embeds, Gwani moderation/support and practical services, Wallet + independent Billing/Crypto. No user publishing, human-to-human chat/calls, user Rooms, personal Twins or clone economy. Staff Android Admin manages Masana identity/skills/photos/voices, media/posts, global Rooms/free-paid plans, scheduled weekly missions, fans/memory, external video channels, Gwani cases, Wallet and operations.

## First window action — source progress must not be blocked by tests
Audit latest `main`, `integration/rebuild`, open PRs, claims and the canonical blueprint. **Immediately begin the first unclaimed source-complete lane journey in your exact files**, even when AF00 is still working R0/R1 or old CI, PostgreSQL, provider, Flutter or Android checks are failing/unavailable. Dependencies block only shared composition or live activation; they **do not block independent feature implementation**. Do not create another integrator or duplicate backend. Follow DELIVERY §1A (owner-approved 2026-10-10): AF00 promptly combines reviewed, source-complete, fail-closed work into non-deploying `integration/rebuild` with truthful carried verification debt. Full green integration/device/financial tests are due before release, **not before coding**. CI/runner unavailable is BLOCKED/NOT_RUN, not PASS. The old app is a donor, not product authority. No production deployment, real-money activation or destructive data operation without separate qualification.

**Status:** documents prescribe the rebuild, not proof that source/runtime/DB have already been converted. No product-ready claim until actual integrated tests and real APK/authorization checks.
