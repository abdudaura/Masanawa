# Continue Here

## APK compilation checkpoint — 2026-10-04 08:00 UTC

This section supersedes older pending mobile-test statements below.
Gateway deployment `1162ccd8-4b6b-4a1c-85e0-f0417cd820eb` is live on
`5c5632cd7a7c7f6b886184bd54e732cf6525f508`: readiness is 200 and
missing Alpha authorization returns 401. All 106 Gateway/Agents tests pass.

Cloud Flutter analysis passed its compilation-error gate with 120 existing
warnings/info, and all 42 mobile tests passed, including real login routing
and splash disposal. The subsequent Android build has not produced an APK.
Initial Gradle daemon disappearance exposed the builder's hard 999,997,440-byte
memory limit; increasing it beyond 1 GB was rejected by the current plan.
The builder now uses one worker, in-process Kotlin, 512 MB heap, 192 MB
metaspace and 64 MB code cache. Android SDK platform `android-37.0` is the
actual published package; the previous `android-37` package was unavailable.

Deployment `9c2aa42f-45db-4d38-806d-8fe854fdd2df` on
`50beb8337a68fe708e4cb5f5dfe243239cf9d0b5` passed all 42 tests but failed
`:gradle:compileKotlin` with an InvocationTargetException. No underlying
cause was logged. Diagnostic source `087dca536f4df1cfc616e7488450be5aea5c8e10`
enables Gradle stack traces; deployment `3719746d-b48b-4b41-9521-b5dd247ff146`
is running. Inspect that exact deployment before retrying or changing limits.
No APK or device verification is claimed. Keep secrets private and verify the
authenticated APK manifest/hash before delivery.

Task 072 remains current: Foundation CI failed before checkout with zero
steps and runner_id=0. Preserve prior PostgreSQL acceptance evidence and do
not merge or mark the gate complete. Resend still awaits the user's API key.


## 2026-10-04 live Railway / APK continuation checkpoint

This checkpoint supersedes older repository-access and hosted-deployment blockers
below. Recover the live service state before changing settings.

- Open work remains PR #89, branch `task073-inference-hardening`; main is
  `193ca46b2ed06ff1ced96dab7cb07ea1425345b0`. Task 072 is still current.
- Railway now accesses the private Masanawa repository. Gateway deployment
  `17f42e04-5087-488e-9b65-5ac7d8683b3b` succeeded on source
  `ec2b9c798c68dec3c651b4c7a4fb3190ec6271e9`.
  HTTPS `https://nurainworker-production.up.railway.app/readyz` returned
  200, gateway ready, database-schema ready. Hosted bootstrap/startup completed;
  this does not verify Gemini generation or authenticated mobile conversations.
- The reused call-gateway service is now the private APK builder, not telephony.
  Deployment `3e32b67f-e98c-4853-9519-6aa312812418` ran Flutter analysis
  without compilation errors and passed 40 tests, but failed its splash boot test:
  a polling timer survived widget disposal. It produced no APK.
- Source `5c5632cd7a7c7f6b886184bd54e732cf6525f508` replaces splash polling
  with session listening plus cancellable brand/restore-deadline timers. The boot
  test now asserts actual login routing and early disposal. Cloud Flutter tests
  and APK compilation must run before calling that fix verified on Flutter.
- The same source fixes observed live Alpha access errors: missing token previously
  returned 500. Explicit HTTP-edge 401/403 now preserve fail-closed admission and
  hide the distinction between unadmitted/hidden Characters. All 106 Gateway/Agents tests,
  strict Gateway typechecking and the complete Gateway dependency build passed.
- Authorized deployments on this source were triggered together: Gateway
  `1162ccd8-4b6b-4a1c-85e0-f0417cd820eb`, APK builder
  `0abc66ae-d1fc-456a-a705-f58f2a4c822c`. Gateway deployment succeeded; live readiness returned 200 and the
  unauthenticated directory returned 401. Inspect the APK builder's actual result.
  All 106 Gateway/Agents tests pass. Foundation CI run 37186111144 still failed
  before checkout with zero steps and runner_id=0.
  The builder logs individual tests with one worker and fails after a bounded
  ten-minute test stage; failures are never skipped to force APK production.
- Gateway Alpha identity references and development token were preserved.
  Only the APK download token was rotated; its value is private and not in Git.
  The builder embeds the existing Alpha token, never Gemini/database credentials.
  Inspect its authenticated manifest/hash and deliver the actual APK only after
  compilation succeeds. Do not expose the APK publicly.
- Resend configuration remains pending the user's promised API key and completion
  of the hosted testing path. No email delivery or Resend integration is claimed.
- Task 072 still requires the exact implementation/merged-main Foundation CI gate;
  the prior 515 real-PostgreSQL test result is preserved, not rerun or waived here.
  Do not restart AgentRun, context, selection or inference-budget implementation.


## Task 072 real PostgreSQL verification checkpoint

The 2026-10-04 closure attempt runs PostgreSQL 18.6 with pgvector 0.8.6 in
an isolated disposable QEMU guest, without the user's laptop or hosted Alpha
data. The standard `pnpm alpha:verify` passes: 344 unit/architecture tests and
19 real PostgreSQL tests (ten CharacterSession and nine AgentRun), with the
command's default limits. A serial run with extended limits also passed all 19.
Fixtures use the database admission clock for authority and canonical timestamps;
production authorization checks are unchanged. Source scanners now exclude
Next.js build output and installed dependencies, so checks remain valid after
a workspace build. Frozen-lockfile install, full workspace typecheck and full
workspace build have run successfully. The final full serial database suite
passes all 515 tests in 95 files, with zero skips and extended limits for CPU
emulation. See `docs/TASK-072-VERIFICATION.md` for
precise results and limits. Task 072 still requires a successful Foundation CI
gate on the implementation head and merged main. Run 37178168912 attempt 2
failed with zero steps and runner_id=0; do not record it as a passing gate.

This is the mandatory handoff entry point for every new Masanawa implementation session.

## Railway replacement / encrypted Gemini import checkpoint

The user superseded the DigitalOcean target: reuse the Nurain Railway worker and
replace its ChatWithStars source with Masanawa for actual phone testing. Both old
DigitalOcean Droplets (604386381 and 604387968) were explicitly deleted and a
fresh account inventory showed no Droplets. No Masanawa Droplet was created.

Railway project `3ab9e6ec-a3fa-47c9-be81-4f12a315ca0b`, production environment
`a7a29368-d2d5-4baf-b846-c570dfeaa6ba`: contracts service
`498972c8-d316-4d76-b22c-c8358666394f` now runs `postgres:18-bookworm`, private
DNS `nuraincontracts.railway.internal`, persistent volume
`72653d2d-1e4f-42bb-82d5-238ed901226f` mounted at `/var/lib/postgresql` (500 MB).
Deployment `fd4cab85-1874-4486-9aeb-2edbe06621c4` succeeded; real logs report
PostgreSQL 18.6 ready for connections. Masanawa bootstrap has not run there.

Worker `68191f50-7189-4ebe-88f2-db8ef2077d81` still has ChatWithStars as its
source: Railway rejected `Baatiku/masanawa` as not found/inaccessible. Restore of
its original build/start/health settings was submitted after a failed deployment
`735c979f-aa73-4bdf-89f6-f5dc8cf48258` caused by applying replacement settings
before source attachment succeeded. Do not repeat that mistake: stop on a source
attachment error; only apply coordinated settings/source once access is verified.
The user must grant Railway's GitHub connection access to Masanawa. Do not make
this private repository public or mirror business truth into ChatWithStars.

At the user's explicit request, all six enabled encrypted Gemini credentials from
Nurain Supabase were transferred to the worker's private environment variable
`MASANAWA_ALPHA_GEMINI_IMPORTED_CREDENTIALS_JSON`, without plaintext export or
source-database changes. The hosted wrapper's explicit migration bridge decrypts
AES-GCM with the worker's existing current/previous encryption secrets, checks
fingerprints and fails closed on partial/invalid imports. Credentials remain
in process/configuration only. The Gemini inference edge accepts a distinct key
array, rotates one key per request and does not retry quota failures across keys.
Actual decryption/key validity/inference remain unverified until deployment.
`gemini-2.5-flash` is explicitly configured, from current official model docs;
model replacement and real availability checks remain operator concerns.

Local checks passed: Gateway build, 96 Gateway/architecture tests and two Node
credential-import tests. Cloud APK Docker/start tooling now supports exact
commit provenance without copying Git history. No Flutter/APK execution is claimed.
Dashboard/call services have not been switched. Continue toward live Gateway,
actual bootstrap/acceptance and private APK delivery. Task 072 remains current.

## DigitalOcean hosting preparation checkpoint (superseded)

The user selected DigitalOcean over Railway/Render and cannot use their Windows
machine. The hosted Alpha must be a separate canonically bootstrapped instance;
never fabricate IDs or overwrite the user's local Alpha. DigitalOcean's September
invoice shows $2.12 of trial credit offsetting Droplet charges. Remaining credit
and expiry are unverified; the user selected **confirm credit first** before
creating a server. No Masanawa Droplet or hosted database has been created.
Existing Nasfam Droplets are outside scope. A public SSH key was registered as
`codex-key-dark-vale-b3d4` (key ID 59808742); no server is attached to it.

Read `infra/deployment/digitalocean/README.md` for the isolated PostgreSQL 18,
canonical bootstrap, HTTPS proxy and cloud APK build recipe. The new R2 adapter
signs private Relationship-scoped grants; live bucket provisioning and Gateway
media custody/integration remain open. Locally, its signing/architecture tests
passed (68 tests) and its build/typecheck passed. Hosting syntax checks passed;
Docker deployment, PostgreSQL acceptance, Flutter and APK checks remain unrun.
Task 072 remains current and this preparation does not close any task gate.

## Task 073 hardening / local verification checkpoint

Branch: `task073-inference-hardening`, based on merged main `193ca46b2ed06ff1ced96dab7cb07ea1425345b0`.
Task 072 remains current; neither Task 072 nor Task 073 is marked COMPLETE.

The inference seam copies/freezes bounded transient input, strips unrelated fields,
validates output and translates errors into safe provider-neutral failure codes.
Gemini credentials are sent in a header rather than URLs; transport/response failures
are redacted and thought parts are excluded. Replacement tests preserve the exact
CharacterSession/CharacterVersion while creating distinct canonical AgentRuns.

Alpha HTTP routes and the mobile transport now use `/v1/agent/...`. Rebuild the
Gateway and APK together. Ops TypeScript 7 blockers, a misplaced Skill-assignment
guard, UUIDv4 route-test fixtures and an unregistered public Ops environment variable
were fixed after real local checks exposed them.

Run `pnpm alpha:verify` with `MASANAWA_TEST_DATABASE_URL` set to the existing local
PostgreSQL 18 instance. The helper checks Gateway/Ops dependency builds/types,
runtime/architecture/contracts and real CharacterSession/AgentRun PostgreSQL acceptance.
It refuses to silently skip database acceptance. `--unit-only` explicitly excludes it.
Do not run bootstrap again just to verify; keep the user's existing generated IDs/token.

Local checkpoint evidence: Node 24.19.0 / pnpm 12.8.2; full workspace typechecking
passed. `alpha:verify --unit-only` passed 131 tests plus relevant dependency
builds/typechecks. The full Vitest run passed 344 tests with 72 database-dependent
tests skipped. No local PostgreSQL, Flutter or APK verification is claimed.
Hosted Actions on recovered main still has zero steps and `runner_id=0`; these
local checks do not close the full acceptance/merged-main gate.


## Task 074 Identity-backed Alpha context checkpoint

On the same open branch, Alpha now requires the PostgreSQL Character context compiler.
It loads the exact published Constitution through Identity's narrow read port, using
current Security policy/revocation checks and Identity lifecycle locks. Session/run
snapshots are reread and compared in one transaction. A newer active CharacterVersion
never replaces the version pinned by an existing CharacterSession. Inference receives
only transient admitted instructions; presentation aliases no longer replace authored
identity. The newer owner-backed recall checkpoint below supersedes the original
Identity-only retrieval composition.

AgentRun reads now permit PostgreSQL share locks by removing an invalid read-only
transaction setting. Query-harness tests cover this regression and context admission;
three additional PostgreSQL 18 acceptance cases are authored, not run here.

Latest local verification: runtime gate passed 152 tests plus Gateway/Ops dependency
builds/typechecks; full Vitest passed 365 tests with 75 database-dependent skips.
Task 072 remains current. Tasks 073/074 remain unchecked. Do not rerun bootstrap or
replace the user's generated IDs/token. Run `pnpm alpha:verify` against the existing
PostgreSQL 18 instance to obtain real database acceptance.

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

## Mandatory read order

1. `README.md`
2. `docs/VISION.md`
3. `docs/PRODUCT-NORTH-STAR.md`
4. `docs/PRODUCT-PROJECT-STRUCTURE.md`
5. `docs/PRODUCTION-MASTER-TASKS.md`
6. `docs/ARCHITECTURE.md`
7. `docs/AGENT-PHONE-EMBODIMENT.md`
8. `docs/TECHNOLOGY.md`
9. `docs/SOURCE-OWNERSHIP.md`
10. `docs/REWRITE-PLAN.md`
11. `docs/migration/LANDSCAPE-EXPANSION.md`
12. `docs/migration/SOURCE-LOCK.md`
13. `references/README.md`
14. `references/SOURCES.md`
15. `docs/migration/FORENSICS-METHOD.md`
16. `docs/migration/FEATURE-LEDGER.md`
17. `docs/migration/BEHAVIOUR-LEDGER.md`
18. `docs/migration/DATA-LEDGER.md`
19. `docs/migration/INTEGRATION-LEDGER.md`
20. relevant files under `docs/migration/sources/`
21. the active phase implementation record named below.

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



## Task 074 owner-backed recall checkpoint (acceptance remains open)

The context compiler now asks Memory's narrow read port for lexical recall scoped
only to the current Relationship. Text and optional media captions supply a bounded
transient query; media bytes are not converted into memory. Memory owns ranking,
current-revision selection, expiry filtering and evidence provenance. No conversation
transcript is persisted as Memory. Alpha explicitly grants the scoped read capability.

World's narrow read port admits only explicitly authorized World IDs, current approved
public events, and the exact pinned CharacterVersion (or World-wide events). Alpha
does not automatically grant World scopes. Private events and other Character versions
are rejected. Agents compose bounded transient evidence and recheck current authority
after both readers finish. Identity, Memory and World remain the canonical owners.

Local focused verification passed 199 tests and the Gateway dependency build. These
query-harness checks do not replace PostgreSQL acceptance or mobile device testing.
Task 072 remains the current numbered production task; Tasks 073/074 stay open.
The Gateway is intended for Railway; APK builds can run separately on DigitalOcean
or Render. No hosted deployment or APK build is implied by this checkpoint.

Broader checkpoint verification: 388 tests passed, 75 database-dependent tests
skipped; root TypeScript compilation passed. No skipped test is a passing acceptance gate.


## Task 074 PostgreSQL recall acceptance preparation

Two real PostgreSQL 18 journeys now seed canonical Memory plus its active lexical
projection, and authored World events. They verify Relationship isolation, explicit
read capabilities, approved public canon, draft/private exclusion, and World scope
isolation through the actual context compiler. These tests use a disposable database
created by the existing AgentRun acceptance harness, not the user's Alpha database.
They are authored and typechecked, but have not run against PostgreSQL here.

Acceptance preparation exposed and fixed a World SQL parameter mismatch: canonical
World IDs are text columns, so the admitted-ID array is cast to text[] rather than
uuid[]. The query-harness regression now checks this storage-compatible cast.

The runtime verification command now includes Memory and World owner unit tests.
`pnpm alpha:verify --unit-only` passed 214 tests plus Gateway/Ops builds and all
relevant typechecks. Full Vitest passed 388 tests with 77 database-dependent skips.
Task 072 remains current; PostgreSQL acceptance, merged-main CI and mobile gates
remain open. No deployment or APK was built by this checkpoint.


## Task 075 run-bound Skill/Tool selection preparation (not complete)

Agents now prepares a transient selection through Skills' narrow selection source.
It requires explicit agents.skill.select authority, matching Character assignment
and selected session SkillVersion, an active session and running bound AgentRun.
Assignment/session references constrain selection but never grant capabilities.

Skills owns exact dependency revision pins, model advertisement and current
readiness. Every dependency's authority requirements are checked. Tools remain
in the one Tool registry; selection resolves only declared references and exact
ToolVersion IDs, honors declared pins, rejects duplicate/extra selections and
requires explicit choices for provider-neutral capability references. Graphs and
selected references are bounded to 64. Agents imports Skills, not Tools directly.

After asynchronous current-policy/revocation checks, Agents rechecks time/access
and Skills eligibility. Changed graph pins or expired sessions deny preparation.
Confirmation requirements are metadata only: no approval, Tool invocation, provider
choice, side effect, receipt or durable execution truth is produced. Gateway Alpha
has not been wired to this source and is not granted the new selection capability.
Consumers must supply owner-admitted durable snapshots and current assignments;
this helper does not replace durable admission or Task 080 stale-result fencing.

Verification: 21 new selection tests cover graph readiness, exact pin enforcement,
undeclared/duplicate Tool references, explicit Skill/Tool capabilities, assignment
and session binding, revocation, expiry and graph changes. The expanded runtime
gate passed 316 tests plus Gateway/Ops builds/typechecks; full Vitest passed
409 tests with 77 database-dependent skips. Task 072 remains current; Tasks
073–075 remain open. Latest pre-checkpoint GitHub Actions on 590deea had zero
steps and runner_id=0 for both Foundation CI and Mobile Build. No PostgreSQL
acceptance, hosted inference or APK/device verification is claimed.


## Task 075 durable selection admission and Gateway custody checkpoint

The PostgreSQL selection adapter now rereads CharacterSession and AgentRun
snapshots, locks the current Character assignment, and rejects changed custody
before preparing anything. Skills owns a bounded exact graph reader: only the
selected root/dependencies are loaded, definition hashes are checked, current
readiness rows are locked, and graphs over 64 versions fail closed. Assignment,
Skill versions/readiness and current Security/Identity custody stay in their
owning schemas within one repeatable-read transaction. No selection writes occur.

Gateway conversation composition accepts this admission port and supplies text
and media strategies an optional run-bound prepareSkillSelection callback. The
callback takes only exact Skill/Tool choices; caller-supplied authority or assignment
cannot replace Gateway custody. It closes on strategy return/failure and rejects
both retained calls and in-flight results that arrive after the strategy turn ends.
Provider adapters still receive inference input only. No tool action, approval,
receipt or completed side effect is inferred from preparation. This local callback
lifecycle guard does not complete Task 080 cancellation/supersession.

Default Alpha has no executable Tool catalog composition and does not receive
selection authority automatically. Actual Skill execution integration remains
open. One new PostgreSQL 18 journey is authored/typechecked to verify current
assignment/readiness changes; it has not run here. Eleven admission query-harness
tests and two Gateway journeys verify custody, locks, hash/readiness rejection,
capability checks, callback lifetime and text/media binding.

Verification: expanded runtime gate passed 329 tests plus Gateway/Ops builds and
relevant typechecks. Full Vitest passed 422 tests with 78 database-dependent skips.
Task 072 remains current; Tasks 073–075 are not complete. No PostgreSQL acceptance,
hosted deployment, Flutter/APK build or device test is claimed.


## Task 076 bounded inference-attempt checkpoint (not complete)

Agents now owns normalized per-attempt inference limits: default 60-second
deadline, 2,048 requested output tokens and 16,000 output characters. Invalid
limits fail before dispatch; the hard supported ceilings are 120 seconds, 8,192
requested output tokens and 128,000 characters. Alpha strategy captures limits
at composition, so configuration changes cannot expand an admitted attempt.

The common inference boundary races generation against a deadline, aborts the
provider signal, cleans up timers and rejects late responses even when an adapter
ignores cancellation. A monotonic elapsed-time check rejects results beyond the
deadline before a delayed timer callback runs. Output over the configured bound
fails admission. Safe typed errors are inference.deadline_exceeded and
inference.output_limit_exceeded; raw vendor errors remain redacted.

Gemini receives the abort signal and exact output-token ceiling through both the
single-key adapter and credential pool. The inference envelope still contains
only system instructions and transient input. There are no automatic retries
or credential cycling after a timeout. Text/media Gateway journeys verify that
the deadline is recorded through the existing failed AgentRun transition.

These are attempt guards, not full durable AgentRun budgets, cost/usage accounting
or Tool/multi-step limits. A token ceiling requested from an adapter is not a
measured provider usage or billing receipt. Task 076 is not complete, and Task 072
remains current. No PostgreSQL acceptance or mobile/cloud deployment is claimed.

Verification: runtime gate passed 344 tests plus Gateway/Ops builds/typechecks.
Full Vitest passed 437 tests with 78 database-dependent skips. Fifteen new checks
cover invalid limits, hung providers, abort/error redaction, cleanup, late results,
output bounds, control forwarding and text/media failed-run custody.
