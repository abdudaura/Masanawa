# Text/file/document perception admission — Task 110

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/perception-content-admission-20261006`
Base SHA: `050b7249a1b7b5e47786df112af7438097a23150` (Task 109 exact head / PR #228)

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **110** Implement text/file/document perception admission.
- Depends on Task 109 canonical PerceptionEvent contract from PR #228.

## Owned paths
- `packages/perception/src/content-admission.ts` (new)
- `tests/contracts/perception-content-admission.test.ts` (new)
- `docs/workstreams/perception-content-admission-20261006.md`

## Excluded/shared paths
- No edits to Gateway, channel adapters, mobile upload/chat, storage, media decoders, memory, migrations, package manifests/lockfile, or PR #136-owned paths.
- No duplicate file/document parser or media storage subsystem.

## Dependencies
- Upstream transport/media owner supplies bounded decoded text or canonical content reference.
- Task 109 normalizer remains the only PerceptionEvent shape authority.
- Security/authority owner supplies AuthorityContext and current permission evidence.

## Current state
CLAIMED. Implement fail-closed admission for text, file and document inputs, including MIME allow-listing, size/text bounds, source/permission preservation, deterministic dedupe identity, content-reference vs inline-text rules and canonical PerceptionEvent normalization.