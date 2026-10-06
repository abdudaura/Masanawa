# Perception-to-memory promotion governance — Task 117

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/perception-memory-promotion-20261006`
Base SHA: `4b02adb6fe7a843892794273c5fa2c8a702705f4` (Task 112 perception stack / PR #237)
Implementation head: `8c9517d04321761a15e15e831a4de8d60fde182f`
PR: #245

## Completed implementation
- Added explicit perception-to-memory promotion review decision contract.
- Promotion requires durable source retention plus `review-required` memory-promotion policy.
- Promotion requires explicit `memory-promotion` purpose evidence.
- Review must be explicit approve/deny with reviewer and AuthorityContext identity.
- Relationship-scoped perception can promote only to the same Relationship; Character-private only to the same Character-private scope.
- User-private perception fails closed because no canonical user-private Memory destination exists.
- No automatic Memory write is performed; output is a governance decision only.
- Root contract tests cover allow/deny, privacy widening, review denial and purpose requirements.

## Changed-file audit
Exactly three files:
1. `docs/workstreams/perception-memory-promotion-20261006.md`
2. `packages/perception/src/memory-promotion.ts`
3. `tests/contracts/perception-memory-promotion.test.ts`

No Memory implementation/repository, Gateway, storage, migrations, package manifests/lockfile or production paths changed.

## Verification
Foundation CI run `37455234631`, job `112241093626` ended `failure` with `steps = null`; checkout/install/tests never executed. Not a pass and not application-failure evidence.

## Remaining dependencies
- PR #237/#234/#232/#228 perception stack integrates first.
- Memory owner converts allowed decisions into canonical Memory commands/persistence.
- Production acceptance must verify no bypass around this governance boundary.

## Current state
**ISOLATED COMPLETE / INTEGRATION READY.**

No further isolated implementation remains in this lane.
