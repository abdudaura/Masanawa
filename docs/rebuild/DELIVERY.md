# Masanawa — Delivery plan, lanes, gates and merge discipline 1.1
**This file is the only execution plan.** It replaces the earlier M0–M7 list, the manifest `todoOrder`, and all AF/U/F/C/RECOVERY numbering in active work. Old IDs survive only in the PR disposition table (§7). Planning is not implementation. Nothing is "done" without the evidence in §6.

Baseline at planning: `main = 7c443966be97e9092cbc1fb98562c75253434326`. Refresh before coding.

## 1. Principles
1. **One vertical milestone per window.** A milestone ships the Flutter UI, admin screens, contracts, API, migrations, worker, authorization and tests for its journeys together. An isolated fix is not a milestone.
2. **Freeze before build.** Excluded features are denied server-side in R0, before any new feature work, so they stop accumulating data and PR churn.
3. **Lanes own paths, not themes.** Each lane owns exact directories (§3). Shared files belong to the integrator (AF00). This removes the main source of duplicate and conflicting work.
4. **Reuse first.** Before writing new code, a lane checks the reuse map (SOURCE-CLEANUP §3) and open PRs (§7) for its domain.
5. **Integrate continuously** into `integration/rebuild` (non-deploying). Promote to `main` only at gates, after reviewing the Railway deploy.

## 2. Milestone graph
```text
R0 Baseline & freeze ──▶ R1 Platform foundation ──┬─▶ L-SHELL ─┬─▶ L-CHAT ──────────────┐
   (AF00, single)          (AF00 + L-PLATFORM)     │           ├─▶ L-FEED ──▶ L-MISSIONS ├─▶ R-CLEAN ─▶ R-RELEASE
                                                   ├─▶ L-MASANA (seed, studio) ──┘        │
                                                   ├─▶ L-VIDEO                            │
                                                   ├─▶ L-ROOMS (free ▶ paid)              │
                                                   ├─▶ L-GWANI                            │
                                                   ├─▶ L-FIN                              │
                                                   └─▶ L-ADMIN (shell, RBAC, ops) ────────┘
```
After R1, up to **six disjoint lanes run in parallel**. L-SOCIAL and the finance escrow milestone extend the dependency graph under their named owners; they are never assigned before R0/R1 authorization foundations. L-SHELL must land the shell and design tokens before other lanes merge UI into the router. Until it does, those lanes build screens behind their feature directory and run widget tests. L-MISSIONS starts once L-FEED's post model has merged.

### R0 — Baseline & freeze (AF00 alone; blocks everything)
- [ ] Refresh `main`, the open PRs (§7), `factory/claims`, CI state (Actions quota, PR #460) and local Windows dirty source. Record the APK hash and signer of the last built APK.
- [ ] Inspect Railway: the Git source branch, the start command, whether `migrate.ts` runs on boot, the PG version and the applied `masanawa_schema_migrations` rows (owner, name, sha256). Verify the backup, then **restore into a disposable staging DB** and record the result.
- [ ] Create `integration/rebuild` from `main`. Its CI runs typecheck, Vitest, the PG18 fresh+upgrade migration check, Flutter analyze/test for both apps and an APK build. Zero-step or skipped is **not** pass.
- [ ] **Freeze:** a server-side feature-flag gate returns `410 feature_retired` for Twin/clone, human DM/contacts/calls, Talk stage/seats/gifts/polls, member Room or post creation, owner access and **unauthorized legacy customer WhatsApp/Telegram bridging** (D3). Preserve verified Masana social identity public links and only legitimately authorized connectors; no personal-WhatsApp automation API is presumed. This covers REST, WS and job enqueue. Read-only access to the user's own historical receipts stays.
- [ ] Apply the PR disposition (§7): close the excluded PRs with a salvage note, and rebase or re-target the keepers onto `integration/rebuild`.
- [ ] Merge this blueprint PR (#615) after confirming that a docs-only merge to `main` triggers no unsafe deploy.
- [ ] File the provider applications: TikTok Display API, Meta Page permissions, Play Console subscriptions (D1, D9).

**Gate R0:** restore proven, CI green or failures listed with owners, freeze tests J10 (partial) pass, PRs dispositioned, blueprint on `main`.

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

**Gate R1:** fresh and upgrade migrations pass on the restored snapshot, J10 complete, J19 skeleton passes, and lanes can start.

### Lanes (each = one or more windows; scope = the screens and journeys listed)
| Lane | Screens | Journeys | Key work | Depends |
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

**Lane gate:** every journey for the lane passes with recorded evidence (§6). The lane's legacy family is retired (SOURCE-CLEANUP §2), or a precise blocker and owner are recorded. Admin screens for the lane are included, so no separate admin backlog is left behind.

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
- Before merge, the head SHA passes CI, the lane's journeys pass, migrations pass the checksum, fresh and upgrade checks, and a security review has covered the §5 checklist. AF00 merges with a squash or merge commit and re-runs CI on the integrated SHA.
- Rebase daily on `integration/rebuild`. Conflicts in append-only files are resolved by keeping both lines.
- `integration/rebuild` → `main` happens only at R0, R1, the lane gates and release. Each promotion requires reviewing the Railway auto-deploy, a backup and a migration dry-run on the restored snapshot.

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
- Record every check as `{sourceSHA, command, environment, result: PASS|FAIL|NOT_RUN|BLOCKED, summary, logRef, owner}`. Mocked or simulated provider tests are labelled separately from real provider or device tests.

**Known CI state at planning:** Foundation CI run 38056564479 on #615 failed typecheck at `packages/agents/src/talk-replay.test.ts(6,8) TS2459`. Vitest and build were SKIPPED. #460 (shared CI recovery and Actions quota) carries the fix and is owned by AF00 in R0. Do not duplicate it.

## 7. Open PR disposition (from titles and branches on 2026-10-10; verify the touched paths before acting)
| Action | PRs |
|---|---|
| **Keep → retarget to `integration/rebuild`** | #460 CI recovery (R0) · #613 factory/claims · #600 five-tab nav and #552 five-tab guard (L-SHELL: update to the new tab set) · #586 deep-link authority · #597 neutral launch · #588 auth revocation · #547 contrast guards (re-token to blue) · #542 l10n integrity · #574 bidi · #565 profile text guard · #539 onboarding low-end (L-SHELL) · #612 Gwani text-before-audio · #534 Gwani voice continuity · #580 durable task journal (L-GWANI/L-FIN) · #602 #591 #589 PCM/live voice recovery (L-CHAT calls) · #587 local chat clear (L-CHAT) · #609 published-audio posts (L-FEED) · #606 #604 notification state and activity recovery (L-SHELL) · #607 #590 ledger and billing settlement (L-FIN) · #576 MSN crypto wallet (L-FIN, flag-gated) · #599 orphan cleanup and S3 delete (L-PLATFORM) · #596 evidence gate (L-PLATFORM: rewrite to J01–J20) · #527 #570 #569 #567 #566 #563 #561 #559 #557 #555 #554 release, restore, APK and secret gates (L-PLATFORM: consolidate into one qualification suite) |
| **Salvage the named parts, then close** | #593 Masana directory (keep the directory, drop Contacts) · #545 persona provisioning (adapt to the 12 seed Masana) · #579 U06 teaching checkpoints → Rooms · #548 comment visibility filtering → Feed/Gwani · #530 #529 composer idempotent send → shared composer · #582 #543 replay SQL and consent patterns → Feed audio · #581 #536 #535 #577 copilot authority and HTTP authz patterns → agent tools · #549 live-session grant validation → calls · #571 cache isolation → account switch · #614 window-closure rules (folded into this file) |
| **Close without merge (excluded scope)** | #578 #575 human calls · #537 human DM notifications · #533 human media · #531 human DM search · #546 Twin economics · #538 Twin training |

Each closure gets a comment covering the reason, the salvaged commit SHAs and where they landed.
