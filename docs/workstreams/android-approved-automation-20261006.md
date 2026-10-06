# Approved Android app/browser/notification automation — Task 129

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/android-approved-automation-20261006`
Base: Task 124 PR #253 @ `d9ef72c7712735698c849db0f7fb28c7fae51015`
Production task: 129 — approved mobile app/browser/notification automation capabilities.

## Coordination

Tasks 124–128 are active in PRs #253/#256/#257/#255/#258. No competing Task 129 implementation claim existed at selection. This lane adds separate adapter-local contracts and does not modify those owners.

## Exact owned paths

- `docs/workstreams/android-approved-automation-20261006.md`
- `adapters/devices/android/src/approved-automation.ts`
- `tests/contracts/android-approved-automation.test.ts`

## Explicitly excluded/shared paths

- Tasks 124–128 files
- consumer Flutter/mobile and PR #136
- Android packaging/manifest/Accessibility implementation
- Gateway/Worker/Ops/Presence
- canonical Security policy/approval state
- DeviceOperation queue/storage
- migrations, manifests, lockfile, production config
- arbitrary shell/root commands, JavaScript execution, coordinate tapping or broad Accessibility scripting

## Acceptance target

- only four bounded primitives in this launch slice: app launch, HTTPS browser navigation, notification observe, notification text reply;
- every command carries canonical Tenant/Device/Operation/AuthorityContext identity plus exact policy revision;
- server-projected allowlists constrain package IDs and browser hosts;
- notification reply additionally requires an explicit canonical ApprovalId when policy requires it;
- no caller-supplied policy can expand itself: adapter receives a separately injected/current policy snapshot;
- stale policy revision, wrong Tenant/Device, unavailable capability, unallowlisted target or missing approval fails before the platform edge;
- this lane stops at a bounded execution plan; it does not perform native automation itself;
- the later native executor must preserve canonical DeviceOperation custody/reconciliation and treat observations/results as bounded transport evidence only.

State: IMPLEMENTING. Bounded current-policy automation admission/planning plus focused contract tests are committed. Native execution, Accessibility/browser/app adapters, observation custody and shared production composition remain excluded.

Implementation head before handoff: `fe83a5f79ec087f150d4a8a4306f2b03a2e037dd`.

Last update: 2026-10-06.
