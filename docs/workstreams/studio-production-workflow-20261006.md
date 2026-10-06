# Studio production workflow — Task 136

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/studio-production-workflow-20261006`
Base: Task 135 PR #264 @ `28742014b461f12b89e2b4ed12cff96bb54c2474`
Production task: 136 — script/storyboard/render/voice/lipsync production workflow.

## Coordination

Task 135 is owned by PR #264. No competing Task 136 implementation claim was found at selection. This lane adds only new Studio workflow files and does not modify Task 135-owned files.

## Exact owned paths

- `docs/workstreams/studio-production-workflow-20261006.md`
- `packages/studio/src/production-workflow.ts`
- `packages/studio/src/production-workflow.test.ts`

## Explicitly excluded/shared paths

- Task 135 model/invariant/provenance files
- provider SDKs and credentials
- Gateway/Worker/Ops/mobile/Admin
- media adapters/render engines
- storage migrations/adapters
- lockfile/root workspace integration
- Social publishing and Commerce settlement

## Acceptance target

- canonical ordered stages: script -> storyboard -> visual render + voice -> lipsync/final render;
- each stage consumes immutable exact artifact revisions from Task 135;
- every stage has a stable deterministic idempotency key and explicit required output artifact kind;
- workflow cannot skip unmet dependencies or mutate source artifacts;
- provider/runtime dispatch stays outside the domain;
- retry after failed-before-effect may reuse stage identity, but ambiguous/unknown effect requires reconciliation before redispatch;
- completed stages are immutable and terminal;
- final delivery references a finalized immutable video artifact.

State: ISOLATED COMPLETE / INTEGRATION READY.

## Completed implementation

- added deterministic Studio production stage graph: script -> storyboard -> visual-render + voice -> lipsync;
- every stage consumes exact immutable Task 135 artifact revisions and records the expected output artifact kind;
- stable dispatch keys bind Tenant, Project, Character, plan/stage revision, OperationId, exact inputs and output kind;
- stage dispatch is revision-fenced;
- failed-before-effect can be retried safely with a new canonical Operation;
- ambiguous dispatch enters terminal-for-retry `unknown` until explicit reconciliation evidence completes it;
- completed stages are immutable and unlock only their declared dependents;
- stage completion rejects wrong output kind, cross-scope outputs and missing parent provenance;
- final delivery resolves only from a completed immutable lipsync video artifact;
- provider/runtime SDK dispatch remains outside the Studio domain.

## Remaining integration dependencies

1. Task 135 public export owner must append the workflow module to the Studio package barrel when ownership is available.
2. Worker/Workflow owner must persist/execute stage plans and canonical Operations.
3. Provider/media adapter owners must implement script/render/voice/lipsync execution behind bounded adapters.
4. Unknown-effect reconciliation must query provider receipts before any redispatch.
5. storage/lockfile/shared composition remain integration-owner work.

Implementation head before handoff: `0875ce7a790e3f7dc1a31832fca96d9c6dce60a8`.

Last update: 2026-10-06.
