# Multi-window Work Coordination

## Twin transformation overlay — 2026-10-05

For digital-twin transformation work, also read:
`docs/PRODUCT-TWIN-ECONOMY.md`,
`docs/TWIN-TRANSFORMATION-MASTER-PLAN.md`,
`docs/TWIN-TRANSFORMATION-TASKS.md`, and
`docs/TWIN-MULTI-WINDOW-EXECUTION.md`.

The TWIN lane map is an additional collision-prevention overlay. It does not replace
existing billing/crypto/channel ownership. New twin work must not steal paths from active
PRs. In particular, shared Gateway composition, mobile router/chat, Commerce model/
repository and migration numbering require explicit ownership before edits.

Status: mandatory implementation coordination guidance, 2026-10-04.

## Read and recover before editing

1. Read CONTINUE-HERE.md, including newer checkpoints.
2. Read docs/DIGITAL-COMMERCE-LAUNCH.md and docs/CREATOR-CLONE-ECONOMY.md.
3. Follow the handoff's canonical architecture/task read order.
4. Inspect current main HEAD, relevant active branches/PRs and CI.
5. Inspect docs/workstreams/ claims before selecting a workstream.
6. Resume partial work; never restart completed work or infer completion from a plan.

## Workstreams and ownership

| Key | Responsibility | Main boundaries |
| --- | --- | --- |
| commerce-core | reserves, funding, attribution, settlement, refunds, idempotency | packages/commerce, commerce storage |
| crypto-nowpayments | asset/network catalog, customer balances, deposit/convert/withdraw adapters | crypto/provider adapters and scoped contracts |
| bills-flutterwave | bill catalog, recipient validation, fulfillment/requery | billing/provider adapters |
| chat-actions | selectable cards, action protocol, app renderers, voice selection | message contracts and apps/mobile |
| channels | mandatory WhatsApp and Telegram ingress, identity linking, options and receipts | channel adapters and Gateway routing |
| skills-clones | Core teaching/provisioning, enrollment, certification, support/clone configuration | Skills/Agents/Identity boundaries |
| integration | composition, migrations, evidence, cross-stream contracts and guiding docs | shared integration points |

These are ownership categories, not separate runtime authorities or new numbered milestones.
Choose one workstream per window. Shared files (Gateway composition, package exports,
migrations registry, root configs, canonical docs) require coordinated integration.

## Claim protocol

Use an isolated branch/worktree per window; do not concurrently edit a shared checkout.
Before implementation, publish a claim file:
docs/workstreams/<workstream>.md
Include owner/window label, branch, base SHA, task references, exact owned paths,
shared-contract dependencies, current step, last update, implementation/verification/
deployment status and handoff evidence.

Claims must be visible in a coordination PR/main before competing windows begin work.
If ownership overlaps or is unclear, select a different independent workstream.

### Five-minute stale-claim lease

A workstream claim is an activity lease, not permanent ownership.

- The lease expires after **5 minutes without repository-visible work**.
- Repository-visible work means a new commit/push, PR update produced by new work,
  claim/handoff update, or other concrete repository evidence on the claimed branch.
- An open PR, draft PR, old branch, old claim file, CI run, blocked status, or unfinished
  checklist does **not** keep ownership alive by itself.
- Once the latest repository-visible activity is older than 5 minutes, the task is
  **STALE / RECLAIMABLE** and must not block another window.
- A new window reclaiming stale work must first inspect the stale branch/PR and preserve
  useful completed changes. It must publish a fresh claim with its own branch/base SHA
  before editing.
- Reclamation does not authorize force-pushing, deleting, or overwriting the stale branch.
  Existing commits remain recoverable history.
- If the stale task touches shared-sensitive paths, the new claimant must still perform a
  fresh conflict check immediately before each shared edit. The stale owner no longer has
  exclusivity, but newer repository work must always be preserved.
- If two windows both become active on the same task, the first fresh claim/push after the
  stale boundary wins the lease; the other window must move or explicitly coordinate.
- A blocked task does not reserve implementation ownership while inactive. External
  blockers should be recorded in the handoff, and safe unblocked sub-work may be reclaimed.
- Completed work waiting only for merge is not "active ownership"; another window may
  integrate/reconcile it if the original branch has been inactive for more than 5 minutes.

Therefore, **do not treat old open PRs or claims as active ownership**. Check the latest
repository activity timestamp. If it is more than 5 minutes old, the task is free to claim.

Claims are coordination records, not an automatic distributed lock.

Shared contract changes land first or are explicitly referenced by dependent branches.
Do not invent duplicate IDs, wallet systems, action protocols, transaction state machines,
Skill registries or channel-specific financial logic.

## Collision prevention

A claim must be confirmed visible before editing. Re-read the claim after publishing
and immediately before touching shared files. If another window owns any required path,
do not edit it: publish the dependency/request and work elsewhere until ownership is
explicitly transferred. Branch isolation does not authorize conflicting shared changes.
Never overwrite, revert, cherry-pick or merge another window's unfinished work without
explicit coordinated ownership. Before every commit inspect the diff: commit only owned
workstream changes; preserve all unrelated changes. If a collision is detected, stop
writes to the affected paths and reconcile before continuing.
These procedures reduce collisions; documentation alone cannot guarantee race-free writes.

## Safe integration

- Fetch current main before writing; preserve unrelated commits.
- Integrate through a reviewable branch/PR; do not overwrite main with an old tree.
- For connector file edits, freshly read the exact file and use its current blob SHA.
  On conflict reread and merge semantic changes; never force-replace with cached content.
- Treat committed work as recoverable; checkpoint incomplete work with clear tests/status.
- Migrations have unique names and ordered integration; never edit an applied migration.
- Use relevant checks and record exact commit/test evidence. CI failure before checkout
  does not establish application failure or success.
- Production deployment is owned by one designated integration window; coordinate
  service source branch, migration set and exact deploy commit before changing it.

## Completion/handoff

Update the claim and relevant handoff: changed paths, exact HEAD, checks run/results,
known gaps, next step and dependencies. Distinguish implemented, verified and deployed.
Release claims only with complete evidence or an explicit handoff.
Do not mark roadmap gates complete merely because development code or mock results exist.

## Session prompt

Continue Baatiku/masanawa from current repository state. Read CONTINUE-HERE.md first,
then docs/MULTI-WINDOW-WORK.md and its referenced launch/product guidance. Inspect
active workstream claims, branches/PRs and recent commits. Select and publish one
non-overlapping workstream claim, preserve existing features, and continue substantive
implementation on an isolated branch. Coordinate shared contracts and deployment;
record exact checks, remaining gaps and a recoverable handoff.
