# Multi-window Work Coordination

## Cross-feature final UX review / target-navigation gate — 2026-10-08

Read `docs/END-TO-END-UX-ARCHITECTURE.md` before assigning **R17 or C01–C08** work on root tabs, person profiles, AI chats, `/chats` redirects, notification/deep links, service entry, and global Gwani/Gwana invocation. The complete **proposed** four-tab end-state and route/action matrix must be decided in one coordinated product/R17/C08 gate. In particular, don't rename Agents to Chats, reuse AI character `/chat/:id` for human DMs, or inherit the public Talk FAB on a future Chats tab without resolving the documented conflicts.

The review recommends **Home · Chats · Wallet · Assistant** but this is not an owner-approved replacement yet. Existing approved APP-SHELL-CONTRACT and owner CI #457 remain binding until the design decision is signed off; no code workstream gains ownership from publishing this docs proposal. Shared router, profile, assistant and wallet action integration belongs to one designated owner with nonoverlapping lane claims. **Build toward a frozen final flow, never a knowingly temporary UX followed by a second redesign.**


## Shared CI / ChatGPT Work owner handoff — 2026-10-08

**Repository-level coordination:** The owner will use **ChatGPT Work** to resolve
the shared GitHub Actions incident and qualify blocked PRs. This is not a claim
that a Work session is running. Read `docs/WORK-CI-RECOVERY-HANDOFF.md`
and [issue #457](https://github.com/Baatiku/masanawa/issues/457) for representative
zero-step Foundation CI/Mobile Build evidence, next actions and exact acceptance.
Development windows continue non-overlapping code and test implementation under
the normal 5-minute lease but avoid independent repository/org Actions runner,
billing, settings, permissions, secrets, workflow-bypass or release integration
changes. Report new evidence and let Work investigate/coordinate infrastructure;
never treat CI failure before execution as proof of failing or passing code.
No unverified implementation should merge merely because CI is unavailable.


## Additive communications implementation coordination — 2026-10-08

After the current core reading, **read `docs/COMMUNICATIONS-EXTENSION-PLAN.md`**, issues #462/#463, and preserve existing R01–R19. The extension adds separately claimable **C01–C08** (human contact privacy, durable DMs, realtime/push, voice notes, light/offline cache, internal crypto transfers, Gwani/Gwana cross-app operators, late navigation/regression). The C ledger does not supersede or restart R readiness work, and this documentation does not reserve all eight lanes.

Possible lane names are `communications-identity`, `communications-core`, `communications-realtime`, `communications-media`, `communications-mobile-performance`, `communications-internal-crypto`, `communications-ai-actions` and `communications-nav-release`. These are **ownership categories, not leases**. Each window must check live activity and exact PR file lists, publish a fresh claim with bounded paths on its own branch, and coordinate shared route, storage, notification, assistant and financial authority. Do not quietly seize R01–R19 paths, change public Talk semantics or substitute another wallet/agent runtime. New `docs/workstreams/<lane>.md` claims follow the same five-minute expiry as existing lanes.

The current shipped design remains **Home · Agents · Wallet · Talk**. Moving to **Home · Chats · Wallet · Talk** is explicitly conditional on C02–C05 quality and C08 usability tests, preserving Experts/Twins visibility, existing routes, header/FAB and everything in APP-SHELL-CONTRACT. No premature shell migration. Shared CI #457 ownership/recovery is unchanged.

## Current product coordination overlay — 2026-10-08

Consumer work must follow `CONTINUE-HERE.md`, `docs/PRODUCT-NORTH-STAR.md`,
`docs/TALKS-PRODUCT.md`, `docs/MOBILE-SCREEN-ARCHITECTURE.md` and
`docs/CONSUMER-SERVICES.md`, `docs/APP-SHELL-CONTRACT.md`,
`docs/MOBILE-READINESS-PLAN.md` and `docs/DEFAULT-AI-PERSONAS.md`.

Older Twin-first and Room-first product plans are no longer canonical. Preserve reusable
Twin/runtime/commerce implementation, but translate it into the current
Talk/Seat/Expert/Twin product rather than restoring deleted product direction.

Status: mandatory implementation coordination guidance.

## Read and recover before editing

1. Read CONTINUE-HERE.md, including newer checkpoints.
2. Read docs/PRODUCT-NORTH-STAR.md, docs/TALKS-PRODUCT.md and docs/CONSUMER-SERVICES.md.
3. Read the current screen/shell contracts, docs/MOBILE-READINESS-PLAN.md and
   docs/DEFAULT-AI-PERSONAS.md, then relevant handoffs. The readiness ledger's R01–R19
   supersedes older theme/NGN-only/no-event-context assumptions; it does not undo merged foundations.
4. Inspect current main HEAD, relevant active branches/PRs and CI.
5. Inspect docs/workstreams/ claims before selecting a workstream.
6. Resume partial work; never restart completed work or infer completion from a plan.

## Workstreams and ownership

| Key | Responsibility | Main boundaries |
| --- | --- | --- |
| talks-feed | Explore/Live vertical feeds, Talk cards, ranking, save/share/replay discovery | Talk feed/domain + mobile Home |
| talks-live | live Talk lifecycle, human Host/Speaker/Audience state, moderation and Presence | Talk live runtime + Gateway + mobile Talk |
| talks-ai-seats | Expert/Twin Seat admission, sponsor flow, Direct Twin and AI runtime dispatch | AI Seat/Persona/Presence boundaries |
| talks-social | comments, reactions, questions, polls, follow, gifts, activity and profiles | Talk social APIs + mobile social surfaces |
| talks-replay | recording, replay publication/playback, metadata and analytics | replay/egress/storage + mobile replay |
| commerce-core | AI Seat/gift settlement, funding, refunds, idempotency and creator earnings | packages/commerce, wallet/ledger storage |
| bills-flutterwave | private airtime/data/electricity/TV purchase flows | billing/provider adapters + private mobile flow |
| crypto-nowpayments | private deposit/buy/convert/withdraw eligibility and settlement | crypto/provider adapters + private mobile flow |
| channels | private WhatsApp/Telegram assistance, identity linking and receipts | channel adapters + Gateway routing |
| mobile-shell | Home · Agents · Wallet · Talk, global Gwani, auth and shared UX | apps/mobile shell and shared presentation |
| identity-privacy | account deletion, session/device/channel revocation, data lifecycle and external request path | canonical identity/security/storage + Settings, coordinated with integration |
| localization | shared UI resources, locale/RTL/formatting and dynamic multilingual acceptance | mobile presentation + server capability contracts |
| integration | composition, migrations, release evidence and production qualification | shared Gateway, migrations, deployment docs |

These are ownership categories, not separate runtime authorities or new numbered milestones.
Choose one workstream per window. Shared files (Gateway composition, package exports,
migrations registry, root configs, canonical docs) require coordinated integration.

`main` is the only source used for local pulls, APK builds and release qualification.
A work branch exists only while its lane is active; once the work is complete it must be
merged to `main`, and an unmerged stale branch must never be presented as required local code.

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
then docs/MULTI-WINDOW-WORK.md, docs/COMMUNICATIONS-EXTENSION-PLAN.md
and all referenced canonical launch/product guidance. Inspect
active workstream claims, branches/PRs and recent commits. Select and publish one
non-overlapping workstream claim, preserve existing features, and continue substantive
implementation on an isolated branch. Coordinate shared contracts and deployment;
record exact checks, remaining gaps and a recoverable handoff.

## Current readiness task coordination

Use R01–R19 from `MOBILE-READINESS-PLAN.md` and additive C01–C08 from
`COMMUNICATIONS-EXTENSION-PLAN.md` in claims and checkpoints; R01–R19 remain
the core mobile readiness ledger. Full profiles/context are in `DEFAULT-AI-PERSONAS.md`.
Documentation publication is not implementation ownership for all tasks. Claim bounded
paths, coordinate token/router/Gateway/ledger/event/migration changes, and record code,
build, deployment, provider and device evidence separately. Do not turn empty catalogs,
manual refresh or a worker registration into a DONE integration claim.
