# Social draft/approval/publish/outbox/receipt/retry journey — Task 132

Owner/window: current ChatGPT continuation window — Task 132
Branch: `work/social-publication-journey-20261006`
Base SHA: `3e8c13a3aa3deaa62b1016e12915232d0303644a` (Task 131 PR #261 exact current head)
Production task: 132 — social draft/approval/publish/outbox/receipt/retry journey.

## Exact owned paths

- `packages/social/src/publication.ts` (new)
- `tests/recovery/social-publication-journey.test.ts` (new)
- `docs/workstreams/social-publication-journey-20261006.md`

## Explicitly excluded/shared paths

- Task 131-owned `packages/social/src/index.ts`, `model.ts`, `social.ts`, package/build files;
- Security approval repository/decision execution;
- Events canonical outbox implementation;
- external social provider adapters/credentials;
- Worker/Gateway/Ops/mobile and PR #136;
- migrations/PostgreSQL persistence;
- `pnpm-lock.yaml` shared owner #98;
- social account/content identity mutation.

## Implementation boundary

- consume only Task 131 `ready` SocialContent bound to its exact active SocialAccountBinding;
- exact content revision/account/audience binding is frozen into one canonical PublicationId;
- approval evidence is accepted only as already-verified canonical ApprovalId evidence and must exactly match publication/content/account;
- publication outbox item carries deterministic idempotency identity and attempt custody;
- dispatch claim is fenced by expected attempt/revision;
- explicit provider success produces bounded receipt metadata;
- pre-effect rejection may become retryable according to explicit retry disposition;
- ambiguous/unknown provider outcome is never auto-retried and requires reconciliation;
- exact provider receipt replay is idempotent; conflicting replay fails closed;
- Social never stores provider credentials or raw provider payload as canonical state.

State: CLAIMED. Implement the isolated Task 132 state machine/recovery contracts; public package export, persistent outbox and provider composition remain integration dependencies.
