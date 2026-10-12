# Masanawa UI audit: continuing-window queue

Owner requested 2026-10-12. **Status: workflow implemented; application milestones below are not certified complete.** This queue integrates the [audit/design](../superpowers/specs/2026-10-12-masanawa-ui-audit-design.md) and [implementation plan](../superpowers/plans/2026-10-12-masanawa-ui-refinement.md) into the existing AF window workflow. It adds no second ownership registry, integration branch or verification framework.

## Start and select

1. Fetch fresh origin/main and factory/claims. Read AGENTS.md, CONTINUE-HERE.md and this queue; read only the selected milestone's relevant source/contracts/handoff next.
2. If the owner named a milestone, continue it. Otherwise prefer a previously started, unclaimed milestone with a concrete remaining action; then choose the first dependency-ready, unclaimed milestone in the table. A lane name is responsibility, not a live lease. Inspect exact-path claims before selection and acquisition.
3. Reconcile actual main, existing PR heads, unique source and the milestone handoff. Reuse/recover useful code; do not assume PLANNED means no code exists. Do not rebuild a merged feature because an old handoff predates it.
4. A prerequisite is ready when its **specific required interface/source** is available and reviewed, not when the whole app is released. Independent domain source may continue before root wiring; report it partial until mounted. Signed phones, provider access or unrelated failures block only the affected check, not unrelated implementable work.
5. Claim one coherent milestone and exact paths in the existing factory/claims registry. Shared router/Gateway/exports/migrations remain AF00; narrow transfers must be visible. Do not add a new AF lane or seize another window's paths.
6. Implement, run relevant checks, review, commit, push and merge compatible source to main using current development policy. Preserve protection and auth/money/privacy. Do not create a docs-only planning loop where runnable implementation is authorized.

The owner has supplied the design requirements and asked to incorporate them into implementation windows. Execute within those requirements; do not reopen approval of the same design/plan in every window. Ask only about a genuinely new material product decision or an action lacking authorization.

## Milestones and responsibility

Initial queue state is **PLANNED** for each audit milestone: this means its acceptance has not yet been closed, not that its entire feature is missing. Exact source/verification status lives in the corresponding milestone handoff. The table is a stable index, not a concurrently rewritten completion ledger.

| ID / order | Deliverable | Existing lead / shared paths | Required interface | Acceptance / relevant plan tasks | Handoff path to create or continue |
| --- | --- | --- | --- | --- | --- |
| MUI-01 | Shared white main headers, readable green wordmark, neutral bottom nav and shared compact search field | AF00 presentation composition; coordinate theme/token parity if changed | Fresh current shell and preserved Calls source | White headers; balanced larger branding; charcoal default nav; black bold selected labels/bright-green selected icons; narrow/large-text layout. Tasks 1–2 | `docs/workstreams/UI-MUI-01-foundation.md` |
| MUI-02 | Center language selector on all supported auth/welcome routes | AF08, presentation-only; preserve authentication | Existing LanguagePickerButton; independent of MUI-01 | Every mounted route centered at mobile widths and RTL; icon accessibility and locale persistence retained. Task 2 | `docs/workstreams/UI-MUI-02-auth-language.md` |
| MUI-03 | Functional Chats search and correct Chats header | AF06; AF00 only for selected shell/route hooks | MUI-01 shared presentation; canonical authorized inbox interface | Contact/title/supported identifiers, dynamic filtering, clear/no-results/offline, stale query/account fences, pin/read/archive/open preserved. Task 3 | `docs/workstreams/UI-MUI-03-chats.md` |
| MUI-04 | Connected modern Status instead of legacy live-Talk UI | Existing Status/AF09 feed owner; AF00 mounting, media owner permissions | MUI-01; authorized existing feed/media interface | White header; compact real updates/timestamps; loading/empty/error; profile/media/detail/actions connected; no unsupported user publishing or invented viewed/expiry state. Task 5 | `docs/workstreams/UI-MUI-04-status.md` |
| MUI-05 | Complete call-history search with existing calls preserved | AF11; narrow history backend/UI allocation | MUI-01; existing account-authorized history reader | Dynamic real-history matches including later pages, clear/no-results, bounded query pagination; native/group/incoming/history/billing retained. Task 4 | `docs/workstreams/UI-MUI-05-calls-search.md` |
| MUI-06 | Connect persistent Rooms and fix misleading empty behavior | AF10; AF00 composition/migration allocation | MUI-01; existing Rooms membership/repository/route source | Discovery/joined/detail and supported join/lessons; unavailable ≠ empty; retry/account fencing; no fake rooms/Create; paid entitlement enforced. Task 6 | `docs/workstreams/UI-MUI-06-rooms.md` |
| MUI-07 | Refined main Wallet and supported financial journey | AF03 UI with AF01 canonical authority; AF00 root callbacks | MUI-01; truthfully typed wallet/capabilities/receipts | Compact actual balance/actions/history plus supported Send/funding wiring; financial unit reconciliation explicit; no Cr→MSN relabel or fiat cashout invention. Task 7 | `docs/workstreams/UI-MUI-07-wallet.md` |
| MUI-08 | Refined Crypto and consistent transaction sheets/receipts | AF03 with AF01; preserve capability/quote contracts | MUI-01 and shared wallet presentation from MUI-07; crypto source can proceed independently | Flat actual assets/balances/activity; supported Buy/Receive/Convert/Withdraw; no fabricated valuation; disclosure, authorization and uncertain-status recovery retained. Task 7 | `docs/workstreams/UI-MUI-08-crypto.md` |
| MUI-09 | Combined visual/functional regression closure on integrated source | AF13 with owners of demonstrated defects | MUI-01…08 integrated, or explicitly report each unresolved acceptance | Real mobile render at 320/360/390/430px, large text/RTL; searches/navigation/account switch/Rooms/wallet; relevant tests/analyze/typecheck/build; fix introduced regressions. Task 8 | `docs/workstreams/UI-MUI-09-verification.md` |
| MUI-10 | Verify installed signed app reflects the improved source | Existing release/device owner and AF11 call qualifier | MUI-09 integrated candidate, signing/distribution authority and required runners | Exact source→artifact→installed build identity; auth/search/Status/Rooms/wallet on phones; preserve ongoing incoming-call qualification. No source-only release claim. Task 8 + release policy | `docs/workstreams/UI-MUI-10-installed-app.md` |

If a handoff file does not exist, the first owning window creates it using the [handoff template](UI-WINDOW-HANDOFF-TEMPLATE-20261012.md). Do not precreate ten empty files or treat this index as ten implementation commits. A window may finish a small milestone and continue to the next dependency-ready milestone after releasing/reclaiming paths. It should stop only when its useful work is finished or an actual input is required.

## Branch recovery hazards to recheck

At the audit baseline main `682827b77`, integration/rebuild had connected Status/inbox source but a much smaller Calls screen. Keep main's newer Calls/native/group/incoming/billing source when reconciling shells. Rooms source exists in `lane/rooms-membership-invites-20261011`; integration had an unavailable gate rather than mounting it. Main's Rooms read the legacy `/talks` feed, whose transport treats 404 as empty. Main Wallet used legacy Credits/Cr DTOs and omitted optional funding/send callbacks at its root. Re-fetch before acting: other windows may have fixed these since the audit.

The existing Status/media continuation, Rooms handoffs and Calls qualification remain valid work inputs. Do not wholesale-merge historical ancestry, delete branches, revive Twins/human-to-human consumer calls, or supersede server permissions to make a screen appear populated.

## Evidence and closure

Each milestone handoff records separate fields:

- **Implementation:** PLANNED / PARTIAL_IMPLEMENTATION / IMPLEMENTED_UNVERIFIED / INTEGRATED. INTEGRATED requires a real merged main commit and reachable mounted source; it is not runtime qualification.
- **Verification:** NOT_RUN / BLOCKED / FAIL / PASS_SIMULATED / PASS_REAL for each named command/journey, with SHA and scope. Tests with doubles can prove widget behavior, not live financial/provider behavior.
- **Release:** NOT_RELEASED / RELEASE_CANDIDATE / DEPLOYED_VERIFIED, only with actual artifact/environment/device evidence for the claimed scope.
- **Acceptance:** list every assigned acceptance as open or closed with evidence. A milestone is closed only when its requested behavior and applicable source/visual checks pass on integrated source. External/device/provider checks remain open separately when unavailable; they do not reopen already-proved source work or vanish from the queue.

Do not use a single DONE label to conflate these dimensions. MUI-09 aggregates feature acceptance and MUI-10 aggregates installed-device/release acceptance. The UI audit is not fully fulfilled while any requested acceptance remains open.

## Parallel windows without collisions

After MUI-01's shared interface is committed, Chats, Calls, Rooms and wallet domain windows can work on disjoint claimed files. Auth centering is independent. Status and Rooms each request narrowly scheduled root composition; one current owner edits those paths at a time. Wallet and Crypto agree shared row/action interfaces before editing them. This is permission to use the owner's existing separate windows, not a requirement to launch subagents.

Keep this queue/index stable. Each lane writes only its own `UI-MUI-xx-*.md` handoff and feature source. There is no shared mutable status JSON or repeated edits to CONTINUE-HERE.md per milestone. If multiple PRs change the same handoff, preserve both histories and reconcile by fresh main/claim/acceptance evidence rather than last-writer-wins replacement.

## End every window with the next prompt

1. Update the milestone handoff with exact source/main SHAs, PR, changed paths, actual results, acceptance still open and concrete blockers/owners.
2. Publish the reviewed handoff alongside the source. Release exact-path ownership using existing registry rules.
3. Print a self-contained copyable prompt using the [next-window seed](UI-NEXT-WINDOW-PROMPT-20261012.md). Name the preferred next milestone and relevant handoff in that printed prompt; retain the queue link and fresh-main/claims selection instruction.
4. If blocked, specify the smallest missing contract/runner/authority and choose independent source work where available. Do not endlessly return the same blocked device/provider task or silently declare it complete.
5. When all source milestones close, the prompt must advance to MUI-09/MUI-10 or list exact remaining external checks. Do not keep selecting cosmetic extras after core acceptance is still open.

Calls/device qualification may run alongside this queue. Its prompt must retain incoming-call qualification and link this queue, with MUI-05 as independent Calls source work when appropriate. UI work does not cancel signed-call/provider verification; provider spending/production activation is separate from routine development integration.
