# Social draft/approval/publish/outbox/receipt/retry journey — Task 132

Owner/window: current ChatGPT continuation window — Task 132
Branch: `work/social-publication-journey-20261006`
Base SHA: `3e8c13a3aa3deaa62b1016e12915232d0303644a` (Task 131 PR #261 exact head)
Production task: 132 — social draft/approval/publish/outbox/receipt/retry journey.
PR: #263
Implementation head before this handoff update: `6c9a6c5ab096e9dbc4b2570065a2fa2b6021213a`

## Exact owned paths

- `packages/social/src/publication.ts`
- `tests/recovery/social-publication-journey.test.ts`
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

## Completed isolated publication journey

- consumes only Task 131 `ready` SocialContent plus the exact active SocialAccountBinding;
- freezes one canonical PublicationId to exact SocialContentId, content revision, Character/account and audience;
- approval-required publications accept only already-verified canonical ApprovalId evidence bound to the exact publication/content revision/account/policy revision;
- every dispatch attempt gets one monotonic attempt number, unique OutboxEventId and deterministic idempotency key;
- dispatch claim is fenced by exact publication revision + attempt and rejects stale/mismatched claims;
- explicit provider success yields bounded external publication receipt/reference evidence;
- retryable provider rejection enters `retryable-failure` and any retry receives a new attempt/idempotency key;
- terminal rejection enters `failed`;
- ambiguous provider outcome enters `unknown` and cannot be auto-queued or blindly retried;
- `unknown` may reconcile directly to `published` without redispatch, or to confirmed `not-published` before retry becomes legal;
- exact receipt replay is idempotent; changed/conflicting receipt replay fails closed;
- archived Task 131 content cannot start a publication;
- provider credentials/raw provider response payloads never become canonical Social publication state.

## Changed-file audit

Compare against Task 131 exact head reports:
- 3 commits ahead;
- 0 commits behind;
- exactly these three owned files:
  1. `docs/workstreams/social-publication-journey-20261006.md`
  2. `packages/social/src/publication.ts`
  3. `tests/recovery/social-publication-journey.test.ts`

No Task 131-owned source, Security, Events, provider adapter, Gateway/Worker/Ops/mobile, migration, lockfile or production-config path changed.

## Verification

Foundation CI run `37459424550` on implementation head `6c9a6c5ab096e9dbc4b2570065a2fa2b6021213a` completed as `failure`, but its only job `112254985235` has `steps = null`. Checkout/install/typecheck/tests/build never executed. This is runner-allocation/non-execution evidence, not an application failure and not a test pass.

No executable local checkout is available in this connector-only window, so no fabricated local typecheck/test/build result is claimed.

## Remaining Task 132 integration dependencies

- export the publication API from the Social package only after Task 131/package integration owner permits shared `src/index.ts` editing;
- persist Publication/outbox/receipt state behind a durable repository under explicit migration ownership;
- inject verified Security approval evidence rather than trusting caller-created approvals;
- compose durable Events outbox/Worker dispatch and external social provider adapters;
- reconcile provider status/receipts into the publication state machine without blind retry;
- add the Social package lockfile importer through the active shared lockfile owner (#98 or successor).

## Current state

**ISOLATED PUBLICATION/RECOVERY STATE MACHINE COMPLETE / INTEGRATION READY AFTER TASK 131 EXPORT + PERSISTENCE/OUTBOX/PROVIDER COMPOSITION.**

No further isolated implementation remains in this claimed three-file Task 132 slice.
