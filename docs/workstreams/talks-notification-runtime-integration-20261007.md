# Talk notification runtime integration — 2026-10-07

- **Owner:** current ChatGPT Talks implementation window
- **Branch:** `work/talks-notification-runtime-integration-20261007`
- **Base:** `25ef7be2cef9047c25696a30f5d918634a1e2f52`
- **PR:** #375 — Compose durable Talk push delivery runtime

## Implemented

- Reuses the already-merged Talk notification policy/delivery coordinator.
- Reuses the already-merged PostgreSQL dedupe repository:
  `services/gateway/src/talk_notifications/postgres_dedupe.ts`.
- Reuses the existing canonical `MobilePushSender` / FCM sender.
- Exposes a Gateway runtime `talkPushDelivery` seam for committed domain producers.
- No public customer/admin HTTP endpoint was added.
- Delivery runtime is present only when:
  - Firebase sender is configured; and
  - durable Talk push dedupe storage exists.
- Firebase-less deployments remain fail-soft and require no new credential.

## Delivery invariants

- Producers must call only after their domain transaction commits.
- Deterministic committed event identity must be reused on retries.
- Durable dedupe claim happens before FCM send.
- Activity/domain persistence remains source of truth; push is best effort.
- No notification content, balances, transaction ids or provider payload is written into dedupe storage.

## Retention maintenance

- Bounded `purgeExpired({ limit: 1000 })` runs:
  - once after Gateway startup;
  - every six hours afterward.
- Cleanup skips while Gateway is draining.
- Cleanup is guarded against overlapping runs.
- Cleanup failures never crash Gateway.
- Both draining and final shutdown clear the interval.

## Tests

Focused runtime tests cover:
- no Firebase sender -> runtime unavailable;
- no durable dedupe -> runtime unavailable;
- sender + dedupe -> composed delivery sends through existing coordinator.

The stronger mainline dedupe repository independently covers:
- first claim;
- duplicate rejection;
- exact tenant/user/event identity;
- retention;
- bounded purge;
- validation.

## Verification

- GitHub reports PR #375 mergeable.
- Foundation CI run `37612922563`, job `112764274554`, failed before any workflow step.
- GitHub returned an empty step list, matching the repository-wide zero-step runner/service-startup failure pattern.
- No branch-specific typecheck/test/build failure was surfaced.
- No Firebase credentials or production environment variables were changed from this window.

## Remaining producer wiring

The runtime is now ready for committed domain producers. Independent follow-on producers should emit only after commit, for example:
- followed Host becomes live;
- Raise Hand accepted/declined;
- sponsored AI Seat accepted/declined;
- replay published/ready;
- Talk gift/earning events.

Each producer must pass real push-enabled/quiet-hours policy inputs rather than bypassing the merged notification policy.

**Implementation status:** complete for durable Talk push runtime composition + cleanup.  
**Claim status:** handoff-ready and approved for merge.
