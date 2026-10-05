# Continue Here

## Cached conversation first-start checkpoint — 2026-10-05

Preserve this mobile startup behavior:
- resolve the application-documents directory once per AiChatController lifetime;
- hydrate the current User's account-scoped chat cache before starting
  Connectivity platform monitoring;
- retired global chat-cache cleanup must stay best-effort and off the critical
  current-account hydration path;
- local chat caches remain scoped by canonical User ID; server history remains
  canonical and may reconcile after the cached shell is already visible.

## Fresh-install session restore checkpoint — 2026-10-05

Preserve the auth startup optimization:
- current `auth_session_v2` restores with one secure-storage key read;
- if that record is absent, legacy compatibility uses one bulk `readAll()` call rather
  than four additional secure-storage reads;
- a fresh signed-out install therefore performs two session-discovery platform calls instead
  of up to five;
- valid legacy sessions still migrate asynchronously to `auth_session_v2`;
- this is storage-call optimization only; auth/token semantics are unchanged.
- PR #170 merged this optimization at `24ce71124a08bd32da51793817b05405454ed69a`.

## Mobile first-frame deferral checkpoint — 2026-10-05

Preserve this startup rule:
- push/Firebase/native initial-link initialization is noncritical startup work and begins
  immediately after Flutter's first frame;
- the deep-link stream subscription is installed before that deferral so initial links are
  still queued/delivered through the existing PendingDeepLink path;
- do not move notification setup, token registration or Firebase initialization back into
  pre-first-frame startup unless a measured correctness requirement demands it.
- PR #168 merged this deferral at `93df1c6bcd29446eb5204ae09e7b5e0685e20486`.

## Mobile directory fast-start checkpoint — 2026-10-05

Preserve this startup behavior:
- signed-in users may render the last authorized AgentDirectory presentation immediately from
  an account-scoped local cache while the live Gateway directory refreshes;
- cache ownership is keyed by canonical User ID, never by access token;
- access-token rotation must not blank/restart the directory UI;
- another account must never see the previous account's cached roster;
- transient network failure may preserve cached presentation, but 401/403 clears it;
- cached presentation never grants Character/Skill/Tool/financial authority and the server
  remains canonical for every admission and consequential operation;
- do not solve startup speed by hard-coding Gwani, Gwana or any Character in the APK.
- Cached agents are immediately actionable while the live directory refreshes; only a true empty/no-cache state should show a blocking loading message.
- PR #166 merged the cache-first presentation polish at `c878f23ce3f77c68dcfb1f76ecc44561f4702d96`.

Implementation paths:
`apps/mobile/lib/src/agents/agent_directory_cache.dart`,
`apps/mobile/lib/src/state/agent_directory_state.dart`.

PR #164 merged this checkpoint at `e46dc62de6599d0ea5010855dc03a3aa1df285e9`.
Hosted GitHub jobs again failed before any step was allocated; do not interpret those runs as application test failures or passes.

## Mobile startup + agent harness checkpoint — 2026-10-05

This checkpoint is mandatory for all new Masanawa implementation windows.

Read `docs/AGENT-HARNESS.md` before changing Agent execution, Tasks/WorkflowRuns,
mobile progress UX, subagents/subworkers, channel resumability or long-running work.

Implemented and merged into `work/billing-main-integration-20261005`:
- Android/Flutter launch no longer enforces the old 1.2-second minimum Flutter splash delay;
- returning-user auth restore prefers one encrypted `auth_session_v2` record instead of
  four sequential secure-storage reads;
- legacy four-key sessions are read in parallel and migrated asynchronously;
- logout clears both new and legacy auth records;
- provider-neutral `AgentHarness` contract added under `packages/agents/src/harness.ts`;
- user-visible **Work** is a projection of existing Task/WorkflowRun identities, never
  a new work database or parallel authority;
- progress phases must represent real state transitions, not simulated "thinking";
- internal subworkers remain bounded child AgentRuns and are not new user-facing agents.

Preserve these architectural rules:
- Character/CharacterVersion = agent identity/version;
- Relationship + CharacterSession = user/agent continuity;
- AgentRun = one execution attempt;
- Task = durable user-visible work;
- WorkflowRun = multi-step orchestration/checkpoints;
- existing SkillVersion, Tool/domain, Security, Commerce, approval and channel authorities
  remain canonical and must not be bypassed by the harness;
- Android, WhatsApp and Telegram should reconnect to the same durable work identity;
- clients should render useful local UI first and hydrate directory/wallet/billing/
  notifications/network-dependent data afterward.

Current integration checkpoint after PR #143:
`da527038304080ede9bb247e4735b0779738730f`.

Do not reintroduce a timed Flutter splash, serial four-key session restore, a second
work/task store, or user-visible "research/billing/document subagents" in place of the
single Gwani/Gwana/twin relationship.



### Durable Work projection — merged 2026-10-05

PR #151 merged at `dca4fc5ec9b071dc91969a6ff37827697fa09434`.

Implemented:
- admitted text/media/media-set turns now cross the `AgentHarness` boundary through the
  strategy compatibility adapter;
- harness progress callbacks project to durable `work.updated` shell events;
- mobile chat creates a stable Work recovery card when a progress event arrives without
  an existing assistant narration and updates it in place by `referenceId`;
- TaskId is preferred for Work identity, then WorkflowRunId, then AgentRunId;
- Work status labels are concise and user-facing;
- Gateway and mobile regression coverage was added for progress projection and replay.

Critical boundary: this is **projection + execution seam**, not complete durable workflow
execution. `packages/workflows` is still a placeholder; canonical Task/Workflow IDs exist,
but Task lifecycle, WorkflowRun checkpoints, restart/resume persistence and HITL checkpoint
storage are not yet implemented. No window may claim service-restart-safe Work until that
canonical runtime and PostgreSQL persistence are implemented and verified.

Next dependency: implement `@masanawa/workflows` canonical Task/WorkflowRun lifecycle and
repository boundary, then durable PostgreSQL checkpoints and resume/revalidation.


### Canonical Task/WorkflowRun runtime — merged 2026-10-05

PR #153 merged at `dd356256029918607f11e60f3bda6be885738e4f`.

Implemented:
- `@masanawa/workflows` is now a real package rather than an empty placeholder;
- strict Task lifecycle: queued, running, waiting_approval, waiting_external,
  completed, failed, cancelled;
- strict WorkflowRun lifecycle with terminal-state protection;
- Workflow checkpoints carry graph signature, committed state, executor state, edge state,
  pending approvals and monotonic checkpoint revision;
- checkpoint state accepts bounded plain JSON only;
- scoped present-authority access guards exist for Task and WorkflowRun operations;
- repository ports exist for create/read/list/transition and checkpoint append/read;
- focused lifecycle/checkpoint tests are checked in.

Critical remaining boundary:
this is the canonical domain/repository contract, not yet PostgreSQL persistence.
Do not claim Work survives Gateway/service restart until Task/WorkflowRun/checkpoint
storage, restore compatibility and resumed authority revalidation are implemented
and verified.

Next workstream: PostgreSQL Workflows persistence and recovery semantics.


### PostgreSQL durable Work persistence — merged 2026-10-05

PR #154 merged at `39268d36ec6a4b3949c9023dac215a3cce508a74`.

Implemented:
- dedicated `workflows` PostgreSQL migration owner/schema;
- Task, WorkflowRun and immutable WorkflowCheckpoint persistence;
- optimistic revision conflict protection and terminal-state guards;
- legal transitions enforced in domain code and database triggers;
- checkpoint append is atomic with WorkflowRun checkpoint revision and exact replay-safe;
- current policy/revocation is revalidated transaction-locally on repository operations;
- platform product migration/readiness includes the Workflows migration owner;
- frozen pnpm lock includes `@masanawa/workflows`;
- recovery tests cover fresh repository instances reading persisted Work, stale revisions,
  terminal restart rejection, checkpoint replay/conflict and stale policy rejection.

Authority rule: a relationship-scoped authority may access that relationship's Work when
`taskIds`/`workflowRunIds` are omitted; present ID lists narrow scope. Do not revert this
to "missing list denies all."

Critical remaining boundary:
Work state now survives service/process restart, but execution does not yet automatically resume.
Do not claim autonomous restart-safe execution until graph signature compatibility, checkpoint
restore, executor progression, approval pause/resume and immediate current-authority revalidation
before resumed consequential mutation are implemented.

Next workstream: canonical Workflow executor/resume semantics and harness composition.

## Core teaching and ownership checkpoint — 2026-10-04

Teaching is required Core: detailed adaptive lessons across topics, worked examples,
exercises/selectable answers, voice/text and private durable learner progress in app,
WhatsApp and Telegram. Read `docs/SKILL-DESIGN.md` for acceptance requirements.
Paid course/exam Offers remain proposals. Do not claim teaching implementation complete.
Before editing, read `docs/MULTI-WINDOW-WORK.md`, inspect current main/branches/PRs and
visible workstream claims, then publish and verify a non-overlapping ownership claim.
Never edit another window's owned paths or commit unrelated changes; coordinate shared
contracts, migrations and deployment. If ownership is unclear, choose independent work.


## Mandatory multi-window and economy checkpoint — 2026-10-04

Read `docs/MULTI-WINDOW-WORK.md` before choosing implementation ownership.
Use isolated branches/worktrees and visible non-overlapping workstream claims;
coordinate shared contracts, migrations and deployment. Preserve newer checkpoints.
WhatsApp AND Telegram are required customer channels alongside the app.
Customers should hold, convert and withdraw scoped crypto balances through NOWPayments
in chat, subject to verified provider operation/account/network eligibility.
Creators fund agent execution Float and earn from verified transactions; keep customer
assets, creator capital and commissions separate. Read the funded-execution section in
`docs/CREATOR-CLONE-ECONOMY.md` for unresolved policy decisions.
Broader admin/device/world/studio/plugin features are later implementation, not deletion.
Existing implementation is preserved; exact acceptance/deployment evidence remains required.


## Monetisation and Skills continuation — 2026-10-04

Recovered from main after the fulfillment-completion persistence checkpoint.
Preserve the digital-commerce launch direction below; Business Plan remains alpha
scaffolding rather than an approved launch paid product.

Implemented:
- canonical settlement is derived inside Commerce from the persisted quote and
  admission; completeFulfillment accepts receipt evidence only, never caller-defined
  settlement transfers;
- admission requires exactly the customer payment and applicable creator Float
  reservation, with validated amounts, accounts, creator/origin, quote and fulfillment
  linkage; omitted, duplicated or redirected payment batches fail before writing;
- completion restores creator-funded reserved Float to its original Float account,
  posts the agreed commission to pending earnings, and posts the agreed platform margin;
  fallback preserves originating creator attribution and does not reimburse unreserved Float;
- zero-value reserve/commission movements are omitted;
- receipts and settlement remain atomic and duplicate success replays cannot pay twice;
- creator/support/SkillGuide service factories preserve strict port contextual typing;
- Ops catalog listing no longer references an undefined authority/assignment. The
  configured-Character check belongs to Skill assignment. Ops HTTP projections copy
  readonly domain arrays into transport arrays without changing domain immutability.

Verification:
- all TypeScript workspace typechecks pass;
- Gateway and Ops dependency builds pass;
- package/service/adapter regressions and package/adapter architecture checks:
  266 passed, 57 skipped (the default PostgreSQL-backed cases require a test DB);
- seven new persistence acceptance cases passed in a local PostgreSQL 18.3 PGlite
  SQL-engine harness, including duplicate replay, insufficient-Float rollback,
  injected mid-settlement rollback, fallback economics and immutable history.
  PGlite serializes connections: this is not separate-session PostgreSQL concurrency
  qualification. The checked-in tests use pg + MASANAWA_TEST_DATABASE_URL for that gate.

Still required:
- explicit per-job reserve custody and actual-cost/unused-reserve accounting;
- durable paid-work dispatch, verified delivery-to-receipt binding, failure/cancel/
  refund/uncertain-outcome recovery and current executor capacity/authority;
- persistent financial-command request identities, including Float allocation;
- production SkillGuide/resource rehearsals; development bootstrap fixtures are not
  production certification;
- launch data/crypto provider qualification, selectable chat purchase state, and
  physical APK/chat/Gemini Live verification.
This slice does not close Tasks 072, 133 or 134 or claim live purchases/provider deployment.


## Digital commerce direction — 2026-10-04

Read `docs/DIGITAL-COMMERCE-LAUNCH.md` before selecting further product work.
Required families: data bundles and crypto buy/sell. Selected providers: Flutterwave
for billing, NOWPayments for crypto. Exclude Ethereum-mainnet ERC-20 routes; dynamically
filter exact supported asset/network/operation by low-fee and account eligibility.
Keep crypto selection compact through voice/text search or requested lists.
Selectable chat actions share authenticated server-owned transaction state.
The launch overlay records required audit corrections and proposed broader deferrals;
these are not all implemented, and proposed deferrals await the user decision.
Do not claim NOWPayments merchant fiat settlement proves customer NGN payouts.
Preserve current logo/theme and the exclusion of voice transcription.


## Masanawa Agent Blue brand checkpoint — 2026-10-04

The user approved the blue agent/conversation logo generated in ChatGPT and
explicitly chose it as the Masanawa identity. Preserve the artwork exactly:
a vivid cobalt-to-cyan rounded-square mark with a white conversation bubble
wrapped by a fluid blue/cyan agent ribbon. Do not replace it with a gold M,
lettermark, map pin, location motif, or the retired UNigeria symbol.

Canonical visual identity:
- approved cobalt-to-cyan conversation/agent mark;
- Android launcher source of truth: `apps/mobile/android/app/src/main/res/drawable/masanawa_launcher.xml`;
- Android splash source of truth: `apps/mobile/android/app/src/main/res/drawable/masanawa_splash_mark.xml`.

The deprecated raster `assets/brand/masanawa_agent_logo.png` must not be used to
regenerate Android launcher/splash assets.

Brand palette is now Agent Blue, not green:
- primary `#0A6FFA`
- strong cobalt `#0121D2`
- gradient `#0121D2 → #1DA4FD`
- dark gradient `#034EF6 → #24B9FF`
- light background `#F6FAFF`
- dark background `#06132C`
Semantic success/warning/error colors remain green/amber/red by meaning; they
must not be reinterpreted as brand colors.

Implemented:
- Flutter semantic tokens and Material theme surfaces use Agent Blue;
- in-app logo widgets use the blue agent/chat identity and no longer depend on the stale raster fallback;
- Android launcher and round icon use `@drawable/masanawa_launcher`;
- pre-Android-12 and Android-12 splash screens use `@drawable/masanawa_splash_mark`;
- Android splash background is Agent Blue;
- Android launcher/splash generator blocks were removed from `pubspec.yaml` so the retired
  raster artwork cannot silently overwrite checked-in native branding;
- web/PWA branding remains blue and should be reconciled separately when touched.

The Android namespace/applicationId remains `ng.unigeria.unigeria` strictly as
an internal installed-app identity for upgrade compatibility. It is not visible
branding. Do not rename it casually; changing it would create a different app
identity on Android.

The checked-in iOS AppIcon set remains generated output. Before an iOS release,
run `dart run flutter_launcher_icons` from `apps/mobile` so the approved
canonical asset regenerates every iOS size. The next Android APK does not depend
on those iOS generated files.


## Chat UX + Gemini Live checkpoint — 2026-10-04

The WhatsApp-style chat overhaul is implemented on current `main`; do not
reintroduce browser/device TTS or the old squeezed composer.

Implemented mobile chat behavior:
- responsive modern composer with separate emoji/attachment/camera controls and
  mic/send/stop action;
- true streamed Gemini Flash text deltas into one assistant bubble;
- Gemini Live native PCM streamed to Android `AudioTrack`, plus durable WAV
  replay in the same text+audio response bubble;
- speaker/earpiece routing, one-at-a-time voice playback, pause/replay, seek,
  1x/1.5x/2x speed, real/persisted waveform data and retryable playback;
- WhatsApp-style recording with timer, live amplitude waveform, slide-to-cancel,
  slide-up lock, pause/resume, preview/delete/re-record and persistent unsent
  voice drafts;
- reply/quote across text, media, grouped media and voice;
- long-press actions for reply/copy/react/forward/share/save/edit/delete/select;
- multi-select delete/copy; reactions; edited/deleted states; send/upload/
  processing/queued/failed/stopped states;
- offline queue with reconnect flush, retry without duplicate user bubbles and
  transport cancellation from Stop;
- unread/new-message button, no forced scroll while reading history and durable
  per-chat scroll position;
- staged persistent attachment drafts with caption support, grouped 2–8
  attachment turns, upload progress, image pinch+swipe gallery, video playback
  and document/media sharing/saving;
- in-chat search with next/previous navigation and highlighted result;
- date separators/timestamps; rename/pin/archive/unarchive/new-context/clear;
- rich GitHub-flavored Markdown, links, tables, selectable text and copyable code;
- response actions for regenerate/shorter/more detail/explain/translate/read
  aloud/continue;
- contextual typing/voice/attachment presence labels;
- old Android/device TTS bridge removed.

Voice transcription is intentionally NOT implemented per user direction.

Hosted runtime verification:
- Railway worker source remains `task073-inference-hardening`;
- grouped-media and streaming Gateway builds passed on Railway;
- provider stream smoke passed with a real Gemini response;
- Gemini Live native audio had already passed a real provider smoke;
- cancellation now propagates from client disconnect through AgentStrategy/
  inference and Gemini Live audio cleanup;
- deployment `1fed481b-c331-4fbf-9cd3-cd9d7ded1351` built and reached SUCCESS
  on runtime commit `c6229891d28408e0c93e15e8d4f3225430b129fc`.
  Later runtime commits preserve this implementation and add tests/cleanup.

Mobile verification status:
- modified chat/mobile source has been structurally scanned after the final edits;
- current package APIs for file_picker 13.1, flutter_markdown_plus 1.0.12,
  share_plus 13.3.1 and audio_session 0.2.4 were checked against current docs;
- the final physical Flutter compile/APK install and device interaction pass is
  still required. GitHub-hosted mobile CI has repeatedly failed before checkout
  with the known zero-step runner-allocation issue, so do not claim APK compile
  success until a real local/external Flutter build runs.


## Hosted phone testing verified — 2026-10-04

Mobile implementation is on main at `927c7572f28f1f90b8420bb56a35efe2d61ffb4f`.
The user's older laptop-configured debug APK must be rebuilt for the new
Settings > Developer > Connect test app flow. Keep the existing hosted token;
copy MASANAWA_ALPHA_DEV_TOKEN privately from the Railway worker Variables.
Do not reuse the laptop bootstrap token with the hosted Gateway.

Gateway: https://nurainworker-production.up.railway.app
Verified deployment: `fb8b6f75-8428-4005-8333-740022e0c0c4` on
runtime source `2ed4cab128872f5a282abadfc3a13560f3a8c69e`.
Operator smoke passed readiness, authorized directory (one visible Character,
Amina), real session admission, real text inference, real text-document
inference with durable AgentRun results, and close. This is server verification;
physical phone recording, TTS, restart and reconnect still need device testing.

The context compiler's Memory/World schema dependencies are now included in
readiness and bootstrap. Registered hosted Alpha upgrades use transactional,
checksum-checked migrations without reseeding canonical identities. The database
now uses pgvector/pgvector:0.8.6-pg18-bookworm on its existing PostgreSQL 18
volume. Plain-text media is decoded as strict UTF-8 user content (128,000-char
bound); PDF/audio/image retain the MIME/base64 adapter path.

All six imported credentials passed model-metadata lookup. The second pooled
inference credential returned HTTP 404/NOT_FOUND despite that lookup; other
credentials have not been qualified for inference. Alpha is explicitly pinned
to imported credential index 0 via MASANAWA_ALPHA_GEMINI_ACTIVE_CREDENTIAL_INDEX.
Text/document inference both passed with it. The full encrypted imported pool
is retained; there is no automatic retry across credentials or quota cycling.
The normal startup command is restored after smoke verification so routine
restarts do not make test inference calls.

Checks for this slice: 51 Flutter tests, zero Flutter analysis errors (existing
warnings/info remain), 40 targeted Gateway/context tests, five Node operator
smoke/credential-selection tests, and strict Gateway/Postgres typechecking.
Gateway dependency builds pass frozen install. Prior full-suite and CI evidence
below remains historical; no task gate, CI waiver or PR #89 merge is claimed.
There are no executable Skills seeded by Alpha bootstrap; Skills execution,
admin provisioning and production email delivery remain future implementation.

## Mobile testing checkpoint — 2026-10-04

The user built an installable debug APK locally and pushed build fixes to main
as `bf8d0530bb06794420542ab0910459d808df4177`. That APK targets the laptop
Gateway and the locally generated Alpha token; it is not a hosted build.
Do not restart cloud APK compilation to solve its directory connection failure.

The mobile testing slice adds debug-only, securely stored Gateway/token setup
with authorized directory verification; user-safe recovery messages; roster
retention on transient refresh failures; stale refresh rejection; 75-second chat
response timeout; explicit retry without duplicate user bubbles; and removal
of the permanent switch to the legacy preview endpoint after a Gateway error.
It also carries the already-tested splash lifecycle fix from PR #89.
The build helpers validate the selected Gateway, use temporary Dart-define files,
and only run USB reverse for a loopback Gateway. Existing local storage/theme
build fixes and the user's cleaned lockfile are preserved.

Verification: Flutter 3.47.6 / Dart 3.13.5; mobile analysis has no compilation
errors (existing warnings/info remain), 51 Flutter tests pass, and three Node
hosted-smoke tests pass. See apps/mobile/README.md for exact install/connect
steps. Authenticated hosted checks passed; see the verified checkpoint above. Physical recording/TTS,
device restart/retry and full live inference are not implied by unit tests.

PR #89 remains the unmerged runtime work on task073-inference-hardening.
Its recorded 515 PostgreSQL-backed tests and CI runner allocation blocker are
preserved. No Task 072–076 completion, Skill execution, Resend sending or
real-device qualification is claimed by this mobile slice.



This is the mandatory handoff entry point for every new Masanawa implementation session.


## Task 072 / Alpha 1 implementation checkpoint

PR #83 (`task072-alpha1-agent-run`) implements the current Task 072 contract and a
bounded continuous-testing slice for the Flutter app.

Implemented on this checkpoint:
- canonical AgentRun identity, CharacterSession/CharacterVersion binding, root/parent
  lineage and immutable request/correlation/Task/Workflow/Operation trace references;
- PostgreSQL AgentRun persistence, explicit completed/failed terminal states,
  Relationship-scoped current-authority checks and DB-level history immutability;
- PostgreSQL acceptance coverage for lineage, terminal state, isolation, replay and
  immutable trace history;
- live Alpha Gateway routes for open/text/media/close using canonical
  CharacterSession + AgentRun custody;
- replaceable Gemini development inference only (Task 073 still owns production
  AgentStrategy);
- real voice-note/image/document bytes accepted in bounded Alpha media turns;
- optional Android-local TTS for immediate voice-first testing;
- canonical Alpha bootstrap script for a dev Tenant/User/Character/Relationship/
  Security policy/AgentPresentation;
- debug login token, Developer diagnostics, and debug-only Scenario Lab for
  Work/File/Approval/Call rendering without backend side effects;
- debug Android HTTP allowance for a laptop-hosted Gateway only; release builds do
  not enable cleartext traffic.

Task 072 remains **IN PROGRESS** until required verification actually runs and passes.
On the latest PR head, both Foundation CI and Mobile Build again terminated before
checkout with zero steps and `runner_id=0`; this is the same external hosted-runner
condition and is not a code/test result.

For hands-on Alpha testing, follow `apps/mobile/README.md`: run PostgreSQL 18,
`pnpm alpha:prepare`, start Gateway with the printed `MASANAWA_ALPHA_*` values,
then build/run the debug Flutter app with `AGENT_RUNTIME_ENABLED=true`,
`AGENT_BASE_URL`, and the same `ALPHA_DEV_ACCESS_TOKEN`.

## Mission

Build Masanawa as one clean canonical platform from the strongest validated capabilities
found across the reference vault and explicitly assessed post-freeze candidates.

Do not recreate donor project boundaries. The repository is the source of truth.

## Current product-direction overlay — creator clones and reseller economy

The canonical product decision is now recorded in
`docs/CREATOR-CLONE-ECONOMY.md`.

Key constraints to preserve while continuing the numbered roadmap:
- one personal clone per ordinary User;
- Masanawa owns Offer pricing, margins, routing and settlement;
- creators may fund Agent Float, but insufficient Float can trigger fallback rather than
  dropping the customer request;
- the originating clone keeps reseller/customer attribution even if another executor
  performs fulfillment;
- Gwani and Gwana are peer platform/support Characters with the same role/capability
  model;
- Gwani is the default platform/support Character and prefers Gemini voice Bodi;
- Gwana is selectable in Settings and prefers Gemini voice Sulafat;
- voice/default selection is configuration, not Character identity or a parallel runtime.

Do not create a temporary wallet, marketplace, clone runtime or privileged Gwani/Gwana
code path outside the canonical package owners.

## Mandatory read order

1. `README.md`
2. `docs/VISION.md`
3. `docs/PRODUCT-NORTH-STAR.md`
4. `docs/PRODUCT-PROJECT-STRUCTURE.md`
5. `docs/PRODUCTION-MASTER-TASKS.md`
6. `docs/CREATOR-CLONE-ECONOMY.md`
7. `docs/SKILL-DESIGN.md`
8. `docs/ARCHITECTURE.md`
9. `docs/AGENT-PHONE-EMBODIMENT.md`
10. `docs/TECHNOLOGY.md`
11. `docs/SOURCE-OWNERSHIP.md`
12. `docs/REWRITE-PLAN.md`
13. `docs/migration/LANDSCAPE-EXPANSION.md`
14. `docs/migration/SOURCE-LOCK.md`
15. `references/README.md`
16. `references/SOURCES.md`
17. `docs/migration/FORENSICS-METHOD.md`
18. `docs/migration/FEATURE-LEDGER.md`
19. `docs/migration/BEHAVIOUR-LEDGER.md`
20. `docs/migration/DATA-LEDGER.md`
21. `docs/migration/INTEGRATION-LEDGER.md`
22. relevant files under `docs/migration/sources/`
23. the active phase implementation record named below.

`docs/migration/LICENSE-LEDGER.md` is compliance/provenance metadata and is **not** part
of architectural feature selection.

## Current phase

**Phase 7 — Agent runtime.**

Task 071 implementation head `333030618c0d060c6253dbe99fe548dc3b823d4c` passed Foundation CI run 458 (360 tests in 75 files, including ten real PostgreSQL 18 CharacterSession acceptance cases). PR #79 merged as `c2bdfb9f5a970d3d949cbd8692d9c59cb89670a0`; merged-main Foundation CI run 459 passed on that exact merge commit.
Current production task: **072 — AgentRun identity, lineage and durable trace references**.

Supplemental product-surface checkpoint merged on main as
`a41e1d944572f9511497032815b2d191967825f8` (PR #81):
- the Flutter user app no longer contains a hard-coded production agent roster;
- mobile conversations and directory entries are keyed by canonical CharacterId;
- admin-configured AgentPresentation is separate from CharacterSkillAssignment;
- Ops now has separate presentation/Skill administration contracts and UI;
- Gateway has an authorized mobile agent-directory projection;
- structured chat result parts cover durable files/artifacts, work progress,
  approvals, Operations and call results;
- the mobile shell is explicitly voice-first and uses Masanawa naming rather than
  retired UNigeria app/theme identifiers.

This checkpoint does **not** complete or supersede Task 072 or later Gateway/Presence
runtime tasks. GitHub Actions for PR #81 could not start a runner (zero steps,
`runner_id=0`), so the merge records that infrastructure limitation rather than
claiming a verified CI pass.

Task 070 implementation head `68e8e4002bc7fae8ea0e1a58b72b81e00454e294` passed Foundation CI run 450 (340 tests in 73 files, including nine PostgreSQL 18 Skills acceptance cases). PR #76 merged as `34aa6f9d19f9b0c92527fabe3a750052009398d2`; merged-main Foundation CI run 451 passed on that exact merge commit. Phase 6 is closed; `docs/PHASE-6-CLOSURE-AUDIT.md` is PASS.

Active phase record: `docs/PHASE-7-AGENT-RUNTIME.md`.

Phase 5 is closed on merged `main` at
`0fe123e18a9163386c4ab10331139265ce26b64e`; Foundation CI run 369 passed on
that exact merge commit.

The next implementation branch must start from current merged `main`, not from an
older Phase 5 branch.

Phase 0A/0B, Phase 1 and Phase 2 are closed.

The non-spatial Phase 3 Identity/World boundary is closed:
- PR #28 merged as `02c2c99153e904b4f9d2f403328a1e3b6effc3f1`;
- implementation head `b56039533bdb4e45a2b27a19621d160394f3b56c` passed Foundation CI run 245;
- final closure/documentation head `46dffb5d7eb8950ba3de0da9f8d6aab2862e2fa0` passed Foundation CI run 246;
- `docs/PHASE-3-NONSPATIAL-CLOSURE-AUDIT.md` is PASS.

Optional WorldSpace/location/pathing is deferred behind
`WorldPolicy.spatialEnabled`. Do not reopen canonical Identity/World ownership merely
because spatial mechanics remain optional.

## Phase 3 merged history

- canonical identity: PR #17, merge `75549800445842f8ff1db54e06529c075ed34ea4`;
- world generation/input foundation: PR #18, merge `871022d03f4b3fb2a81af5c6253dd38bd5b7a27f`;
- governed CharacterLifeState + canon events: PR #19, merge `729ab3e64eb0539ea249ceb6a39cf79afab20cb2`;
- canon policy/time hardening: PR #21, merge `ce89ce091e05508dd4d0614a9127a2256bda13e4`;
- reconciled routines/story arcs: PR #23, merge `4bd9a3a8b2504617291d7e18e992d5f56856886d`;
- authority-bound WorldEvent governance: PR #24, merge `9f2574b9d3932079a834c5c2976ee89e2fdcf2cc`;
- WorldInteraction evidence: PR #25, merge `ed186608248659654cdcf23ab8b793dd426fa7ef`;
- pause/restart/catch-up recovery: PR #26, merge `bcfe597bd8aa7cb6191bb34fb5c626bbe5884ee0`;
- World evidence→events/outbox: PR #27, merge `426a6689f0839aad3077754a9f947f2abe0ba8d6`;
- non-spatial privacy/acceptance closure: PR #28, merge `02c2c99153e904b4f9d2f403328a1e3b6effc3f1`.

## Post-freeze candidate review — completed

Requested candidates:
- `mempalace/mempalace`, inspected at
  `5ea40d30caf0ed2ff6e49623e386a0863b28edaa`;
- `paperclipai/paperclip`, refreshed against current `master` at
  `c83df091b1a5207375eaf23466bb5c62e4e1518e`.

Evidence and decision:
`docs/migration/POST-FREEZE-MEMPALACE-PAPERCLIP.md`.

Decision:
- MemPalace is a strong Phase 4 behavior donor for verbatim evidence retention,
  retrieval isolation/compatibility, hybrid retrieval and evaluation;
- it does **not** become a canonical store, Python runtime dependency, Chroma/SQLite
  authority or second memory service;
- Paperclip is a strong later workflows/agents/Ops behavior donor for atomic task
  checkout, stale-run adoption, heartbeat execution, cost/run visibility and
  operator control;
- Paperclip Company/Agent/Issue/Approval state does **not** replace Tenant/Character,
  canonical workflows or Masanawa Authority/Approval/Operation semantics;
- neither candidate is currently admitted as a pinned source-vault submodule.

## Phase 4 first slice — implementation gate passed

Primary record: `docs/PHASE-4-MEMORY.md`.

Implemented on the current branch:
- real `@masanawa/memory` package;
- explicit relationship / character-private / character-shared / world / session /
  task / organization scopes;
- canonical MemoryRecord and append-only MemoryRevision;
- mandatory immutable provenance evidence;
- optional verbatim evidence preserving exact source text;
- exact-scope direct read API; there is no unscoped record-by-ID retrieval port;
- explicit allowed-scope list query;
- PostgreSQL `memory.records`, `memory.revisions`, `memory.evidence`;
- immutable record type/scope identity;
- immutable revision/evidence content;
- atomic expected-revision append;
- exact replay idempotency and stale changed replay conflict;
- workspace/build/lockfile/PostgreSQL adapter wiring;
- unit tests for scope/evidence/temporal invariants;
- PostgreSQL fixture for cross-Relationship non-disclosure, revision CAS/replay and
  database immutability;
- Foundation CI run 250 passed the complete check gate on implementation head
  `fd8e20bf7d589393d017338af89502fa4ca3ae6b`;
- final documentation head `08d7685048ee27145937dbe204b4a8ea6deae09e`
  passed Foundation CI run 251;
- PR #29 merged as `f99c42157401728a5ca3b4f91d5732382f57c865`.

The MemPalace-inspired behavior used here is deliberately structural: extracted
MemoryRecords never replace their immutable/verbatim source evidence.

## Immediate work

Phase 6 Skills is closed. Task 071 CharacterSession is merged and verified. Continue Phase 7 from current merged main; the production-structure hardening checkpoint is already complete.

Tasks 001-071 are merged complete.

Task 054 implementation head `3a0a6251a551ffcfd852d3f4f80063195257ece6` passed
Foundation CI run 379, PR #47 merged as
`d0a198dbdec1af08e3c8f1378da0985db628eb6e`, and merged-main Foundation CI
run 380 passed on that exact merge commit.

**Current: Task 072 of 150 — Implement AgentRun identity, lineage and durable trace references.**

Task 071 implementation head `333030618c0d060c6253dbe99fe548dc3b823d4c` passed Foundation CI run 458 (360 tests in 75 files, including ten real PostgreSQL 18 CharacterSession acceptance cases). PR #79 merged as `c2bdfb9f5a970d3d949cbd8692d9c59cb89670a0`; merged-main Foundation CI run 459 passed on that exact merge commit.

Task 071 established:
- one Agents-owned, bounded CharacterSession contract and authorized repository port;
- immutable tenant/User/Character/Relationship/version bindings with replaceable channel/presence projections;
- exact SkillVersion references with explicit CAS refresh, without freezing readiness or granting execution;
- scoped idempotent admission, revision-checked updates and atomic reset/successor continuity;
- PostgreSQL lifecycle guards and current Security/Identity revalidation through owning ports;
- real restart, private isolation, reset rollback/race, policy/revocation/expiry-lock and migration-readiness acceptance.

Task 066 implementation head `eb0ddef003bf9946d0df50b6c070a4d6ab6ea59c` passed Foundation CI run 431. PR #68 merged as `e1573fc91549b25a0425ef9a8cc7534ca0a4464a`, and merged-main Foundation CI run 432 passed on that exact merge commit.

Task 066 established:
- immutable Skill risk/capability classification derived from canonical SkillVersion and Tool registry evidence;
- fail-closed rejection when any referenced ToolVersion exceeds declared Skill risk, side-effect or sensitivity envelopes;
- explicit surfacing of every Tool authority capability through the Skill authority declaration;
- exact candidate ToolVersion evidence without selecting or embedding Providers.

Task 067 implementation head `413fa1b929d5c098ad22dfe211ebd5038171c2b3` passed Foundation CI run 436. PR #70 merged as `d2a490b40281ea6ab53e70422149b38bd33fda46`, and merged-main Foundation CI run 437 passed on that exact merge commit.

Task 067 established:
- exact immutable certification binding to the certified SkillVersionId;
- reproducible rehearsal-suite key, revision and content hash;
- immutable per-case category/outcome/observation/evidence reference and content hash;
- mandatory positive and negative activation rehearsal coverage;
- fail-closed unique-case, temporal, counter and all-pass validation without granting authority or execution rights.

Task 068 implementation head `66b323703749fdd658f6a0c5af37ba73251636ee` passed Foundation CI run 440. PR #72 merged as `42b2cf29348fa38b58b27744b1162cd623058241`, and merged-main Foundation CI run 441 passed on that exact merge commit.

Task 068 established:
- explicit exact dependency-graph eligibility snapshots with missing/non-ready blockers;
- separate execution eligibility, model advertisability and current advertisement state;
- content-addressed exact root/dependency SkillVersion revision pins with per-definition hashes;
- pin integrity/definition/graph drift rejection without any implicit latest-version substitution;
- current readiness revalidation when resolving a pin so operational blocks are never frozen away.

Task 069 implementation head `83ed96c693a307fb9fcebac7a593df680d8e1273` passed Foundation CI run 445 (328 tests). PR #74 merged as `1dd2363847c70a81ec1839377921bb461804db1e`; merged-main Foundation CI run 446 passed on that exact merge commit.

Task 069 established:
- deterministic exact-plan step/Tool/direct-subskill trace metadata and privacy-safe telemetry tags;
- bounded trace admission with canonical IDs, ordinal/hash/reference validation and kind-specific field combinations;
- copied, frozen failure trace evidence that rejects malformed metadata and excludes arbitrary private fields;
- preservation of typed failure/Operation/correlation semantics, reconciliation precedence for ambiguity and redaction of unknown exceptions.

Task 070 implementation head `68e8e4002bc7fae8ea0e1a58b72b81e00454e294` passed Foundation CI run 450 (340 tests in 73 files, including nine PostgreSQL 18 Skills acceptance cases). PR #76 merged as `34aa6f9d19f9b0c92527fabe3a750052009398d2`; merged-main Foundation CI run 451 passed on that exact merge commit. Phase 6 is closed; `docs/PHASE-6-CLOSURE-AUDIT.md` is PASS.

Task 072 is next. Preserve the canonical CharacterSession contract, Skills catalog/restore/pin ports and existing Tool/Provider authority. Real Android/OmniSIP qualification remains in the device tasks.


Task 065 implementation head `e17e444716c58460de1a780daafd3d6dd5cfdac0` passed
Foundation CI run 427. PR #66 merged as
`1e852d8b59307e86d5ab0cb2bf592095db725df3`, and merged-main Foundation CI
run 428 passed on that exact merge commit.

Task 065 established:
- reproducible exact source-system/reference/revision/content-hash provenance for SkillVersions;
- normalized publisher identity with publisher key, display name, publisher kind and optional evidence reference;
- evaluator-attributed trust verdicts with tier, evaluation time and normalized reason codes;
- exact source revisions required for imported Skills and publisher/trust evidence propagated into quarantined imports;
- trust remains descriptive admission evidence and never grants Tool, Provider, authority or subskill execution rights.

Task 064 implementation head `c72a10295faffe76cfe420d91373c483b54608a1` passed
Foundation CI run 423. PR #64 merged as
`b1155fde170c301e96ddddb267c8bf6ed08134b4`, and merged-main Foundation CI
run 424 passed on that exact merge commit.

Task 064 established:
- fail-closed binding from declared Skill Tool references to exact registered ToolVersions;
- canonical ToolInvocation translation with Provider selection deliberately excluded from Skill ownership;
- exact direct-subskill execution binding constrained to earlier steps in the validated execution plan;
- unchanged authority propagation and canonical immutable boundary inputs, preventing arbitrary Tool/subskill bypass.

Task 063 implementation head `1e1c15b40933dde74019b332731c3a311a72d52e` passed
Foundation CI before merge. PR #62 merged as
`2fac8cf608984106c35115b6513aa545baadf91c`, and merged-main Foundation CI
run 420 passed on that exact merge commit.

Task 063 established:
- deterministic immutable dependency-first execution plans over the canonical Skill registry;
- exact SkillVersion DAG step deduplication and readiness gating before plan publication;
- aggregate Tool capability requirements without selecting Providers or performing execution;
- composition semantics that keep execution planning separate from Task 064 SkillTool/subskill execution boundaries.

Task 062 implementation head `0610eccd5b58f8be00b12fa56706e4430fdb0406` passed
Foundation CI run 415. PR #60 merged as
`df1d9c4f1033e2b5f51611da68e183ad6d760edc`, and merged-main Foundation CI
run 416 passed on that exact merge commit.

Task 062 established:
- atomic, order-independent validation of exact immutable SkillVersion dependency graphs before registry mutation;
- fail-closed missing-dependency, cycle and configured-depth validation without partial registration;
- exact-replay idempotency with changed-version, key/version and logical identity conflicts rejected;
- one-to-one stable SkillId↔logical-key ownership across versions and within registration batches.

Task 061 implementation head `6072e2ca40aea0f852f61b4c008a5b18d8251dae` passed
Foundation CI run 411. PR #58 merged as
`7e1fc2576979823a0cb859ac9a6bd7ea21d0f522`, and merged-main Foundation CI
run 412 passed on that exact merge commit.

Task 061 established:
- provider-neutral required Tool capability declarations on immutable SkillVersions;
- named Tool references that may remain capability-bound or pin an exact ToolVersionId without pinning a Provider;
- fail-closed normalization requiring complete capability/reference coverage;
- fail-closed resolution against the canonical Tool registry for missing capabilities, missing candidates and exact-pin capability mismatches.

Task 060 implementation head `f5f939f7fb6999fa901d1538ab2a37ef50b04579` passed
Foundation CI run 407. PR #56 merged as
`c4cf2ce319bc1365387ec3ebcd510916ac9de579`, and merged-main Foundation CI
run 408 passed on that exact merge commit.

Task 060 established:
- TypeBox-validated native Skill manifest v1 with bounded fields and fail-closed unknown versions/properties;
- bounded `SKILL.md` compatibility import for routing metadata without introducing a general YAML runtime;
- relative-POSIX resource containment rules with traversal/ambiguous path rejection;
- scripts skipped by default and requiring explicit import opt-in that still grants no execution authority;
- deterministic normalized-content provenance fingerprints and explicit quarantined import candidates with no canonical IDs/certification/readiness.

Task 059 implementation head `3755dbf7b32f3eaa4e84db32e26749e21c110ef9` passed
Foundation CI run 402. PR #54 merged as
`631076323f075f07a9c67ea5902f17070d859e22`, and merged-main Foundation CI
run 403 passed on that exact merge commit.

Task 059 established:
- canonical private `@masanawa/skills` workspace integrated into frozen-install/build gates;
- stable logical Skill identity separated from immutable exact SkillVersion content;
- canonical normalization and recursive freezing for SkillVersion-owned schemas, examples, capabilities, provenance and certification evidence;
- fail-closed certification, consequential idempotency/reconciliation and billed-confirmation invariants;
- preserved dependency-aware registry work as bounded groundwork only, without claiming Tasks 060-070 complete.

Task 058 implementation head `bc6fb045a57759c65531e54f35599d1b91b2b993` passed
Foundation CI run 397. PR #52 merged as
`0a8376a69a9410c8bee48ef03d0b939a31188da9`, and merged-main Foundation CI
run 398 passed on that exact merge commit.

Task 058 established:
- machine-readable production environment registry and ownership/classification rules;
- explicit composition-root-only environment access with domain packages isolated from `process.env`;
- Security-aligned secret/bootstrap conventions without raw secret material in source-controlled manifests;
- canonical coarse deployment topology for Gateway/Worker/Presence/Ops and vendor-neutral hosting;
- architecture enforcement for registered production environment reads and secret classification.

Task 057 implementation head `fbdd51b0b113f8d40c625086d0a851c3de60a7f0` passed
Foundation CI run 394. PR #51 merged as
`5395b29c1bfa5705d447152d3ff3c606c0658ed6`, and merged-main Foundation CI
run 395 passed on that exact merge commit.

Task 057 established:
- one machine-readable API lifecycle policy separating workspace SemVer, HTTP majors, schema versions and domain registry versions;
- root-only reusable workspace exports and repository-wide no-deep-import enforcement;
- Contracts-suite acceptance for API lifecycle and supported HTTP major routing;
- machine-audited deprecation registry with source annotations for deprecated workspace symbols;
- immutable event/payload and Tool/Provider version semantics.

Task 056 implementation head `b17d4ba53d23abb9abf40aa7800b1c461dc9fa90` passed
Foundation CI run 386. PR #49 merged as
`ed119581974cfb146da0b6e0a5e119eda8731df8`, and merged-main Foundation CI
run 387 passed. Supplemental Security/Load/Recovery hardening PR #50 merged as
`b07565a315c35dc1ef840c89845ccfd2836c2da4`; merged-main Foundation CI run
391 passed on that exact commit.

Task 056 established:
- canonical cross-cutting suites for contracts/integration/e2e/parity/security/recovery/load/chaos;
- strict TypeScript and default Vitest discovery for `tests/**`;
- deterministic Recovery and Chaos evidence using the shared fault-injection harness without duplicate tests;
- targeted suite commands plus one all-tests `test:ci` merge gate;
- visible Foundation CI Typecheck/Test/Build stages;
- architecture enforcement for suite directories, scripts, discovery and workflow wiring.

The historical `phase6-skills-foundation` branch is based on pre-roadmap `main`.
Its valid foundation was reconciled in Task 059 rather than merged wholesale.
Do not revive it as the active branch or duplicate its already-merged Skills behavior.

For Phase 7 runtime work, use `docs/PRODUCT-NORTH-STAR.md` as the
product-priority check and preserve the device-provider direction in
`docs/AGENT-PHONE-EMBODIMENT.md`. Skills must be capable of resolving Tools through
both cloud Providers and future Device Providers without embedding either execution
path in Skill definitions.

Merged Phase 5 history:
- registry foundation PR #37:
  `b3f2e8ce33aeb4ed125bd40af78f10a454174bbd`;
- consequential execution/reconciliation PR #38:
  `21141266ab15e2111b8f78c6df365100a60a017a`;
- durable receipt/replay PR #39:
  `8d531188e2f9d7c38f50cc883e3425096b5408ad`;
- typed Provider failures/privacy-safe telemetry PR #42:
  `be814fee91b8b551b00e2d9900d2970680297b3d`.

PR #45 merged as `0fe123e18a9163386c4ab10331139265ce26b64e`.
Foundation CI run 369 passed on the merged `main` commit. Phase 5 is therefore closed.

PR #44 is an older, still-open alternative credential-resolution branch based on the
pre-#45 history. Treat it as stale/superseded unless a later reconciliation finds a
missing behavior not already preserved in the merged credential-custody design.

Implemented on the branch:
- Security-owned CredentialRefId resolution binds tenant, Provider, Operation and slot;
- raw credential material is available only through `CredentialSecret.use(...)`;
- CredentialSecret string/JSON surfaces are always `[REDACTED]`;
- encrypted credential envelopes are crypto/KMS-neutral contracts rather than a
  hard-coded provider;
- PostgreSQL `security.credential_refs` stores only encrypted envelope material plus
  tenant/provider/slot/generation/active metadata;
- create is conflict-safe; rotation uses expected-generation CAS; revocation disables
  subsequent resolution;
- provider adapter-edge helpers resolve only validated Provider credential slots;
- wrong tenant/provider/slot, missing/ref-revoked credentials and decrypt/KMS failures
  all fail through one non-disclosing `credential.unavailable` authorization surface;
- PostgreSQL integration coverage proves ciphertext-at-rest, scope isolation,
  generation rotation/stale rejection, revocation and decrypt-error redaction.

Foundation CI run 356 found an implicit-any issue and later hardening added a real
same-tenant Operation requirement plus a genuine pre-revocation decrypt-error test.
Hardened implementation head
`7d53562fe29f5aae6a3e69c495757ce22658df3a` passed Foundation CI run 365.
The complete gate passed frozen install, strict TypeScript, unit/architecture tests,
PostgreSQL 18 + pgvector integration suites and production builds.

The Phase 5 acceptance audit is PASS and its final merge is green.

Immediate next:
1. start Task 072 AgentRun identity, lineage and durable trace references from current merged `main`;
2. recover the canonical ledger, CharacterSession/Identity/Security boundaries and `docs/PHASE-7-AGENT-RUNTIME.md` before choosing the AgentRun contract;
3. preserve Skills persistence/pins and atomic Tool/Provider authority rather than introducing another execution engine;
4. close Task 072 only after its acceptance and exact merged-main CI pass; preserve later strategy/context/budget milestones and Phase 8 Workflow ownership.

The requested post-freeze donor boundary remains unchanged: MemPalace contributes
retrieval/evaluation/storage-contract behavior inside canonical Masanawa memory ports;
Paperclip contributes later workflow/runtime recovery and Ops behavior inside canonical
Masanawa workflow/agent ports. Neither becomes a production runtime authority.

The lifecycle/publication implementation now includes independent lifecycle CAS,
immutable same-scope/type lineage, current-authority + one-time-approval publication,
PostgreSQL fixtures for stale writers/preserved evidence/cross-scope rejection, stable
replay after later source supersession, source-row locking against concurrent revision
races, and generated sanitized publication provenance that cannot carry caller-injected
private verbatim evidence.

Foundation CI run 261 passed the complete gate on hardened implementation head
`f5777a0d32fdc57b84d8fd415bb4ddb5de57a972`; final documentation head
`061ab25d85b5100120c73d1442984cff8cf922e8` passed run 262; PR #30 merged as
`b3cc9e75fe32ded30dc51dc2b116a38b454b46a9`.

Historical Phase 4 ordering: retrieval quality must not outrank canonical scope,
provenance, correction, deletion or liveness. Phase 4 is closed; do not restart it.

## Memory architecture — fixed

ADR-0007 and `docs/migration/MEMORY-ADOPTION-BOUNDARY.md` decide:
- `packages/memory` is the sole canonical memory authority;
- PostgreSQL stores canonical scoped records/revisions/evidence;
- relationship/private/shared/world separation is mandatory;
- scope/authorization precedes retrieval;
- contradictory/corrected history is versioned rather than silently overwritten;
- working context is compiled, not durable truth;
- vector/lexical/entity/temporal/graph indexes are disposable/rebuildable;
- expiration, tombstone and physical purge are distinct;
- automatic/proactive and explicit recall have separate policy gates;
- N.E.K.O, Letta Code, Mem0, OpenClaw and post-freeze MemPalace are bounded donors only.

## World architecture — fixed

ADR-0009 and `docs/migration/WORLD-SIMULATION-ADOPTION-BOUNDARY.md` decide:
- `packages/world` is the sole canonical world/life authority;
- AI Town supplies simulation mechanics, not canonical objects;
- ChatWithStars supplies life-state/canon/governance semantics;
- private Relationship memory cannot mutate shared World canon;
- memory/workflows consume World evidence only through typed boundaries;
- optional spatial simulation never becomes Character identity.

## Non-negotiable rules

- One identity system.
- One memory system.
- One skill system.
- One tool registry.
- One agent execution framework.
- One provider registry.
- One event model.
- One task/workflow engine.
- One world model.
- Channels/device nodes are adapters, not alternate brains.
- Characters are domain entities, not prompts or agent classes.
- Providers/models/UIs never own business truth.
- Consequential side effects require deterministic validation, authorization,
  idempotency, reconciliation and audit.
- Private relationship memory never silently becomes shared Character/World truth.
- Reference repositories are never production imports unless an explicit adapter ADR
  says so.
- No donor repository becomes a hidden runtime boundary.
- Licensing/provenance never decides feature survival.
- Nothing is migrated without evidence and an acceptance strategy.

## If context is missing

Do not ask the user to repeat previous discussions. Recover state from this repository,
the active branch, CI, source lock, reference vault and phase record.

