# Canonical social identity/account/content state workstream

Owner/window: current ChatGPT continuation window — Task 131
Branch: `work/social-identity-content-state-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Task reference: `docs/PRODUCTION-MASTER-TASKS.md` — Task 131.
Architecture references: `docs/SOURCE-OWNERSHIP.md`, `docs/IMPLEMENTATION-TEMPLATES.md`.
PR: #262
Implementation head before this handoff update: `b5d73629968b6ae8fb76ec1189815b9cda58a240`

## Exact owned paths

- `packages/social/**`
- `tests/contracts/social-domain.test.ts`
- `docs/workstreams/social-identity-content-state-20261006.md`

## Explicitly excluded/shared paths

- `pnpm-lock.yaml` — active shared importer ownership remains PR #98;
- Gateway/Worker/Ops services and PR #136;
- external Facebook/Instagram/X/LinkedIn/TikTok/YouTube adapters/credentials;
- Task 132 publish/outbox/receipt/retry orchestration;
- Commerce/Event canonical state;
- migrations/PostgreSQL persistence;
- consumer social feed/comments/follower subsystem;
- Character/Identity package internals.

## Completed implementation

- added a canonical `@masanawa/social` workspace-package shape matching the repository manifest/build template;
- tenant-scoped social account bindings are tied to one canonical Character and bounded provider external-account reference;
- provider access/refresh tokens, client secrets and raw credential material are not Social domain state;
- deterministic social account keys preserve stable provider-account identity;
- account lifecycle is optimistic-revisioned `active -> suspended/revoked`, `suspended -> active/revoked`, with terminal revoke;
- SocialContent is pinned to canonical SocialContentId + Character + CharacterVersion identity;
- content revisions are append-only immutable values with bounded body/language/media/target-account metadata;
- content must contain text or media and must target one or more unique account bindings;
- legal content-state transitions are explicit: draft/approval-required/approved/publication-pending/published/failed/withdrawn;
- repository port defines durable ownership without inventing a separate service;
- reference in-memory repository provides deterministic create replay, optimistic revision checks and revision history;
- content creation/revision/approval/publication-pending rechecks that every target account is active and bound to the same Character;
- cross-Character target attempts, revoked/suspended targets, stale revisions, illegal lifecycle shortcuts and identity-changing replay fail closed.

## Changed-file audit

Compare against current `main` reports:
- 8 commits ahead;
- 0 commits behind;
- exactly 8 claimed files under `packages/social/**`, the contract test and this workstream document;
- no lockfile, service, adapter, migration, Commerce/Event or #136-owned path changed.

## Verification

Foundation CI run `37458704360` on implementation head `b5d73629968b6ae8fb76ec1189815b9cda58a240` completed as `failure`, but its only job `112252552783` has `steps = null`. Checkout/install/typecheck/tests/build never executed. This is runner-allocation/non-execution evidence, not an application failure and not a test pass.

No executable local checkout is available in this connector-only window, so no fabricated package typecheck/test/build result is claimed.

## Remaining Task 131 integration dependencies

- add the `packages/social` importer to `pnpm-lock.yaml` through the active shared lockfile owner (#98 or its successor);
- add production PostgreSQL persistence behind the SocialRepository port under explicit migration ownership;
- compose Social in Worker/Ops only after canonical package/lockfile integration;
- external provider account-linking/credential adapters remain adapter/Security ownership;
- Task 132 owns approval/publish/outbox/receipt/retry orchestration.

## Current state

**ISOLATED DOMAIN IMPLEMENTATION COMPLETE / INTEGRATION READY AFTER SHARED LOCKFILE + PERSISTENCE COMPOSITION.**

No further isolated implementation remains in Task 131's claimed domain paths.
