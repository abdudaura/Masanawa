# Masanawa v1 — Source recovery, PR disposition, delivery and verification
Status: **OBSERVED INITIAL AUDIT + PROPOSED DELIVERY PLAN**, 2026-10-10.
Exact checked main: `7c443966be97e9092cbc1fb98562c75253434326`. Existing PR head SHAs can change after this snapshot. No claim that the runtime, tests or payment providers were exercised here.

## What we actually inspected
- GitHub root tree: ~2,074 git tree entries; consumer Flutter at `apps/mobile`, admin Flutter at `apps/admin_mobile`, Next.js web/ops shells, TypeScript gateway/worker, PostgreSQL and provider adapters, numerous Dart/Vitest/test entries. **Tree presence is not correctness evidence**.
- Current `apps/mobile/lib/src/router/app_router.dart` on main retains comments and redirects for the old four-tab shell; this disagrees with latest five-tab owner decision. Existing AF00 PR #600 is addressing it; preserve its unique source and tests.
- Root `package.json`: Node `>=24 <25`, pnpm `>=12 <13`, Vitest 5, TypeScript 7. Root `pnpm check` runs typecheck, tests, build. CI in `.github/workflows/foundation-ci.yml` requests PostgreSQL 18 via pgvector and Node24; configured jobs do not prove jobs actually ran.
- GitHub pull listing on 2026-10-10 returned 100 open entries on first page and 38 on second = **138 open PR entries**, including overlapping old families and drafts. Never infer 138 independent features or merge them indiscriminately.
- Factory claim branch currently maintains 46 `active` records in `.factory/leases.json` at inspection (some expired); its template/old entries are not proof that an actual owner is still coding. Claims require exact-path review and documented stale recovery, not silent takeover.
- `docs/WHOLE-APP-SOURCE-AUDIT-20261009.md` reviewed 49 baseline Flutter screen Dart files but explicitly reports runtime NOT_RUN and warns about unseen local APK changes.
- Owner-reported Windows/local fixes and compiled APK remain **UNSEEN/UNRECONCILED** in GitHub context; do not reset or overwrite.

## Reuse / repair / replace / retire evidence rubric
| Class | Criteria | Action |
|---|---|---|
| REUSE | accepted domain contract + executable tests + current behavior aligns + low maintenance burden | import into unified baseline and add missing integration/device tests |
| REPAIR | correct authority exists but screens/routes/error paths/worker wiring unfinished | continue existing PR, fix failing TypeScript/Dart/SQL/tests, integrate |
| REPLACE | demonstrably contradictory model, duplicate financial authority, unsupportable abstraction or provider incompatibility | introduce versioned replacement + data migration/reconcile; keep old until verified |
| ARCHIVE / RETIRE | explicitly superseded owner capability with obligations satisfied and old links migrated | hide by flag, archive design, remove only after no unresolved data, payments or references |
| HOLD | insufficient evidence (unseen local changes, financial eligibility, missing test runner) | do not claim complete, execute source-independent tasks, record blocker and owner |

**No broad delete/reclone/reset.** Snapshot and reconcile local working tree, remote PR unique files, applied migrations, secrets (by name not value), provider balances, APK signature and deployment hooks first.

## High-value open PR families (sampled, not exhaustive)
| Work | Seen PR examples | Disposition plan |
|---|---|---|
| Root integration/five-tab | #497, #600, #586 | AF00 elects one reviewed merge baseline; reconcile existing tab/route claims, no parallel root rewrite |
| MSN and commerce | #576, #590, #607, older #454 | AF01 adopts canonical ledger; compare exact migration effects and receipt/idempotency tests |
| Fan-to-Masana Chats/Calls | #529/#530, #593, #575/#578 | REMOVE human DM/call/contact-list UI and endpoints; reuse tested message outbox, reliable agent stream/audio recording and call transport scoped only to Masana; preserve historical data |
| Masana mixed-media Home | #609 and AF09 continuations | extend same audio authority for platform-only text/image/audio and comments, remove human creator composer, connect feed/profile/ACL/admin publishing; no duplicate feed |
| Media cleanup and infra | #599 and other AF15 work | one canonical sweeper; keep unique retention tests, single migration registry |
| Authentication/settings | #588, #597, #606/#604 | unify auth/session/notification safety; preserve source and app navigation |
| Tests/evidence scripts | #596, #614 and previous checker PRs | one acceptance framework with real executed suites; reject duplicate zero-step-green validators |
| Former Twins / creator economy / paid owner access | #538/#546 and related | REMOVE feature from product, stop new implementations, preserve historical balances/obligations, reconcile before route/schema retirement; ordinary Gwani/teaching may remain |

Open PR metadata alone cannot establish mergeability, source completeness, overlap or test pass. AF00/assigned reviewer must fetch exact per-file patch/head SHA, applied database migration status, CI run steps and actual latest claims before dispositions.

## Dependency-order delivery: complete vertical slices, not isolated helpers
**M0 — Preservation & accepted blueprint, including owner removal of personal Twins, consumer publishing, repeated badges and legacy public stages, plus root Talks->Home replacement.** Record local APK and dirty source SHA, deployment links/triggers, DB/object backup and applied migration checksums; approve product DEC-01..15 and control-level UX. Acceptance: no unexplained/overwritten local changes; clear reusable/repair/retire map.

**M1 — Unified reliable core.** Merge compatible original fixes onto one safe integration SHA. Deliver auth/session, five-tab navigation, directory, reliable text/outbox, locally recorded/playable voice notes and account-fenced cached data on real Android. Acceptance: J-01..04 end-to-end, correct conversation routing, no duplicate/out-of-order messages.

**M2 — Masana-only multimedia Home, directory and global expert Rooms.** Remove fan public-post and human-to-human communication from all source entry points. Extend AF09 platform-authorized text/image/audio/video-typed posts; AF10 builds staff-created professional Rooms with Masana default owner, announcements/Questions, agent reply even for lone member, free/paid entitlements; AF06/AF05 preserve agent-only message/call transport. Acceptance J-03/04/06/07/15 plus HOME/RM security negatives and two-device readback.

**M3 — Gwani tasks and purchases.** Server-owned draft, fast ACK, gradual options, memory of fields, fresh quote, explicit financial approval, provider result and receipt. Acceptance: J-05 menu+voice+text produce same operation, cancel/edit invalidates quote, no double purchases.

**M4 — Wallet foundations and controlled activation.** Reconcile legacy Cr/fiat/crypto without silent rename; settle MSN denomination/backing/liquidity/fees; implement deposits/internal sends/conversion, receipts, reconciliation. Separate risk/legal/provider approval gate before real-money enable. Acceptance: J-08/J-09, DB/ledger invariant proof and provider qualification. Money-enabled UI is feature-flagged until gates pass.

**M5 — redesigned Android admin, subscriptions, moderation and missions.** Native admin platform operations studio, character editor, portrait/voice, per-agent week/timezone plans, durable content worker, 12 profession Rooms and teacher-response workers, free/paid subscription pricing/renewal/entitlement, Gwani case queue, moderation and fan-specific memory. Qualified providers/P2P/channels remain separate. Human contacts/chats/calls, consumer post/Room creation, Twins, paid seats/gifts and old stages excluded. Acceptance J-10..12 and HOME-06..10 with worker restart/replay, cross-user memory isolation, costs and denied publishing.

**M6 — Operations, qualification and release.** Android admin mission scheduling, media editorial review and memory inspector plus support/finance/monitoring, cost caps, moderation and incident response; qualify chat/calls, cross-platform media, signed APK, providers, low-end devices, DB+object+memory backup restore and rollback. Acceptance J-13/J-14 and HOME-01..10, security/accessibility and real evidence; staged audience release.

These are **dependency gates**, not promises of delivery dates, and do not allow source omissions to be called local-only.

## Exact-path ownership strategy
- One continuing AF00 integrator for root app routing, shared Gateway exports, worker registration, schema migration registry, deployment and versioned deep links. Delegate bounded compositional changes only by an explicit reviewed transfer.
- AF08 owns authentication; AF01 owns canonical financial ledger/executors; AF05 native recording/audio; AF06 Chats/agent conversations; AF09 Home/Posts; AF10 global Rooms/subscriptions; AF12 Masana publishing; AF13 independently verifies; AF14 accounts/settings; AF15 storage, queues, recovery. Others use exact existing per-feature allocations, not assumed free lanes.
- Four to six genuine independent implementers is more realistic than opening sixteen windows. Each workstream has paths, owner, branch, base/head SHA, acceptance ID, live claim, tests and bounded handoff.
- Use the existing `factory/claims` protocol, 5-minute claims and branch protection. Review expired claims; no silent override. No new helper branch if a related substantive PR already exists.
- **Merge-first:** finished, code-reviewed, genuinely tested and non-conflicting feature source goes promptly into one audited non-deploying integration target. Production activation separate. If tests actually fail, fix them; if CI has zero steps, report BLOCKED and use an eligible alternate runner, not PASS.
- Final system owner signs a single pinned unified SHA and APK provenance; source closure means no disconnected required UI/API/migrations, not that production/provider/device tests passed.

## Confirmed retirement sequence
1. Cease implementing new Twin/clone/commission/owner-access and legacy public stage features on all related draft branches; place the changed owner scope in the canonical implementation instructions after reviewed merge.
2. Route inventory: replace `/my-twin`, `/clone`, `/twin/:id`, `/owner-session/:...` with explicit unavailable/retired destinations without leaking private historical objects; strip entry buttons and menus. Rename `TwinHomeShell` only as a controlled compatibility refactor, because the shell itself is still essential.
3. Reject new retired-feature operations server-side; retain read-only historical reconciliation for orders, settlements, disputes and receipts. No accidental unqualified endpoints or orphan callbacks.
4. Remove dependent imports, state, tests and unfinished PR source after accounting for unique, still-required capabilities and successful TypeScript/Flutter/PostgreSQL suites on the same SHA.
5. Archive applied migrations; use forward-only audited deprecation later, never delete migration files or drop ledger tables simply to clean filenames.
6. Re-run complete auth, Gwani moderation, Masana-only chat/calls, Rooms, Home, Wallet and app-shell end-to-end journeys on target device/provider. Mark actual results.

See [legacy scope cleanup](LEGACY-SCOPE-CLEANUP.md) for the source and PR inventory.

## Recovery inventory to capture before any destructive operation
1. **Local Windows source**: current git branch/status, untracked and staged changes, all diff patches, generated source, relevant independent commits, lockfiles, signing configuration names, Android build output SHA256 and file provenance. Do not demand raw signing keys.
2. **GitHub PRs**: exact head/base, changed files, overlapping behavior, unique tests, relevant comment/handoff, triage disposition and next action.
3. **Database/ledger**: current deployed/backup schema, applied migration IDs/checksums, live obligations and secret-free service endpoints; isolated upgrade/restore before new financial migrations.
4. **Deployments**: GitHub Actions, Railway Git auto-deploy hooks, predeploy/migration-on-start, worker/background jobs, fixed-egress relay, DNS and rollback owner. Never infer 'integration' in branch name means safe.
5. **Media/objects**: key/version mapping, private and public ACLs, deletion and retention jobs, paired DB + actual readable audio restore.
6. **Providers**: accessible Flutterwave/NOWPayments/Gemini/Telegram/WhatsApp capabilities/region/limits/approved integrations, webhook keys present (not value), reconciliation and test paths.

## Executable checks at every exact commit
**Node/TypeScript:** from repository root on supported Node24/pnpm12, `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build`; relevant contract/security/provider tests. Do not substitute prettier or static doc checks.

**PostgreSQL:** run repository migration/PG integration suites on clean disposable PG18 and populated upgrade fixtures; simulate duplicate callbacks, rollback/restart, conflicting wallets, escrow races, delayed queue and outside-owner access. Do not run destructive migration tests against real money data.

**Flutter:** `cd apps/mobile && flutter pub get && flutter analyze && flutter test`; `cd ../admin_mobile && flutter pub get && flutter analyze && flutter test` where suites exist; build signed/unsigned qualification APK according to existing `apps/mobile/scripts/build_production_apk.ps1` and release policy rather than inventing a certificate or reporting a debug APK as production.

**Android physical tests:** cold/warm launch, Tecno-class device, low RAM, airplane mode, flaky mobile internet, denied microphone, Bluetooth/speaker focus, foreground/background, logout/account switch, deep link, upgrades. Record device, OS, environment, app SHA/APK hash.

**Provider/real money:** a safe staging/qualified merchant account with strict financial limits; verify real non-destructive test or a permitted live micro-transaction only with explicit owner authorization, idempotent settlement, server-side webhook verification, refunds and restore. No irreversible payout or uncontrolled deployment.

**Evidence record** `{acceptanceId, sourceSHA, appHash, environment, testCommand/steps, expected, observed, result:[NOT_RUN|FAIL|PASS_SIMULATED|PASS_REAL|BLOCKED], redactedLogRef, owner, blocker}`. Unit mocked tests are PASS_SIMULATED where appropriate; UI compilation alone is not PASS_REAL.

## Explicit stop rules
- Until M0 design review: no new blanket frontend rewrite, no arbitrary replacement of existing financial/identity/media modules.
- Until source integration tests pass: no claim that PRs or isolated guards close product milestones.
- Until external proof: no claim that Wallet, provider channels, Live Audio, published audio, Android APK or admin work end to end.
- Until payment/recovery/regulatory eligibility: financial capabilities remain gated; existing obligations continue to reconcile safely even when new orders are disabled.
- Every blocked workstream has a concrete owner, exact SHA and executable next step. No 'waiting for another window' with no handoff.

## Factory improvement candidate (do not edit Factory without tests)
Lesson: **baseline-first recovery + a single bounded owner-approved product decision register** should become an explicit Software Factory pre-rewrite gate; current Factory v0.4.4 provides existing-product recovery, but Masanawa demonstrates the cost of evolving navigation/monetization while many branches concurrently implement outdated assumptions. Submit a separate Factory PR with a regression fixture and changelog only after this blueprint review.

## Owner-change source reconciliation: Home creator lock (2026-10-10)
See [Masana-only creator network](MASANA-CREATOR-NETWORK-20261010.md) and [fictional cast](MASANA-STARTER-CAST-20261010.json). This supersedes any earlier AF09/user-authored `AudioPostComposerScreen` as a **member** route: only admin/worker may create server-validated public post with `publisherCharacterId`. Legacy `/talk/create`, member My Talks, member creator following pages and older public Live Talks stage are retired or mapped to Home/post detail as appropriate. Keep the AF09 audio processing/object/pagination/follow/comment tests where reusable; expand schema/API for text/image source and agent publishing ACL, always future compatible migrations. AF00 controls root center Talks->Home alias and available profile/chat/call route composition; AF09 owns Home post domain, AF12 mission worker, AF15 memory/recovery, AF06 direct conversations, AF05 voice/calls and AF13 actual integrated test evidence. Do not create a second world/memory scheduling backend. Existing related PRs have pending source and local APK that must be reconciled before merges. Runtime changes **NOT DONE by this blueprint**.

## Critical source retirement: no human-to-human chat/call or member-created Room (new owner decision)
This is a source-level removal requirement, not a UI hide: find all routes, client buttons, deep links, REST/socket handlers, recipient schemas, contact synchronization, call signaling, push and test fixtures that assume two human participants. Disallow new human recipient writes and fan Room creation server-side; preserve any historically stored messages and pending obligations under retention policy. Reuse outgoing composer, attachment and voice pipeline only for fan-to-Masana, and WebRTC/media infrastructure only for fan-to-Masana calls. AF00 owns router and privileged composition, AF06/AF05 own agent communications, AF10 Rooms, AF12 content/mission, AF01 subscriptions/ledger, AF14 admin UX, AF13 acceptance; coordinate actual claims. Rename legacy files deliberately inside one feature-first directory, no destructive bulk move. Source implementation must also add room teacher durable answer, fan-out large community pagination, store-compliant free/paid entitlements, versioned prices and Gwani moderation queue before claiming product complete. Reference [canonical architecture](MASANA-ROOMS-ADMIN-ARCHITECTURE-20261010.md).
