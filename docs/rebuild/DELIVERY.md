# Masanawa — Rebuild delivery, ownership, test and integration gates
**The next window executes this plan; plans alone are not implemented work.** Baseline at planning date `main=7c443966be97e9092cbc1fb98562c75253434326`, refresh before coding. The existing blueprint PR #615 contains the reset; PR and open-branch metadata require latest inspection before merge. Source, deployed DB, signed APK and open PR work must not be lost.

## Operating rules
- **Preserve old app as donor, but not old focus.** Old guiding files/archives are deleted in the new baseline. Code and applied database migrations stay until a feature-first replacement passes tests and data reconciliation. No parallel greenfield source repository, premature monorepo-wide rename or bulk deletion.
- **Exactly one integration baseline** and one AF00 owner for router/composition/migration registry/deploy triggers; independent feature paths require 5-min renewable exact-path claims through `factory/claims` and explicit transfers. A stale claim isn't unowned source until checked/reconciled.
- **Prefer continuing existing substantive PRs.** New blueprint changes supersede old feature requirements: salvage generic transport, auth, memory, storage, safe finance, reliable composer, admin skeleton and audio; **do not merge old human-to-human chat/call, Twins, user-published Talks, paid owner access, live stages or green-theme UX**. Record unique useful code per PR then close obsolete PRs after verified cherry-pick, not by title.
- Each window finishes one **end-to-end vertical milestone** with screens, contracts, API, DB/migrations, workers/retry, auth/security and tests together; fix relevant TypeScript/Vitest/Postgres/Flutter/Android failures and run real checks before merging. An isolated fix cannot be reported as milestone completion.

## M0 — Source recovery / clean baseline / migration inventory (FIRST, not optional)
[ ] Refresh repository main and existing open PRs, live claim ownership and latest run results.
[ ] Copy/describe local Windows dirty/staged/untracked source and previously built APK signature/hash; reconcile unique user fixes before replacing overlapping source.
[ ] Check Railway Git deploy triggers/startup migration hooks, existing database PG version/schema/history and object media storage, secret names (never secret values), backups; exercise staging restore first.
[ ] Map old code modules to `REUSE | REPAIR | REPLACE | REMOVE` with exact owners and PR head SHAs. Explicitly reject obsolete product operations server-side; historical data retained.
[ ] Merge the new canonical guidance after verifying docs-only change does not trigger unsafe deployment or violate branch checks. Mark deleted guidance paths absent in resulting tree.
[ ] Establish **one non-deploying integration branch** and CI baseline; run available TypeScript, Vitest, PG18, Flutter and Android checks. Failed tests repaired/recorded; skipped/zero-step never PASS.
**Gate M0:** no local loss, no stale guide as authority, migration/deploy risk known, runnable tests and owner map established.

## M1 — Canonical core and migration foundations
[ ] Version schema/API for character IDs, fan accounts, role ACL, posts, Room membership/question/teacher replies, subscription plans/entitlements, agent-only messages/calls, original media, external video metadata, missions/fan memory/Gwani cases.
[ ] Reuse authenticated PG18 adapter and migration registry, ledger and durable worker. Implement server denies for fan-created posts/Rooms/human chat or calls/clone actions at route and socket layers; remove obsolete UI routes and imports only after compatibility checks.
[ ] Test fresh/upgrade PG migrations and historical balance invariants, role spoof, ID collisions, duplicate webhook/jobs, restart and restored database.
**Gate M1:** one DB/service authority and both Flutter apps can use versioned published contracts.

## M2 — Consumer shell, profiles and reliable Masana communication
[ ] Implement clean 5-tab Flutter shell, blue semantic design tokens, light/dark, low-end Android, Hausa/English, typed nested navigation.
[ ] Agent directory, 12-character display and full profile, follow/chat/call/Room buttons; no phonebook or human discovery.
[ ] Fix chat composer Send/Mic/Stop separation, immediate local outbox, queue while streaming, debounced draft saves, voice note, media focus; only fan-to-Masana messages.
[ ] Real supported Masana calls (not fake dialing) via qualified audio session and provider; test microphone/reconnect/unauthorized peer.
**Gate M2:** J01-J04/J10 with Flutter UI+backend+device, no ghost human recipient.

## M3 — Home Feed, external Videos, seeded agent media
[ ] Extend existing published audio authority into platform-only original **text/image/audio** posts. Admin/worker publisher ACL, media artwork, character canon, follow/comment/react/save/readback and moderation.
[ ] Home `Feed | Videos` with For You/Following feed state and one shared media focus.
[ ] Admin video source CRUD and official YouTube WebSub + playlist reconciliation, safe Postgres metadata, review/moderation and official iframe within Flutter. TikTok account-authorized approval and Facebook Page capability are separately gated; manual permitted embed fallback if eligible, never false auto-sync.
[ ] Deterministic **staging seed runner** for 12 Masana + 12 profession Rooms + 24 full original post fixtures, 12 Room intros, 12 QA demo questions; generate/license/attach real portrait/banner/cover/audio assets, check actual accessible URLs, no invented views/metrics. Sample JSON remains NOT_LIVE until actual DB insertion and media verification.
**Gate M3:** real Android scroll/play/search/agent profiles; genuine YouTube channel import→embeddable clip works, duplicate/deleted/region-blocked event negative tests.

## M4 — Global Masana-led Rooms and subscriptions
[ ] Staff-admin professional Room CRUD and topic search; owner agent authoritative, global membership paginated, lesson announcements + threaded question/discussion.
[ ] Teacher durable queued answers for one member and high volume; stable ID/retry, curriculum/memory retrieval, bounded spend, anti-spam, notifications and graceful failure.
[ ] Room Free/Paid plans, per-currency price version, eligible Google Play Billing/payment rail, provider confirmation → entitlement, cancel/restore/price increase notice and moderation. Missing checkout eligibility blocks **paid activation**, not free Room teaching.
**Gate M4:** real one-member lesson works; unauthorized content/expired paid access denied; meaningful simulated+permitted real provider tests.

## M5 — Rebuilt Android admin, missions, memory and Gwani moderation
[ ] New phone-first Admin sections for agent identities/skills/photos/voice, original Post Studio, video channels, missions/calendar, Rooms/prices/renewals, fans/memory, moderation, finance and operations.
[ ] Weekly goals/creative pivot/scheduling with durable queue, preview/review/publish once, per-agent/global budget/stop, cost and quality scorecard.
[ ] Fan-specific long-term memory evidence/consent/erase, character canon, session and story continuity, no cross-fan leakage.
[ ] Gwani case investigation spam/block/unblock/appeal with scoped reversible rules, human review for serious actions and audit.
**Gate M5:** admin RBAC, mission persistence/recovery, memory cross-user negative tests, case appeal and role-restricted action verification.

## M6 — Wallet/Bills/Crypto/ops qualification
[ ] Keep ONE canonical MSN/crypto/fiat/billing execution; direct dedicated Bills/Crypto screens without auto Chats redirect and Gwani as alternative same task.
[ ] Current provider eligibility, quote/consent/confirmed receipt/uncertain transaction state, reconciliation and safe disabled feature flags.
[ ] Deploy/load/backup/media restore and operational alerts, Android admin incident response and rollback.
**Gate M6:** eligible financial provider tests with approved limits and zero double debit; no P2P/paid/crypto capability declared live without legal/provider approval.

## M7 — Integrated release
[ ] Pin integrated source SHA, CI actual executed job steps and complete Flutter and backend tests; PG18 clean upgrade and exact operating production-safe migration.
[ ] Build consumer+admin qualified APK, report hash/signature, real low-end Tecno-class device app smoke, voice/media, Home video embeds, free/paid Room, first-answer from lone fan, admin schedule, billing/cases/account switching.
[ ] Restore full DB+media and rehearse rollback/upgrade, inspect Git-triggered Railway deploy, valid secrets, DNS, provider webhook keys, quotas, alerting, moderation queue.
[ ] Stage deployment only when tests, provider permissions, billing compliance and owner-approved real financial operations are qualified. Claim `DEPLOYED_VERIFIED` only with real execution evidence.
**Gate M7:** launch acceptance signed with exact SHA, real API/device/DB/operator proof; no skipped CI as PASS.

## Actual test commands and evidence
**Root** on required Node 24 / pnpm12: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build`; inspect `package.json` and use scoped package scripts where necessary. PG18 clean+populated upgrade, queue/ledger/security/room subscription integration. **Flutter:** `cd apps/mobile && flutter pub get && flutter analyze && flutter test`, repeat `apps/admin_mobile`; perform Android Gradle/Flutter APK build with existing safe script/real device toolchain. GitHub Actions can run jobs, but review actual steps; 0 steps ≠ test pass. All commands against a pinned source SHA; don't deploy on partial PR merely to test a declaration.

Record each check as `{sourceSHA, command, environment, result PASS|FAIL|NOT_RUN|BLOCKED, summary, logRef, owner}`. Source tests mocked/simulated vs genuine provider/device separately. Fix source errors fully and rerun before merge when possible. If runner unavailable, assign exact local/CI execution owner with command and do all implementable source; no false completion.

## PR and merge discipline
1. Audit current source/PR heads, conflicts, claim, unique working fixes. 2. Continue one feature PR or small noncompeting feature branch; do not duplicate AF00 root or provider authoritites. 3. Review exact head tests, security/data migration, main deploy triggers. 4. Merge compatible qualified work quickly into one **non-deploying shared integration baseline** (and main when safe). 5. Verify integrated tests and migration/Android on merged SHA. 6. Preserve recovery of any blocked work with precise next owner/action; never silently leave incomplete UI/API/migration/tests behind.

Only user-approved scope changes enter this blueprint; do not copy history into active docs as 'future ideas' just to keep them. Old plans are deleted; Git retains history for normal source provenance.
