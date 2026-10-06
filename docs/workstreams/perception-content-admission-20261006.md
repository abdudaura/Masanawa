# Text/file/document perception admission — Task 110

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/perception-content-admission-20261006`
Base SHA: `050b7249a1b7b5e47786df112af7438097a23150` (Task 109 exact head / PR #228)
Implementation commit: `67f4665aeffcd47fe3ea5a120bfb844924228d3a`
PR: #232

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **110** Implement text/file/document perception admission.
- Depends on Task 109 canonical PerceptionEvent contract from PR #228.

## Owned paths
- `packages/perception/src/content-admission.ts`
- `tests/contracts/perception-content-admission.test.ts`
- `docs/workstreams/perception-content-admission-20261006.md`

## Excluded/shared paths
- No edits to Gateway, channel adapters, mobile upload/chat, storage, media decoders, memory, migrations, package manifests/lockfile, or PR #136-owned paths.
- No duplicate file/document parser or media storage subsystem.

## Completed implementation
- Added text admission with trim/empty/128k bounds and optional normalized language metadata.
- Added file/document admission by canonical content reference only; raw bytes are not copied into PerceptionEvent.
- Added file size ceiling of 25 MiB and bounded filename checks including path-separator rejection.
- Added explicit allow-listed MIME admission and stricter document MIME classification.
- Added deterministic dedupe identity from source kind/source id/upstream event id.
- Preserved source, subject, AuthorityContext permission evidence and privacy state unchanged into Task 109 normalization.
- Task 109 source/permission invariants remain authoritative and cannot be bypassed by content admission.
- Added contract tests for text bounds, PDF documents, generic files, unsupported MIME/size, path traversal, dedupe determinism and permission propagation.

## Changed-file audit
Exactly three files:
1. `docs/workstreams/perception-content-admission-20261006.md`
2. `packages/perception/src/content-admission.ts`
3. `tests/contracts/perception-content-admission.test.ts`

No Gateway/channel/mobile/storage/media/migration/package-manifest/lockfile paths changed.

## Verification
GitHub Actions Foundation CI run `37453895633`, job `112236697284` ended `failure` with `steps = null`. Checkout/install/typecheck/tests never executed. This is explicitly not recorded as a pass and is not application failure evidence.

## Remaining dependencies
- PR #228 / Task 109 must integrate first.
- Workspace integration owner must activate/export `packages/perception` when shared lockfile ownership clears.
- Gateway/channel/mobile/media owners will feed authenticated, stored/decoded inputs into this admission boundary.
- File/document content verification/decoding remains with existing media/provider/storage authorities; this module deliberately does not duplicate it.

## Current state
**ISOLATED COMPLETE / INTEGRATION READY.**

No further isolated implementation remains in this lane.
