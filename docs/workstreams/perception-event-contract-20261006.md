# Canonical permission-scoped PerceptionEvent — Task 109

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/perception-event-contract-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Implementation commit: `2ac0ca9233020ea637080d491c2f1c89f1308ec9`
PR: #228

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **109** Implement normalized permission-scoped PerceptionEvent.
- `docs/SOURCE-OWNERSHIP.md` — `packages/perception` owns canonical PerceptionEvent; device nodes remain adapters.

## Owned paths
- `packages/perception/src/perception-event.ts`
- `packages/perception/src/index.ts`
- `tests/contracts/perception-event.test.ts`
- `docs/workstreams/perception-event-contract-20261006.md`

## Excluded/shared paths
- No edits to `packages/contracts`, root package/lockfile/workspace config, Gateway, devices, channels, memory, migrations, production environment or PR #136-owned paths.
- No package-manifest activation in this slice, because adding a new workspace importer would require shared `pnpm-lock.yaml` ownership.

## Completed implementation
- Added schema-versioned normalized PerceptionEvent contract with event/tenant/source/subject/dedupe/timestamp fields.
- Added source kinds for app/channel/device/system and normalized perception kinds covering text/files/documents/media/device/sensor inputs.
- Added explicit permission evidence: authority context, policy revision, permission basis and bounded purposes.
- Device, channel and system sources fail closed unless their required permission basis is present.
- Added user/Relationship/Character subject scope with Relationship+Character coherence.
- Added privacy scope, retention class and memory-promotion policy.
- Ephemeral perception can never be promoted to memory; durable promotion remains review-required rather than automatic.
- Added bounded payload descriptor with exactly one inline-content or content-reference locator plus bounded metadata.
- Added timestamp normalization/order validation and deterministic purpose checks.
- Added root contract coverage for all permission/privacy/source invariants.

## Changed-file audit
Exactly four files:
1. `docs/workstreams/perception-event-contract-20261006.md`
2. `packages/perception/src/perception-event.ts`
3. `packages/perception/src/index.ts`
4. `tests/contracts/perception-event.test.ts`

No shared Gateway/device/channel/contracts/lockfile/migration/production files changed.

## Verification
GitHub Actions Foundation CI run `37453688452`, job `112236018564` ended `failure` with `steps = null`. Checkout/install/typecheck/tests never executed. This is not recorded as a pass and provides no application failure evidence.

The contract is also exercised from the root `tests/contracts` suite so, once runners execute normally, it does not depend on activating a new workspace importer first.

## Remaining dependencies
- Workspace integration owner: add the Perception package manifest/build/export and corresponding lockfile importer when shared root dependency ownership is available.
- Task 110-112 owners: normalize text/file/document and device/sensor inputs into this canonical event.
- Security/authority owner: supply authenticated AuthorityContext and current permission policy; this contract does not mint authority.
- Persistence/Memory owner: store admitted events and perform separately governed memory promotion.

## Current state
**ISOLATED COMPLETE / INTEGRATION READY.**

No further isolated implementation remains in this lane.
