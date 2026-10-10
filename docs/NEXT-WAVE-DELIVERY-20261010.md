# Outcome-first delivery correction — 2026-10-10

Owner direction: accelerate the agreed product, avoid duplicate/unnecessary work and indefinite handoff queues. This dispatch policy supersedes the old unrestricted “pick any narrow unfinished work” approach. Product/security requirements and exact-path protection remain.

## Observed failure and correction

At main `f381f077c485c04261459b77a42c215d3ce3a14b`, new PRs had largely delivered partial safeguards. Evidence tools #592/#594/#596/#603 and cleanup #595/#598/#599 overlap in purpose; partial contact/audio/auth/settings patches do not complete those lanes. Some tested changes were merged to different non-production integration branches, leaving main unchanged. These are dated observations; refresh exact PR heads before acting.

The allocation JSON is a design/ownership template, NOT a current task-completion registry. Its PLANNED_UNCLAIMED values cannot justify repeating existing work. Live CAS claims + PR files + immutable handoffs + actual executable results govern dispatch. A new PR/patch, branch merge or extra test does not exhaust a lane.

## Dispatch one complete customer milestone

Use one continuing AF00 root integrator, about four to six independent feature implementers and at most one independent qualification owner. IDs AF00–15 are responsibility boundaries, not a request to open sixteen windows or elect several root integrators. Use a unique window ID automatically if the supplied ID is already in use.

Select work in this order:
1. Finish/reconcile a substantive existing feature PR under its claimed ownership.
2. Implement a missing critical customer milestone from the table below.
3. Repair a demonstrated blocker to that milestone.
4. Only then undertake secondary hardening; it must be tied to an acceptance failure or necessary threat control.

No additional evidence validator, cleanup engine, permission abstraction or speculative security helper while a canonical equivalent exists. Preserve unique tests/controls and adapt the existing authority. AF13 selects one qualification runner from #592/#594/#596, carries forward missing SA/DB gates and #603 safeguards, and records the disposition of the alternatives. AF15 keeps one cleanup lifecycle; #599 contributes retention/negative cases to the elected repository/runner rather than a competing authority.

| Milestone | Lead / collaborators | Minimum connected source outcome |
| --- | --- | --- |
| Unified recovery/build baseline | AF00 + AF13 | Recover #497 and compatible partial PRs without dropping local changes; one pinned integration SHA, imports/routes/migrations resolved, actual combined source checks or exact blockers |
| MSN Wallet foundation | AF01 + AF03 | Adopt existing #576 authority; actual repository/API/client balance, fiat-to-MSN pending/confirmed/recovery states, send/conversion/receipt rules. No silent Cr rename or unbacked issuance |
| MSN P2P escrow | AF02 + AF01/08 | Offer/order/reserve/state/confirm/dispute plus Wallet UI on same ledger; role/concurrency tests; no screenshot-only release |
| Reliable private chat/audio/transfers | AF06 + AF05/07/11 | Recover one DM stack; record/preview/upload/send/readback/play, durable retry, typed New Chat, ledger-backed transfer cards and recovered call path |
| Published audio Talks | AF09 + AF05/15 | Database/repository/API/upload-processing/publication + feed/composer/library; actual post playback, follow/like/comment/save counts and denied/delete/retry states |
| Persistent audio Rooms | AF10 + AF06/15 | Group/member/role/invite persistence, authorized note history/upload/play and room UI; optional live calls separately qualified |
| Gwani purchases | AF04 + AF01 | Vertical menus and composer use one durable purchase draft, real catalog validation, quote/explicit consent/status/receipt |
| Phone/email and Settings | AF08 + AF14 | Requested auth selectors/numeric password/recovery semantics plus profile/preferences/lifecycle; preserve existing email/avatar/language and partial fixes |
| Masana publishing | AF12 + AF09/15 | Existing persona IDs, real generation adapter, durable schedule/budget/publish-once, review/follow and actual generated samples when provider is available |
| Storage/operations qualification | AF15 + AF13/domain leads | Existing object/repository/job composition, retention and access with actual DB/object/restart/restore checks where available; precise activation gaps |

These milestones are not all ready simultaneously. Split a large milestone into bounded connected increments, each with an actual server/repository/client path and named acceptance. A demo-only adapter, isolated interface or unavailable-state screen may be useful scaffolding, but is never customer milestone completion.

## Dependencies are contracts, not blanket waiting

AF00 need not finish the whole app before any other lane starts. A dependency blocks only the exact contract, path or test that requires it. Publish the smallest stable interface and pinned source baseline early; feature owners can implement durable domain repositories/APIs and owned UI against it while root hooks await integration. Test doubles are acceptable tests, not substituted production bindings.

Local source/APK absence blocks overwriting/reconciling those unseen changes and claiming preservation. It does not prevent independent source implementation on an isolated branch. Do not repeatedly ask for already known missing inputs or use them to stop all work.

Shared-file ownership is one current owner per exact path, not one person's monopoly over every integration action. Feature owners may request a bounded composition/export/migration/test transfer with exact change and affected tests; publish acceptance/readback in the registry before editing. If the integrator is unavailable, preserve source, implement independent work, and document reviewed reassignment through the existing stale recovery protocol. No silent seizure or blanket freeze.

## Toolchain and verification execution

Before dispatch, inspect checkout access and Dart/Flutter/Node/pnpm/PostgreSQL availability. Use permitted local toolchain/setup or available alternate execution; retain lockfiles and pinned compatibility. Do not incur paid services or bypass network/credential constraints.

If no actual required runner can be obtained, record one exact blocker with commands/version/error and route its test job to a capable continuing window/local runner. Continue implementable connected source and isolated executable checks. Do not repeatedly retry zero-step CI, rewrite code into simulations and call it repository tests, or substitute more verification scripts for implementation. Auth/money/privacy source without adequate checks remains unverified and is not forced through a merge.

Run relevant source/contract/negative tests at exact SHA. Do not demand production bank/device/restore proof for every safe non-deploying source merge. Real production/device/provider proof still gates activation. Test outcomes are NOT_RUN / BLOCKED / FAIL / PASS_SIMULATED / PASS_REAL.

## One integration queue and baseline

AF00 elects and publishes ONE continuing non-deploying integration branch after inspecting Git-hosted deployment filters/hooks, CI/migration triggers and existing branch heads. “integration” in a branch name alone is not proof it cannot deploy. Preserve existing branches and merge/cherry-pick only accounted-for unique tested source; no reset/force-push/deletion.

Do not create another per-patch integration branch without a specific conflict/isolation reason. Existing AF13/AF15/AF01 branches are inputs to consolidate. A bounded source reviewer/feature owner may perform an authorized safe merge on non-overlapping files; root code edits still require the exact owner. Do not wait for a new chat just to merge a ready PR.

For every held PR, record exact head, current dependency/conflicting paths/failing or unavailable commands/deployment hazard, named responsible window and next executable correction. “Waiting for AF00”, “CI failed” and “not production-ready” alone are inadequate blockers. A no-step CI result is not an executed test.

Completion levels: feature-source connected and tested; integrated unified SHA tested; device/provider qualified; released. Keep these separate. Main remains the eventual source of truth; a qualified reviewable integration baseline is not a released product.

## Continue and hand off without fragmenting

Keep one continuing branch/PR for a coherent milestone. A released short lease is not proof someone should redo the same scope. Finish the milestone's missing source, wire canonical adapters, resolve applicable source failures and reach a justified safe integration result. A micro-fix handoff must state which original milestone remains and transfer that continuation, rather than advertise the whole AF lane as completed.

If a real dependency/toolchain prevents completion, publish the source and precise handoff, then continue a dependency-independent part of the same milestone or an explicitly claimed next critical milestone. Do not invent new low-priority work merely to appear active.

Before local pull/rebuild, AF00 publishes exact unified source SHA, adopted/superseded PR dispositions, local-source reconciliation status, migrations/config requirements, executable build/analyzer/test results, remaining disabled/unqualified features and reproducible APK steps. Never say “all done” from a PR count.

## Owner's pre-pull completion boundary — 2026-10-10

Finish all implementable source and integration here before asking the owner to pull locally. Local execution is reserved for genuinely unavailable toolchains, devices, credentials or provider environments; it is not a destination for missing feature code, unwired routes, unallocated migrations or unresolved source conflicts. This is a source-completion boundary, not permission to claim unrun checks passed or activate unqualified financial/provider behavior.

Every continuing milestone PR must maintain a finite closure checklist derived from the agreed journeys:
- Required source item and exact paths; current implementation commit or explicit missing source.
- Named current implementation owner; dependency contract and bounded composition transfer if needed.
- Source state: MISSING / IN_PROGRESS / IMPLEMENTED_UNVERIFIED / SOURCE_CHECKED / INTEGRATED.
- Separate execution result and environment; integration target and exact integrated SHA.
- For a local-only check, the exact missing capability, attempted command/error, owner and reproducible next command. An unavailable test runner never makes missing implementation local-only.

At each handoff, identify which checklist items were closed and continue the highest-priority remaining implementable item. A released lease or finished small patch does not close the customer milestone. If the current session must end, explicitly transfer those remaining items in the existing PR; the next window resumes the checklist instead of opening an unrelated helper. Do not manufacture activity or repeat documentation/zero-step CI while core source is missing.

AF00 must publish the reviewed single integration target and a queue of exact-head composition tasks. Distinguish awaiting feature source, unresolved source conflict and unavailable execution; do not bundle them as “waiting for tests”. Implement imports, authenticated bindings, client routes, allocated migrations, worker registration and config validation under exact-path ownership while running all checks actually available. Delegate bounded composition through the registry when capacity blocks progress; never silently seize paths or merge known failing/unsafe source.

Before requesting the local pull, publish one pinned unified source SHA and the closure checklist: no required source item may remain MISSING/IN_PROGRESS or disconnected. List unavailable checks honestly and provide the local reconciliation/test/build commands. The owner's unseen local fixes still require preservation and reconciliation; do not claim them reconciled remotely. After local tests, repair any discovered defects before release. Remote source completion and real end-to-end qualification are separate claims.
