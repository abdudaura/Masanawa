# Channel possession linking challenge — 2026-10-06

Status: active reclaimed Identity/channel slice
Owner/window: ChatGPT continuation window
Branch: `work/channel-link-challenge-20261006`
Base: stale PR #231 head `6acb897b02f4928a5ea67d2053b2368c8d3bc80c`

## Reclaimed context

PR #231 is stale under the repository five-minute lease rule. Its ChannelAccount and
UserChannelBinding lifecycle is preserved unchanged. This slice continues the missing
proof mechanism for the existing `channel-possession-challenge` proof method.

## Exact owned paths

- `packages/identity/src/channel-link-challenge.ts` (new)
- `packages/identity/src/channel-link-challenge.test.ts` (new)
- `packages/identity/src/index.ts` (single export only)
- `packages/identity/src/channel-link-coordinator.test.ts` (new)
- `packages/identity/src/channel-link-coordinator.ts` (new)
- `docs/CHANNEL-LINK-CHALLENGE.md` (new)
- `docs/workstreams/channel-link-challenge-20261006.md`

## Boundaries

- no Gateway/channel adapter/storage/migration/mobile/Commerce/deployment edits;
- raw challenge secrets are returned only at issuance and never stored in challenge state;
- the challenge is bound to Tenant + ChannelAccount + channel + canonical User;
- incoming transport evidence must still be authenticated by the channel adapter;
- successful proof produces only a canonical `ChannelBindingProof` for the existing
  lifecycle; activation still happens through `activateChannelBinding()`;
- durable compare-and-set and rate limiting remain repository/Gateway responsibilities.

## Goal

Implement a bounded, replay-safe possession challenge with:
- high-entropy opaque secret validation;
- SHA-256 secret custody;
- expiry and maximum-attempt enforcement;
- revisioned immutable state transitions;
- exact channel/account scope checks;
- one-time successful proof;
- redacted failure semantics suitable for WhatsApp/Telegram linking.


## Implementation checkpoint

Implemented on draft PR #307.

Exact head: `d30aa0099c74743b69ad5a7ab9f6ad2396c08971`.

Completed:
- one-time secret issuance with only a scoped SHA-256 hash retained in durable challenge state;
- Tenant/User/ChannelAccount/channel/Request scope binding;
- exact expiry semantics and bounded attempt lockout;
- revision-based stale writer rejection;
- timing-safe secret verification;
- exact successful replay for the same external subject;
- fail-closed replay for another subject/secret;
- canonical `ChannelBindingProof` output for the existing activation lifecycle;
- focused tests for scope hashing, success/replay, lockout, expiry, stale revisions,
  substitution, pre-creation attempts, low-entropy secret rejection and secret redaction;
- Identity barrel export and operator/integration documentation.

Verification:
- PR #307 is mergeable and changes only the five claimed files.
- Foundation CI run 37492501596 produced no downloadable job log. This is the same
  repository-wide runner/non-execution failure and is not a test verdict.

Remaining integration:
- durable challenge CAS/repository custody;
- authenticated issuance endpoint for signed-in users;
- channel ingress lookup of the challenge + pending binding;
- activation through existing `activateChannelBinding()`;
- account/user/IP issuance + verification rate limits.


## Active continuation

This lease is renewed to add the durable challenge custody/coordinator port. The coordinator
will remain Identity-only and require adapters to provide create/load/compare-and-set; it
will not add a database table or Gateway endpoint.


## Durable custody continuation complete

The same PR now also includes:
- `ChannelLinkChallengeRepository` with create/load/compare-and-set only;
- `ChannelLinkChallengeCoordinator.issue()` using RequestId as durable issuance replay key;
- verification that always reloads current state before evaluating the secret;
- persisted failed-attempt/lock/expiry transitions before returning rejection;
- persisted verified transition before returning a proof;
- exact verified replay with no second CAS;
- fail-closed repository-state echo validation;
- focused concurrency/replay tests including stale CAS rejection.

Current PR head before this handoff update: `30ba5d83e2cf99fef1ce307f3ac904181937e421`.
