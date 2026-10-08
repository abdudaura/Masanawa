# Mandatory cross-window handoff and one-window final integration

## Revised final Work inventory after completeness audit (2026-10-08)

Work must reconcile **30 U product scopes, 18 existing-core F recovery scopes, all R01–R19/C01–C08, J01–J11/K01–K20 and all 79 unchecked historic task lines**, distinguishing future-gated ambitions from launch-blocking core. Read [master audit](UNFINISHED-SCOPE-RECONCILIATION-20261008.md), [Contacts acceptance](CONTACTS-AND-ADDRESS-BOOK-EXPERIENCE-20261008.md), [expanded owners](ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md), [28 prompts](ADDITIONAL-WINDOW-LAUNCH-PROMPTS-20261008.md), [79 legacy rows](LEGACY-150-TASK-RECONCILIATION-20261008.md). Preserve U01–U20 original ownership and C01 #468 existing contact code; elect C02/C05/C06 duplicate branches and #497 Firebase+router fixes; **do not reintroduce 13:44Z freeze from #497** over later owner override on main. Only actual runnable API/auth/DB/Flutter/phone/provider/CI, sign/backup/OTA evidence qualifies an R/C/K pass. If Work usage remains blocked, keep draft PRs and source handoffs; no false all-merged closure.


## Owner-approved U01–U20 expansion — 2026-10-08

The owner lifts blanket source-work freeze and authorizes twenty isolated U01–U20 development windows while Work usage resets. Later Work must inventory all new U draft PR heads/handoffs, compare them with existing R01–R19/C01–C08, preserve #497/Firebase #461, elect one U01 contract/task ledger/Gateway composition, resolve C02/C05 migration duplications, integrate Flutter root once, run K01–K12 + J01–J11 on real backend/device/provider, and merge only genuinely verified code. See [20-window plan](20-WINDOW-AI-CHAT-EXECUTION-20261008.md) and [merge/check matrix](20-WINDOW-INTEGRATION-AND-ACCEPTANCE-20261008.md). Old global freeze historical; exact-path owner and security rules still apply.


**Owner decision: 2026-10-08. Status: coordination instructions, NOT implementation or release proof.**

This file is the durable, common handoff contract for **every** R01–R19, C01–C08, documentation, CI, database, Android, and shared integration window in `Baatiku/masanawa`. Read it alongside `CONTINUE-HERE.md`, `docs/MULTI-WINDOW-WORK.md`, `docs/IMPLEMENTATION-KICKOFF-20261008.md`, and the domain contracts. **All windows must leave a repository-visible, SHA-specific handoff.** A chat response by itself is not a handoff.

**End-state:** after independent implementation windows have checkpointed their work, the repository owner can start **one designated ChatGPT Work integration window** to inventory, reconcile, complete remaining gaps, execute blocked tests, review, and merge only safe changes. This document does **not** start that Work session, reserve all lanes today, authorize merging unverified code, or replace the five-minute ownership rule.

## 1. Each window must publish its own handoff, no exceptions

**At the beginning:** inspect live `main`, existing claims, all competing open/draft PRs and their changed paths, migration sequence, and issue #457. Confirm a genuinely free lane and publish a five-minute repository-visible claim. If another window owns it, move to a non-overlapping lane or explicitly coordinate; don't duplicate code because another PR is draft or its CI is blocked.

**During work:** implement the complete owned source slice, including DB/migrations, API/service/auth, Android/Flutter, state/recovery, and tests wherever applicable. Do not repeatedly retry already established runner/device/provider/credential blockers. If implementation cannot be finished, still push all substantive work and state exactly what source is absent. **Blocked tests never justify skipping implementable owned code.**

**At every checkpoint and before ending or switching lanes:**

1. **Commit and push** the exact branch with substantive code/tests and update the lane's `docs/workstreams/<specific-lane-and-scope>.md` record **on that branch**. Never leave the only handoff in a chat, unpushed working tree, or ephemeral environment.
2. Put the **same summary in its PR body or a new PR comment**, linking the committed handoff path; keep unverified implementation PRs **draft/unmerged**. For work without a PR, create a reviewable draft PR if permitted, or link a repository issue/visible claim with its exact branch and SHA. Do not claim a PR exists unless it does.
3. The handoff must identify exactly what's implemented, what's still missing, commands actually run and real results, unexecuted checks, security/DB/financial implications, dependencies, merge conflicts/duplicate PRs, and concrete next actions (template below).
4. Ensure the checkpoint itself can be found by the final Work integrator: link its handoff from the PR, and provide issue #457 with evidence **only for shared CI/verification**; use the correct feature issue for feature coordination. Do not spam #457 with unrelated implementation summaries.
5. Recheck the last push SHA and ownership activity before another lane. An expired five-minute lease makes work carefully reclaimable, **not deletable**; reclaimers must inspect and preserve old branches, commits, handoffs, and PR comments.

**Required per-window handoff template** (fill every row; use `N/A — reason` where honestly inapplicable):

```markdown
# <Rxx/Cxx or cross-cutting lane> — <specific scope> handoff
Updated (UTC): <timestamp>; window/owner label: <label>
Status: PARTIAL_IMPLEMENTATION | IMPLEMENTED_UNVERIFIED | VERIFIED_E2E | DEPLOYED_VERIFIED
Claim/lease: <claim path, last repository-visible activity, exact owned paths>
Base main SHA: <sha>; branch: <branch>; pushed HEAD SHA: <sha>
PR(s)/issue(s): <URLs and draft/merge status>; requirement IDs / acceptance journeys: <IDs>
Ownership collisions / duplicate implementations: <PRs, disputed files, selected canonical contract or UNRESOLVED>
Changed source by layer: <migrations, DB, backend, API, auth/privacy, Flutter, voice/text/taps,
                          state, offline/recovery, tests, deployment/config; exact paths>
Implemented and integrated: <real flows and evidence, no mocks falsely called live>
Missing implementable source: <each gap with exact file/owner/action; NONE only if genuinely complete>
Verification executed: <command + environment + exit code + concrete output/log link + SHA>
Verification NOT executed: <command + precise reason + required environment/test users/device/creds>
Blockers: <first observed evidence, scope, safe workaround, responsible integration owner>
Data/security: <migration order, tenant/auth boundary, secrets, backup/restore,
                encryption, deletion, financial invariants, backward compatibility>
Cross-branch dependencies: <PR numbers/SHAs/order, shared files, contract mismatches>
Next exact actions for final Work integrator: <numbered actionable commands/files/checks>
Rollback/production risks: <migration, app/server rollout, provider or device limits>
Release gates: <SOURCE_WRITTEN, LOCAL_TESTED, CI_EXECUTED, DB_INTEGRATED,
                APP_INTEGRATED, DEVICE_VERIFIED, PROVIDER_QUALIFIED,
                DEPLOYED, MERGED; explicit yes/no/unverified for each>
```

**Status meanings (never blur these):**
- `PARTIAL_IMPLEMENTATION`: any required owned production code, contract, migration, UI, recovery, or test harness is still unwritten/disconnected. Saying "CI blocked" does not erase source gaps.
- `IMPLEMENTED_UNVERIFIED`: the **entire owned source slice** and applicable test code are present, with integration seams explicitly identified and no known implementable owner gap, but one or more executable end-to-end checks are pending; Work must verify this claim before advancing it.
- `VERIFIED_E2E`: run-time evidence establishes the full applicable Flutter → authenticated API → persistence/event/provider → authoritative readback → negative/restart path at exact tested SHAs. CI green on unrelated tests isn't sufficient.
- `DEPLOYED_VERIFIED`: production rollout at known SHA, scoped access/market/provider/device checks, monitoring, rollback readiness and real production evidence are recorded. **Only this or VERIFIED_E2E with all applicable release gates satisfied may contribute to a DONE gate**; no claim of feature DONE from draft code or documentation.

## 2. Final *single* ChatGPT Work window — required consolidation sequence

**Owner launches this only when ready.** The final integrator becomes the *coordinated* owner of shared merge/test/release work, not an automatic license to overwrite still-active claims. It must:

1. **Freeze and inventory a live snapshot.** Read `CONTINUE-HERE.md`, this runbook, `docs/MULTI-WINDOW-WORK.md`, the canonical R/C requirements and journey ledgers, `docs/workstreams/`, all open **and relevant closed** PRs (including drafts), comments, branches, changed paths, actual head/base SHAs, merged commits, schema migrations and issue #457. Recheck these rather than trusting dated tables. Create/update a **repository-visible integration matrix** on its own branch mapping *every* R01–R19/C01–C08/other active lane → handoff link, branch/PR, code coverage, tests, blockers, owning contributor, unresolved conflict, next action and evidence links. Missing handoff = unresolved work; request/recover it rather than infer DONE.
2. **De-duplicate and reconcile semantics before cherry-picking.** Compare source and tests from colliding PRs. Elect one authoritative implementation/contract per feature, deliberately migrate useful changes/tests from alternatives, record why, and preserve original PRs/SHAs as evidence. Do not blindly merge multiple duplicate migrations, human-DM endpoints, caches or divergent AI/finance authorities.
3. **Order dependencies.** Integrate canonical contact policy and identities, human DM schema/API, realtime/event/voice/cache, authorized financial operations, Assistant actions and finally **one** R17/C08 five-tab shell. Coordinate shared `app.ts`/`main.ts`, root Flutter routes, migration registries, `pubspec.lock`, auth/session revocations, typed IDs, ledger invariants, provider adapters and push. Do not force-push or rewrite applied migrations; allocate new names/migration-forward fixes after checking the actual target DB.
4. **Complete source gaps, not just CI.** Audit each handoff's missing implementable backend, API, Flutter, recovery, migrations, tests, and integration; finish those gaps on owned integration branches with reviewable commits. Preserve all correct work from other windows. A partial PR must never become implemented just by merging it.
5. **Recover CI and execute proof.** Use issue #457 and `docs/WORK-CI-RECOVERY-HANDOFF.md` for Actions quota/runner resolution. Independently run Gateway checks, real disposable Postgres migrations/rollback-and-restore, auth/tenant/security, Flutter dependency resolution/analyze/widget/integration tests, APK builds and Android/two-device flows; provider/hardware/secrets checks require the real qualified environment. Record exact commands, tested SHAs, logs and failed paths. Do not invent green checks or weaken workflow protections; keep `UNVERIFIED` for inaccessible evidence.
6. **Review and merge incrementally, only when truly safe.** Resolve base drift and conflicts, verify each integrated slice at the resulting merge SHA, require independent financial/deletion/private-data safety checks where relevant, and merge verified changes in dependency order. Re-run regressions and all applicable `J01–J11` and R/C acceptance after final shell integration. Leave unresolved PRs draft/unmerged with truthful, actionable blockers.
7. **Finish the repository-facing record.** Update the integration matrix and `CONTINUE-HERE.md` with exact merged/rejected/deferred PRs, verified deployment SHAs, unresolved blockers, remaining owners, live operational monitoring/rollback and actual release qualification. No single summary replaces per-PR evidence.

Suggested live inventory commands in the Work terminal (commands **not executed by this document**):

```bash
git fetch --all --prune
git rev-parse origin/main
gh pr list --state all --limit 200 --json number,title,state,isDraft,headRefName,headRefOid,baseRefName,updatedAt,url
gh issue view 457 --comments
# For each relevant PR: gh pr view <number> --json files,commits,comments,statusCheckRollup
# For each handoff: inspect its exact head-branch file; compare against current main.
```

## 3. Known collision alerts — examples, not a timeless inventory

At the 2026-10-08 documentation checkpoint, **C02 has competing draft PRs [#472](https://github.com/Baatiku/masanawa/pull/472) and [#475](https://github.com/Baatiku/masanawa/pull/475)** with incompatible human-messaging schema/API choices. **C05 has overlapping draft PRs [#474](https://github.com/Baatiku/masanawa/pull/474) and [#476](https://github.com/Baatiku/masanawa/pull/476)** implementing alternative protected mobile chat caches. These are **unresolved**: they must be reconciled into one consistent end-to-end design, not merged side-by-side. PR #476 explicitly records `PARTIAL_IMPLEMENTATION`; do not label it complete because substantial cache code exists. C01 draft [#468](https://github.com/Baatiku/masanawa/pull/468) and shared Gateway/avatar draft [#435](https://github.com/Baatiku/masanawa/pull/435) also require composition review; R17/C08 is the sole shell integrator. Shared CI issue [#457](https://github.com/Baatiku/masanawa/issues/457) and draft [#460](https://github.com/Baatiku/masanawa/pull/460) track blocked Actions verification. **Re-inspect actual status, SHAs, files and evidence on the day of integration.**

## 4. Ready-to-paste final Work instruction

> Continue `Baatiku/masanawa` in **one ChatGPT Work integration window** from fresh `main`. Read `CONTINUE-HERE.md`, `docs/FINAL-WINDOW-CONSOLIDATION-HANDOFF-20261008.md`, `docs/MULTI-WINDOW-WORK.md`, `docs/IMPLEMENTATION-KICKOFF-20261008.md`, the R01–R19/C01–C08 canonical contracts, all `docs/workstreams/` handoffs, and issue #457. Inventory every open/draft and relevant closed PR, exact SHAs, changed files, claims and validation evidence. Build a repository-visible per-lane integration matrix; do not silently drop another window's work. Reconcile competing implementations and migrations (especially C02 #472/#475 and C05 #474/#476); preserve unique correct work, close only after explicit disposition. Complete all missing implementation code, resolve shared backend/Flutter/auth/DB/contracts, recover CI, execute the real test, Android, provider and recovery gates, then merge only demonstrably verified PRs in dependency order. Keep blocked/unverified PRs draft and record exact commands, failures, risks and next owner; never claim DONE without executed end-to-end evidence. Publish a final SHA-specific consolidated handoff and update `CONTINUE-HERE.md`. Do not bypass the five-minute ownership protocol or touch production data without verified backup/restore safety.
