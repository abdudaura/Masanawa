# Core Teaching multi-select durable scope hardening — 2026-10-06

Status: active reclaimed Teaching runtime slice
Owner/window: ChatGPT continuation window
Branch: `work/teaching-multiselect-scope-20261006`
Base: stale adaptive Teaching PR #297 @ `12a071f0f435ad29b8ed715ca72ec97917a864a1`

## Problem

PR #215 intentionally refused to persist staged multi-select state because
`TeachingMultiSelectStagePort` is keyed only by actionKey/bindingHash and lacks canonical
Relationship/SkillVersion/pending-request scope. Persisting that contract would risk
cross-Relationship action collisions.

## Exact owned paths

- `packages/skills/src/teaching-runtime.ts` — stage storage scope only
- `packages/skills/src/teaching-runtime.test.ts` — focused scope assertions
- `docs/CORE-TEACHING-MULTISELECT-CUSTODY.md` (new)
- `docs/workstreams/teaching-multiselect-scope-20261006.md`

## Boundaries

- no Gateway/app/mobile/channel/storage/migration/shared export changes;
- no change to selectable rubric/evaluation/progress semantics;
- no new Teaching runtime;
- tenant remains adapter-constructor scope; the port adds exact Relationship,
  SkillVersion, RequestId, actionKey and bindingHash authority.

## Goal

Make every staged multi-select storage operation carry enough canonical scope for a later
durable adapter to enforce tenant-bound isolation and replay-safe CAS without inferring
ownership from an opaque action key.
