# Masanawa — Delivery plan, lanes, source-first integration and release gates 1.2
**This file is the only execution plan.** It replaces the earlier M0–M7 list, the manifest `todoOrder`, and all AF/U/F/C/RECOVERY numbering in active work. Old IDs survive only in the PR disposition table (§7). Planning is not implementation. Source completion, safe non-deploying integration, and production qualification are distinct states. Nothing is **released** without §6 evidence.

Baseline at planning: `main = 7c443966be97e9092cbc1fb98562c75253434326`. Refresh before coding.

## 1. Principles
1. **One vertical milestone per window.** Implement the complete Flutter UI, admin screens, contracts, API, migration source, worker, authorization and test source for the journeys together. A missing runner delays execution evidence, **not writing or reviewing the remaining code**. An isolated fix is not a milestone.
2. **Freeze activation before release, not coding.** AF00 owns server-side legacy retirement; independent lanes may implement new modules immediately in claimed paths while R0 proceeds. They must not activate prohibited old endpoints or duplicate existing systems.
3. **Lanes own paths, not themes.** Each lane owns exact directories (§3). Shared files belong to the integrator (AF00). This removes the main source of duplicate and conflicting work.
4. **Reuse first.** Before writing new code, a lane checks the reuse map (SOURCE-CLEANUP §3) and open PRs (§7) for its domain.
5. **Integrate source continuously** into `integration/rebuild` (non-deploying). Known unrelated test failures or unavailable runners do not hold independent source hostage. Promote to Railway-linked `main` only through separate full release gates after reviewing deployment and real data safety.

## 1A. OWNER-DIRECTED SOURCE-FIRST UNBLOCK (effective 2026-10-10)

**This instruction supersedes the earlier R0/R1 all-work and green-CI-first freezes. Start development now.** Separate these three evidence states:

- **SOURCE_IMPLEMENTED:** claimed, committed, reviewed feature files contain *all required* Flutter/Admin screens, backend contracts/authorization, PostgreSQL migration **source** and repository, worker/retry source, provider adapters, error/offline states, integration wiring or exact composition request, and appropriate automated test source. No fixture-only screens as completion; missing code is a source blocker and must still be implemented. Mark each requested journey's source path with head SHA.
- **INTEGRATED_UNVERIFIED:** AF00 merges a reviewed, conflict-resolved, non-destructive feature into **non-deploying** `integration/rebuild` even if historical or unrelated Vitest/Postgres/Flutter/Android/provider runs are red, cancelled, unavailable or unaffordable. Record check results with exact SHA and owner, don't hide them or turn them green. Keep newly authored money/paid/external actions and destructive schema switches disabled; review auth boundaries, money precision, idempotency, tenancy, migration history and secrets **before composition**. Errors that demonstrate unsafe money movement, privilege escalation, data loss, corruption or incompatible shared contracts still require a source fix or a fail-closed isolation before integration.
- **QUALIFIED_RELEASE:** **only** after the pinned unified SHA passes relevant executable tests, PG18 fresh+upgrade+checksum+restore, Flutter and Android/device journeys, authorization negatives, provider qualification, security and rollback. Only this state can permit `main` promotion/deployment or real financial activation after explicit approval. Missing tests always remain `NOT_RUN`/`BLOCKED` or `FAIL`, never `PASS`.

**Immediate parallel authorization:** AF00 continues R0/R1 shared file composition and retired entry-point guards. **All other independently claimed lanes may begin their actual source work at once**, regardless of whether R0, R1, global CI or another lane is complete. Use canonical DTO/SQL shapes from ARCHITECTURE as provisional published interfaces, or add an exact-path contract PR; do not invent an alternate ledger, chat journal, session authority, storage system or second schema registry. Implement self-contained modules and tests now; request append-only registrar/root/router hookups from AF00 when dependency-ready. Unavailable prereqs only delay that specific **integration/activation edge**, not the entire lane. Continue on any non-overlapping feature file instead of waiting on another contributor.

**Tests after source, not instead of source:** Run quick scoped executable checks when available; failing or missing infrastructure produces a dated debt record (SHA, command, failure, owner, rerun trigger), not a mandatory pause. A test failure in a changed contract should be fixed when practical; do not silently skip or reclassify it. Full historical test repair, expensive PG/provider suites and device qualification are scheduled for R-CLEAN/R-RELEASE after source closure. Do not spend a whole window tuning tests from an excluded legacy product while missing Masana feature code remains. Keep quality workflows available for opt-in execution; no fake all-green CI.

**Safety boundary:** No auto-merge to `main` (Railway Git-linked), no migration to production/shared financial DB, no real provider payments, no live WhatsApp account automation, no permission bypass and no disabling audit/security checks as a shortcut. No force push/reset/deletion of contributor branches or historical financial records. If a blocker is genuinely security/data-critical, isolate it behind a default-off feature flag and continue unrelated source; escalate only that specific change to AF00.

## 2. Milestone graph
```text
R0 Shared freeze ────▶ R1 Shared foundation ────▶ AF00 composition ────▶ R-CLEAN ─▶ R-RELEASE

IN PARALLEL NOW: L-SHELL · L-MASANA · L-CHAT · L-FEED · L-VIDEO · L-ROOMS · L-GWANI
                 L-FIN · L-SOCIAL · L-ADMIN · L-MISSIONS · L-PLATFORM

Historical activation graph (composition dependency only):
R0 Baseline & freeze ──▶ R1 Platform foundation ──┬─▶ L-SHELL ─┬─▶ L-CHAT ──────────────┐
   (AF00, single)          (AF00 + L-PLATFORM)     │           ├─▶ L-FEED ──▶ L-MISSIONS ├─▶ R-CLEAN ─▶ R-RELEASE
                                                   ├─▶ L-MASANA (seed, studio) ──┘        │
                                                   ├─▶ L-VIDEO                            │
                                                   ├─▶ L-ROOMS (free ▶ paid)              │
                                                   ├─▶ L-GWANI                            │
                                                   ├─▶ L-FIN                              │
                                                   └─▶ L-ADMIN (shell, RBAC, ops) ────────┘
```
**Starting now**, up to **six disjoint lanes can code in parallel**, including L-SOCIAL and finance escrow source. R0/R1 dependencies govern composing and activating shared contracts, **not starting independent source**. L-SHELL must provide shell and design tokens before AF00 merges UI into the shared router; until then lanes build screens under their own feature directories. L-MISSIONS can implement mission source while L-FEED supplies the post model; final publish-once integration waits for the canonical post contract. No waiting merely because another lane has red tests.

### R0 — Baseline & freeze (AF00 alone for shared paths; does NOT block other lanes' source work)
- [ ] Refresh `main`, the open PRs (§7), `factory/claims`, CI state (Actions quota, PR #460) and local Windows dirty source. Record the APK hash and signer of the last built APK.
- [ ] Inspect Railway: the Git source branch, the start command, whether `migrate.ts` runs on boot, the PG version and the applied `masanawa_schema_migrations` rows (owner, name, sha256). Verify the backup, then **restore into a disposable staging DB** and record the result.
- [ ] Create `integration/rebuild` from `main`. Its CI runs typecheck, Vitest, the PG18 fresh+upgrade migration check, Flutter analyze/test for both apps and an APK build. Zero-step or skipped is **not** pass.
- [ ] **Freeze:** a server-side feature-flag gate returns `410 feature_retired` for Twin/clone, human DM/contacts/calls, Talk stage/seats/gifts/polls, member Room or post creation, owner access and **unauthorized legacy customer WhatsApp/Telegram bridging** (D3). Preserve verified Masana social identity public links and only legitimately authorized connectors; no personal-WhatsApp automation API is presumed. This covers REST, WS and job enqueue. Read-only access to the user's own historical receipts stays.
- [ ] Apply the PR disposition (§7): close the excluded PRs with a salvage note, and rebase or re-target the keepers onto `integration/rebuild`.
- [ ] Merge this blueprint PR (#615) after confirming that a docs-only merge to `main` triggers no unsafe deploy.
- [ ] File the provider applications: TikTok Display API, Meta Page permissions, Play Console subscriptions (D1, D9).

**R0 source-progress checkpoint:** shared integration branch and fail-closed retirement source in progress, failures/backup/restore recorded with owners; other lanes proceed regardless. **R0 release gate:** restore proven, freeze REST/WS/job tests J10 passed, outstanding failures resolved and blueprint promotion safe. This release gate may remain red while source integration proceeds.

### R0 owner-approved scope corrections (mandatory before freezing)
- [ ] Reconcile owner revision 1.2 (BLUEPRINT §§3.3.1/3.6 and ARCHITECTURE §§12–13) against old D3/D8, CI, and existing #515/#576/#607/#590. Do **not** close permitted verified social-profile/public-identity work as obsolete bridging.
- [ ] Classify every old WhatsApp automation integration as authorized API capability, manual-only, link-only or disabled. Existing personal-session automation is **not** authorized merely because it links; no WhatsApp Business/Cloud API integration.
- [ ] Preserve existing real ledger obligations and finance approval gates. Implement MSN purchase, conversion, external crypto withdrawals and escrow P2P as protected domain work, not as a parallel wallet; no direct fiat withdrawals.
- [ ] Map all C01–C80 and A01–A35 destinations (including nested destinations) to exact existing/new Flutter route, API, SQL owner, event worker, tests and named owner. Mark missing source as missing—not done.

### R1 — Platform foundation (AF00 + L-PLATFORM)
- [ ] Scaffold the packages `masana`, `feed`, `external-videos`, `rooms` and `moderation`, each with `migrations/0001_*.sql` following ARCHITECTURE §3/§4, and register them in `platformProductMigrationRoots()`. Add the duplicate-prefix CI check and the checksum-immutability check.
- [ ] Add the `modules/index.ts` and `jobs/index.ts` append-only registries, the staff roles table plus a role middleware, and the agent autonomy table. Add `contracts` v1 DTO skeletons and Dart model generation.
- [ ] Ship a `feature_flags` and kill-switch service (reusing an existing flags store if present) and an outbox job helper with lease, retry and dead-letter (built on `events.outbox`).
- [ ] Write the seed runner skeleton (staging-gated with `MASANAWA_SEED_ALLOWED=staging`) and the e2e harness `tests/e2e/` with a PG18 fixture.

**R1 composition gate:** fresh and upgrade migrations pass on a disposable restored snapshot, J10 complete, J19 skeleton passes before shared activation. Lanes already started source work under §1A; they do not await R1 to implement their own code and migration files.

### Lanes (each = one or more windows; scope = the screens and journeys listed)
| Lane | Screens | Journeys | Key work | Integration/activation depends on (NOT a coding-start blocker) |
|---|---|---|---|---|
| L-SHELL | C01–C08, C20 shell, design system | J01 J02 J16 | five-tab router rewrite, blue tokens and assets, l10n, onboarding, disclosure, notifications centre, FCM | R1 |
| L-MASANA | C24, A02–A04 | J18 | character revisions, media, voice profiles, follows, profile API, seed runner with real media | R1 |
| L-CHAT | C10–C15 | J03 J04 | Masana-only chat on existing agent sessions, shared composer (salvage U10 #529/#530, CHAT-P04 #612), calls through presence and LiveKit (salvage AF05) | L-SHELL, L-MASANA |
| L-FEED | C20–C26, A05–A06 | J06 | posts (extend AF09 #609 published-audio), comments, reactions, saves, counters, ranking, search | L-SHELL, L-MASANA |
| L-VIDEO | C27–C29, A13–A14 | J14 J15 | sources and items, YouTube WebSub and reconcile, manual admission, official player WebView | L-SHELL |
| L-ROOMS | C30–C36, A09–A12 | J07 J08 | rooms, membership, lessons, questions and teacher queue (salvage talk_questions, U06 #579), Play Billing and entitlements | L-SHELL, L-MASANA |
| L-GWANI | C40–C43, A15 | J13 | cases, evidence, actions, appeals, Gwani tools, comment and discussion moderation hooks (salvage F08 #548) | R1 |
| L-MISSIONS | A07, A08, A16 | J11 J12 | missions, slots, publish-once, budgets, autonomy L0–L2, fan memory extraction and controls | L-FEED |
| L-FIN | C47–C80 and C50–C54; A17,A27–A35 | J05 J09 J23–J26 | existing commerce ledger: standalone Bills, MSN buy/convert, crypto payouts, real P2P reserve/dispute/fees with live-off compliance; AF01 #607/#590, #576 gated | R1, L-SHELL; Gwani case authority for J26 |
| L-SOCIAL | C44–C46,C78–C79; A20–A26 | J21 J22 | per-Masana personal WhatsApp verified link-only, authorized Telegram/other social connections, Admin controls, secure provider capability and audit; no Business API or unapproved automation | R1, L-MASANA; L-SHELL for consumer wiring |
| L-ADMIN | A01, A18, A19, admin shell | J19 | drawer shell, RBAC, overview, ops and kill switches, staff management | R1 |
| L-PLATFORM | — | J10 J17 J20 | security negatives, restore and APK qualification (salvage the F11 and R16 gates), load and cost tests | R0 |

**Lane source-closure checkpoint:** all screen/API/DB/worker/admin/test source and pending exact-path AF00 composition instructions are committed and reviewed; unknown checks are clearly labeled (§6). Compatible, fail-closed work may merge into non-deploying integration with unresolved unrelated tests. **Lane release gate:** every journey passes at its pinned unified SHA and the legacy family is safely retired. Do not confuse source closure with released journeys.

### R-CLEAN — Retirement sweep (AF00 + lane owners)
For each legacy family, the lane that replaced it deletes the old routes, workers, Dart screens, tests, l10n keys and dependencies (SOURCE-CLEANUP §2). AF00 removes them from `app.ts`, `main.ts` and the router. A dependency-graph check (`pnpm -r why`, a Dart import scan) proves there are no consumers. Migrations stay. **Gate:** zero reachable excluded routes (J10 against the full route table), and the manifest shows every entry `done` or `retained-migration`.

### R-RELEASE — Integrated release (AF00 + L-PLATFORM)
Pin the integrated SHA, then:
- run full CI on that SHA and the PG18 fresh and upgrade migrations on a staging restore
- build signed consumer and admin APKs and record their hashes and signers
- smoke-test on a low-end Tecno-class device, covering J01–J26
- rehearse the provider webhooks, quotas, alerts, a backup restore and a rollback

Promote to `main` and to staging, then production, only after owner sign-off on D1–D9 and approval of financial operations. Claim `DEPLOYED_VERIFIED` only with real execution evidence.

### Owner expansion — milestones after R1
- **L-SOCIAL:** consume C44–C46/C78–C79 and A20–A26, J21–J22, implementing full consumer/Admin/worker/PG source. Coordinate with L-MASANA on public profile rendering; no old user-channel bridge.
- **L-FIN / MSN:** C48–49,C55–58,C71–74, A27–29, J23–J25; integrate existing payment/custody adapters and provider reconciliation with hard default-off live flags.
- **L-FIN / escrow:** C59–70,C75–77,A30–35,J26; complete structured P2P trade, locked crypto reserve and dual-reviewed dispute/appeals. Pair Gwani integration with its domain owner; no unapproved live money.
- **Verification:** publish all new journey negative tests and provider/corridor qualification evidence separately. No automatic merge to Railway-linked `main` until its deploy trigger is audited.

## 3. Path ownership (the anti-duplication contract)
| Owner | Exclusive paths |
|---|---|
| **AF00 integrator** | `apps/*/lib/src/app/**`, `apps/mobile/lib/src/router/**`, `services/gateway/src/{app,main,migrate}.ts`, `services/worker/src/{app,main}.ts`, `adapters/storage/postgres/src/{readiness,migrations}.ts`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.github/**`, `docs/rebuild/**` (product edits need owner approval) |
| **Lane `X`** | `apps/mobile/lib/src/features/<x>/**`, `apps/admin_mobile/lib/src/features/<x>/**`, `services/gateway/src/modules/<x>/**`, `services/worker/src/jobs/<x>/**`, `packages/<x-package>/**`, `adapters/storage/postgres/src/<x>/**`, `tests/e2e/J##/**` for its journeys |
| **Append-only shared** | `services/gateway/src/modules/index.ts`, `services/worker/src/jobs/index.ts`, `apps/*/lib/l10n/*.arb` (own key prefix `<lane>_`), `packages/contracts/src/index.ts` (one export line). Lanes add lines and never edit others' lines. |
| **L-SHELL** | `apps/*/lib/src/shared/design/**`, Android launcher and splash assets |
| **L-CHAT** | `apps/mobile/lib/src/shared/{media,transport}/**` (audio focus, composer) |

New lanes: social→`masana_social,social_connections` (consumer `features/masana/**` requires explicit scoped coordination with L-MASANA); escrow belongs to finance, not a second ledger. Shared `app.ts`, migration roots, Admin drawer and provider activation remain AF00-only.

Lane-to-directory names: shell→`account,notifications`, masana→`masana`, chat→`chats,calls`, feed→`home_feed`, video→`videos`/`external_videos`, rooms→`rooms,subscriptions,plans`, gwani→`gwani,moderation`, missions→`missions,fans_memory`, fin→`wallet,bills,crypto,finance`, admin→`overview,operations`.

**Claims:** a window claims a whole lane (or one named milestone inside it) in `factory/claims` as `lane=<L-…> window=<id> branch=<…> head=<sha> expires=<UTC+5min>` and renews it. A claim older than 5 minutes may be taken over **only after** reading its PR head and posting a handoff comment. A second window on the same lane must take a disjoint sub-scope written in the claim (e.g. `L-ROOMS/paid`).

## 4. Branching and merge
- Branch names follow `lane/<lane>-<scope>-<yyyymmdd>-<window>`. Open one draft PR per lane milestone **against `integration/rebuild`**.
- **Merge to non-deploying integration:** AF00 checks current head, exact-path claims, contract compatibility, source completeness, no unsafe privileged/financial side effects and no destructive migration. Relevant fast checks run when available; record FAIL/NOT_RUN/BLOCKED without forcing all lanes to wait for unrelated historical failures. Source can merge with explicitly carried verification debt if fail-closed and otherwise compatible. Rerun impacted checks when possible; do not falsify CI status.
- **Merge to main / release:** distinct mandatory full pinned-SHA verification (including PG migrations, money/auth security, device/Android and provider evidence), Railway auto-deploy review, staging data restore, rollback and owner approval. Unrun/failed relevant release checks block activation, NOT lane coding.
- Rebase daily on `integration/rebuild`. Conflicts in append-only files are resolved by keeping both lines.
- Do not promote `integration/rebuild` to `main` while source-only debt remains, regardless of how many PRs have merged. Each promotion requires reviewed Railway auto-deploy, actual backup/restore evidence, migration dry run on disposable snapshot and release qualification.

## 5. Per-PR checklist
- [ ] UI states (SCREENS §1), l10n ha/en, dark mode, accessibility goldens
- [ ] contracts versioned, API authz negatives (403 and 410), idempotency on writes
- [ ] migrations follow tenant and composite keys, are forward-only and pass the three checks
- [ ] worker jobs are lease-safe, retry with backoff, dead-letter and respect budgets and kill switches
- [ ] admin screens for the domain are included, with RBAC and audit
- [ ] reuse noted; legacy files for the family removed or listed with blocker
- [ ] evidence records (§6) attached to the PR

## 6. Commands and evidence
- **Root** (Node 24, pnpm 12): `pnpm install --frozen-lockfile && pnpm typecheck && pnpm test:ci && pnpm build`. Run PG18 migrations with `pnpm --filter @masanawa/postgres test` plus the fresh and upgrade scripts (add in R1 if missing).
- **Flutter:** `cd apps/mobile && flutter pub get && flutter analyze && flutter test`, then the same for `apps/admin_mobile`. APK: `flutter build apk --release` with the existing signing setup. Integration tests use `flutter test integration_test` on a device or emulator.
- Record every check as `{sourceSHA, command, environment, result: PASS|FAIL|NOT_RUN|BLOCKED, summary, logRef, owner, rerunAt}`. Keep known failing historical suites in the shared verification ledger; do not make their immediate repair a dependency for independent implementation. Mocked or simulated provider tests are labelled separately from real provider or device tests.
- **Source progress does not require full execution of the above commands before coding or non-deploying integration.** Tests still exist, failures stay visible, and full execution remains required before release. Never claim a check passed merely because it was deferred.

**Known CI state at planning:** Foundation CI run 38056564479 on #615 failed typecheck at `packages/agents/src/talk-replay.test.ts(6,8) TS2459`. Vitest and build were SKIPPED. #460 (shared CI recovery and Actions quota) carries the fix and is owned by AF00 in R0. Do not duplicate it.

## 7. Open PR disposition (from titles and branches on 2026-10-10; verify the touched paths before acting)
| Action | PRs |
|---|---|
| **Keep → retarget to `integration/rebuild`** | #460 CI recovery (R0) · #613 factory/claims · #600 five-tab nav and #552 five-tab guard (L-SHELL: update to the new tab set) · #586 deep-link authority · #597 neutral launch · #588 auth revocation · #547 contrast guards (re-token to blue) · #542 l10n integrity · #574 bidi · #565 profile text guard · #539 onboarding low-end (L-SHELL) · #612 Gwani text-before-audio · #534 Gwani voice continuity · #580 durable task journal (L-GWANI/L-FIN) · #602 #591 #589 PCM/live voice recovery (L-CHAT calls) · #587 local chat clear (L-CHAT) · #609 published-audio posts (L-FEED) · #606 #604 notification state and activity recovery (L-SHELL) · #607 #590 ledger and billing settlement (L-FIN) · #576 MSN crypto wallet (L-FIN, flag-gated) · #599 orphan cleanup and S3 delete (L-PLATFORM) · #596 evidence gate (L-PLATFORM: rewrite to J01–J20) · #527 #570 #569 #567 #566 #563 #561 #559 #557 #555 #554 release, restore, APK and secret gates (L-PLATFORM: consolidate into one qualification suite) |
| **Salvage the named parts, then close** | #593 Masana directory (keep the directory, drop Contacts) · #545 persona provisioning (adapt to the 12 seed Masana) · #579 U06 teaching checkpoints → Rooms · #548 comment visibility filtering → Feed/Gwani · #530 #529 composer idempotent send → shared composer · #582 #543 replay SQL and consent patterns → Feed audio · #581 #536 #535 #577 copilot authority and HTTP authz patterns → agent tools · #549 live-session grant validation → calls · #571 cache isolation → account switch · #614 window-closure rules (folded into this file) |
| **Close without merge (excluded scope)** | #578 #575 human calls · #537 human DM notifications · #533 human media · #531 human DM search · #546 Twin economics · #538 Twin training |

Each closure gets a comment covering the reason, the salvaged commit SHAs and where they landed.
