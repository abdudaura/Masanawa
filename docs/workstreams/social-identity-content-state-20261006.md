# Canonical social identity/account/content state workstream

Owner/window: current ChatGPT continuation window — Task 131
Branch: `work/social-identity-content-state-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Task reference: `docs/PRODUCTION-MASTER-TASKS.md` — Task 131.
Architecture references: `docs/SOURCE-OWNERSHIP.md`, `docs/IMPLEMENTATION-TEMPLATES.md`.

## Exact owned paths

- `packages/social/**` (new canonical domain package)
- `tests/contracts/social-domain.test.ts` (new)
- `docs/workstreams/social-identity-content-state-20261006.md`

## Explicitly excluded/shared paths

- `pnpm-lock.yaml` — active shared importer ownership remains PR #98;
- Gateway/Worker/Ops services and PR #136;
- external Facebook/Instagram/X/LinkedIn/TikTok/YouTube adapters/credentials;
- Task 132 publish/outbox/receipt/retry orchestration;
- Commerce/Event canonical state;
- migrations/PostgreSQL persistence;
- consumer social feed/comments/follower subsystem (not a product requirement);
- Character/Identity package internals.

## Implementation boundary

- durable-domain contracts for tenant-scoped social account bindings to canonical Character identity;
- provider account identity represented by bounded external references, never access tokens/secrets;
- revision-safe account lifecycle (active/suspended/revoked) with terminal revoke;
- immutable SocialContent revisions and explicit target account bindings;
- bounded text/media/reference metadata with no provider-specific raw payload becoming canonical truth;
- canonical content state vocabulary + legal transitions only; Task 132 owns actual approval/publish/outbox execution;
- repository port plus deterministic in-memory reference implementation for idempotency/revision/invariant coverage;
- no second social service or social feed.

## Current state

CLAIMED. Implement Task 131 package end-to-end within the isolated domain boundary; lockfile importer and production persistence remain shared integration dependencies.
