# Multi-window coordination

Updated 2026-10-09. Use [AF allocation](AUDIO-FIRST-WINDOW-PLAN-20261009.md), not the superseded 20/48-window launch sets. The archived rules are historical; no blanket development freeze or mandatory indefinite draft backlog is active.

## Delivery priority

[Outcome-first dispatch](NEXT-WAVE-DELIVERY-20261010.md) and [replacement prompt](REUSABLE-IMPLEMENTATION-PROMPT.md) supersede unrestricted micro-fix selection. One continuing root integrator and one reviewed safe integration queue; feature owners can receive published bounded composition transfers. No new per-patch integration branches or duplicate helper authorities without a demonstrated need. Every waiting PR needs head/blocker/owner/next executable action. Partial source milestones must continue instead of resetting to another easy guard.

## Before edits

Read CONTINUE-HERE.md and current contracts. Inspect fresh main, working tree, relevant open/draft PR head SHAs and touched files. Check docs/workstreams/ claims and any later repository CAS registry. Preserve local and remote work; use an isolated checkout/worktree and one assigned lane per window.

Publish docs/workstreams/AFxx-<scope>-20261009.md containing owner/window, UTC claim time, last concrete work, branch, base SHA, exact owned paths, contract versions/dependencies, next action, and source/test/deployment state. Make the claim visible through a PR/shared coordination record and read it back before editing. Allocation is not an active lease.

## Five-minute lease

The existing repository rule remains: five minutes without concrete repository-visible work makes ownership reclaimable. An open draft/old branch alone does not renew it. Check actual commits/PR updates, preserve useful unique source and publish a visible transfer/recovery record before reclaiming. Never delete, overwrite or force-push stale source. If a CAS registry is adopted later, follow its reviewed stale-transfer mechanism; expiry alone does not bypass registry conflicts.

Renew with meaningful work or a precise checkpoint within five minutes; no empty heartbeat commits. Recheck immediately before shared edits. Conflicts require explicit coordination; choose other independent work meanwhile.

## Exact-path authority

AF00 exclusively owns root router/shell, shared localization catalogs, package exports/config, Gateway/worker/ops composition, migration manifests and deployment wiring. AF01 owns canonical financial authority; AF08 owns authentication; AF05 owns allocated native audio. Other lanes build isolated modules and give AF00 narrow composition instructions. Whole-directory claims do not override more specific existing owners; list exclusions. Tests have explicit paths too.

Contract changes land before dependents or use a pinned reviewed contract commit. Do not create duplicate identity, ledger, task, room/media authority. Migration SQL proposals remain under owned modules until AF00 allocates unique append-only migrations.

## Integration and completion

Finish substantive connected source and applicable tests. Promptly integrate dependency-ready compatible code after exact-head executable build/unit/contract/negative checks, security/conflict review and a safe merge target. Real provider/device qualification is the production gate, not a universal veto on non-deploying code integration.

Audit every automatic deploy trigger before main merges; use a non-deploying integration branch if source integration would change production. Do not bypass known failures or settings protection. If CI starts no steps, run equivalent checks locally/elsewhere when possible and distinguish unavailable checks from failures.

A handoff records base/head, PR, changed paths, requirement/journey IDs, source remaining, real vs simulated tests, exact commands/results, migration/recovery notes, merge target, blockers and next action. Source missing or disconnected = PARTIAL_IMPLEMENTATION. Full source with blocked qualification = IMPLEMENTED_UNVERIFIED. VERIFIED_E2E/DEPLOYED_VERIFIED require real executed evidence. Release/transfer claim after handoff. Do not park compatible tested work indefinitely.

## Required work-to-merge protocol — 2026-10-10

**Repository:** `abdudaura/masanawa`. Its GitHub Actions runners now execute real steps. The prior account's zero-step quota gate does not justify parking all tests. Check current run status first; quote exact run/job URL, commit SHA and step outcomes. Use Node 24/pnpm 12, Flutter stable and isolated PostgreSQL 18 as applicable, not assumptions based on a successful install.

A workstream owns the **whole milestone**, not a single file or PR. Before coding list *all* required customer behaviors and corresponding server/data/client/recovery/negative-test paths. A source increment is permitted to shorten integration latency but never closes the acceptance row until connected source, runnable checks and shared composition are actually verified. Tests authored but skipped are OPEN. Keep the milestone's finite checklist actively maintained in the SAME PR.

At each meaningful implementation checkpoint:
1. Check that your latest branch includes other adopted upstream changes; obtain fresh exact-path ownership, no silent stale-claim takeover.
2. Run the fastest targeted unit/contract/negative checks, then all affected typecheck/analyze/test/build/migration checks. Read the **logs**, not just a red/green badge; distinguish runner failure, source failure and skipped checks.
3. **Repair every actionable failed check in the owned scope and rerun it.** A failure in another domain must be assigned to a named existing owner with offending file/line, relevant PR, required correction and a CI rerun command; actively track the dependency until cleared. No second helper PR for a one-line fix already covered by a continuing PR.
4. Confirm a single safe source integration branch and its pinned SHA from AF00; check path overlap and automatic Git-connected production deployments including Railway/Vercel/worker migration hooks. Request **bounded exact-path transfer** to AF00 for protected routing, auth, worker registration, migrations, exports or deployment changes; confirm actual integrated readback and rerun impacted checks.
5. **Merge as soon as eligible** after exact-head executable checks and security/conflict review. Source merge may be to the reviewed non-deploying baseline even when physical Android/provider proof is outstanding. If main has an automatic production hook, do NOT silently merge to main; approve/review a reversible deploy gate first, otherwise retain the non-deploying baseline. Avoid competing integration branches or long-lived ready-to-merge drafts.
6. After integration, rerun combined checks at the **merged SHA**; report distinct statuses for source, integrated, device/provider and released. Continue to the next uncovered acceptance row instead of declaring the window complete after one patch.

**Cross-window verification queue (#457 / AF13 and feature owners):** inventory ALL open PRs plus pending/failed/skipped CI and Android builds; use dependency order and batch equivalent validations by one integrated SHA to conserve minutes. Minimum applicable commands: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test:ci`, `pnpm build`, isolated PostgreSQL migration/security tests; `cd apps/mobile && flutter pub get && flutter analyze && flutter test && flutter build apk --release`. Run the owner-approved provider/tool tests without live charges. If a command fails, save its exact log and fix/retest rather than skipping downstream checks indefinitely. Re-run only after changed code/relevant environment, not each heartbeat.

**End-of-window completion receipt** must state acceptance rows CLOSED/OPEN, modified paths, PR head/base SHA, exact executed checks and pass/fail/skipped, named unowned source gaps, integration target/merged SHA, deployment hazard and next actual owner/action. If source is still missing, mark PARTIAL_IMPLEMENTATION. Neither an expired five-minute lease nor a handoff absolves the original milestone; explicitly transfer responsibility while preserving its existing PR.

