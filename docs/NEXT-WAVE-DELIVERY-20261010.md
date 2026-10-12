# Outcome-first delivery correction — 2026-10-10

Owner direction: accelerate the agreed product, avoid duplicate/unnecessary work and indefinite handoff queues. This dispatch policy supersedes the old unrestricted “pick any narrow unfinished work” approach. Product/security requirements and exact-path protection remain.

## Current owner override — 2026-10-11

Main is the default development integration target. Routine development CI/CD
from main merges is authorized. Do not hold scoped changes for release-only
proof, unrelated baseline failures, repeated approvals or an integration-only
queue. Run relevant checks, fix introduced failures and keep real tests,
auth/privacy and canonical financial safeguards. Use concise handoffs; whole-app
completion is not required for every source merge or local test handoff.
This overrides older dispatch/Factory/handoff merge restrictions.

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

Run relevant source/contract/negative tests at the implementation SHA. Do not demand production bank/device/restore proof for a development merge. Distinguish development CI/CD from real financial/provider activation and release qualification. Test outcomes are NOT_RUN / BLOCKED / FAIL / PASS_SIMULATED / PASS_REAL.

## Main integration and concise handoffs

Merge scoped compatible work into main after relevant checks and conflict review.
Preserve useful unique branch source; no reset, force-push or deletion. Alternate
integration branches are for a concrete conflict or explicit owner request, not a
mandatory staging queue. Main's routine development CI/CD is authorized.

For a held PR, record the exact head, concrete introduced failure/conflict or
required missing contract, owner and next action. Unrelated existing failures and
unavailable runners are reported precisely; do not claim them passed or disable
checks. Keep branch protection and financial/auth/data controls.

Continue useful implementable source. A concise handoff identifies implemented
behavior, source SHA, relevant test results and remaining work. No full-product
completion checklist or release qualification is required before a scoped merge
or local test handoff. Source, integrated code, device/provider qualification and
released product are separate evidence levels.

## Pending owner-reported chat speed and billing continuity — 2026-10-10

Required before source-first local handoff. These are open acceptance items, not implemented claims. The owner observed repeated billing questions, very slow agent responses, delivery ticks arriving only with the answer, absent agent reply references and slow-feeling screen opening. Audit observation at main `6bbb689fd65d977984be2487e6a6bd56aaf83001`: account-scoped JSON chat hydration/background sync and user-selected quote previews exist; `ai_chat_state.dart` checks connectivity before inserting text, marks delivery after awaiting the agent result and appends AI messages without a reply reference. `agent_billing_assistant.ts` handles complete directives/pending quotes but does not itself persist partially collected billing fields. `ai_chat_screen.dart` refreshes Wallet every 12 seconds. Exact runtime latency and full model context behavior are UNVERIFIED; inspect latest feature PRs before changing source.

Lead lanes below are responsibility assignments, NOT active window leases. A continuing window must claim exact paths, publish its actual identity/PR and mark each item MISSING / IN_PROGRESS / IMPLEMENTED_UNVERIFIED / SOURCE_CHECKED / INTEGRATED with separate execution evidence. Do not assume another window has taken the item merely because a lane is named.

| ID | Required connected behavior | Lead / composition | Acceptance |
| --- | --- | --- | --- |
| CHAT-P01 | Render cached account-scoped chats, Talks/feed and supporting screen data immediately; preserve tab/scroll state; refresh in background without blanking usable content. First visit has honest loading/empty/error/offline states; logout/account switch clears private projections. Bound hydration/history work and avoid blocking disk/JSON/media work on UI thread. | AF06 chat; AF09 Talks; AF14 supporting screens; AF00 shell | Warm/offline reopen shows cached content and retained position; fresh account never sees previous data; delayed network cannot block cached navigation. Profile release-mode warm/cold startup separately. |
| CHAT-P02 | Insert outgoing bubble immediately into a durable local outbox before connectivity checks; reconcile with canonical server message/request ID. Server acknowledges durable receipt independently of AI completion. Separate queued/sending/server-accepted/processing/completed/failed; human delivery/read and agent processing have accurate documented semantics. Never label durable server acceptance as human read. | AF06 transport/state; AF00 shared agent state/Gateway composition; AF13 checks | Delay AI generation deliberately: server acceptance still updates before answer. Offline queue, timeout after accepted write, restart and duplicate retry preserve one message/one operation. Disconnect/reconnect recovers truthful status without fake ticks or resubmission of purchases. |
| GWANI-P01 | One durable account/conversation/purchase draft merges validated service, provider, recipient, amount/package and stage across menus/text/voice. Ask only missing/ambiguous fields; correction updates the intended draft. Preserve across process/session/app restart, expiry/cancel/new-purchase transitions; do not rely on model memory or opt-in long-term personality memory for transaction continuity. | AF04; AF01 financial authority; AF00 API/client wiring | Supply fields over several turns and mixed input modes; no repeated known-field questions. Restart mid-draft then resume; two simultaneous purchases cannot cross-contaminate. Changed terms invalidate old consent; fresh explicit confirmation and canonical idempotency precede spend. MSN authority remains; legacy NGN helper text is not the new wallet contract. |
| CHAT-P03 | Canonical reply-to IDs for user and agent messages, persisted in server history and local cache; agent answers link to the actual initiating message. Compact sender/text-or-media quote with tap-to-original, accessible labels and deleted/unavailable fallback. IDs must reference an authorized message in the same conversation; do not invent provenance from text similarity. | AF06 contract/state; AF00 shared AI screen/Gateway; AF04 Gwani | Quotes survive restart/history reload and concurrent message completion; tap navigates to correct original; missing/deleted references stay understandable. Cross-account/conversation reference rejection and account-switch tests. |
| CHAT-P04 | Stream first text progressively and expose truthful thinking/tool status. Text visibility and server acknowledgment must not wait for audio synthesis/playback. Trace actual queue/session/auth/DB/model/catalog/provider/audio durations using request correlation and redacted metrics; remove unnecessary serial work from the critical path. | AF04 agent flow; AF05 audio; AF06 transport; AF00 composition; AF13 measurement | Slow audio provider cannot delay text or receipt; stalled model/provider has bounded timeout, cancel/retry and truthful status. Report p50/p95 by stage and first-text vs final-answer timings, separating cold/warm/offline/poor-network conditions. No guessed root cause or fabricated latency claim. |
| CHAT-P05 | Bounded lazy message/media rendering and paginated/delta history; targeted rebuilds and coalesced cache writes. Catalog freshness-aware caching with authoritative checkout revalidation. Replace or justify 12-second Wallet polling with lifecycle/action/event updates; no speculative model/provider prefetch or eager paid work. | AF06/AF04/AF03; AF00 composition | Long histories scroll smoothly; no repeated whole-history parsing/writes on each token/keystroke. Slow refresh leaves content usable. Concurrent replies/status sync deduplicate. Quotes, balances and expired catalogs remain truthful. |

Performance budgets are proposed engineering targets, not observed passes: warm cached chat visible within 200 ms; outgoing bubble visible within 100 ms; stable 60 Hz scrolling on supported device where feasible. Record p50/p95 and frame misses on the owner's target/representative low-end Android device in release/profile mode, with dataset, build SHA, OS, network and cache state. Cold-launch, server-acceptance and AI first-response budgets must be set from measured traces and deployment/provider constraints; do not promise zero loading or instant AI inference. Implement instrumentation/source here; reserve unavailable physical-device/provider execution for the precise local checklist.

Closure: implement all six items against existing authorities, compose them on the single baseline and execute available contract/unit/recovery checks. AF13 records unrun Flutter/device/provider tests with commands and execution owner. No APK handoff from placeholders, authored tests alone or isolated performance helpers. Existing unstarted essential items may be claimed: same-milestone source stays in its continuing PR; a different coherent milestone may use a feature PR, never a competing integrator/helper.
