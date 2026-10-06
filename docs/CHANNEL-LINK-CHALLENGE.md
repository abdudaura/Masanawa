# Channel possession linking challenge

Status: Identity-domain implementation on the reclaimed channel-linking workstream.

## Purpose

Authenticated WhatsApp or Telegram webhook delivery proves that a message came through a
configured transport account. It does **not** prove that the external subject belongs to a
particular Masanawa User.

The existing ChannelBinding lifecycle therefore starts external subjects in
`pending-proof`. This contract implements the launch
`channel-possession-challenge` proof method that can promote that pending binding only
after an already authenticated Masanawa user and the external channel both demonstrate
possession of the same short-lived secret.

## Issuance

`createChannelLinkChallenge()` binds a one-time secret to:

- canonical RequestId;
- TenantId;
- ChannelAccountId;
- WhatsApp or Telegram channel;
- canonical UserId;
- creation/expiry times;
- bounded maximum attempts.

The returned issuance contains the plaintext secret exactly so the authenticated product
surface can show or send it to the user. The durable challenge contains only a scoped
SHA-256 hash. The secret itself must never be stored.

The hash covers all scope fields plus the secret, so copying the same text into another
request/account/channel/user scope cannot satisfy that challenge.

## Verification

`verifyChannelLinkChallenge()` requires:

- the current challenge revision;
- exact channel and ChannelAccount scope;
- transport-authenticated external subject id;
- candidate secret;
- trusted attempt timestamp.

Rules:

- attempts before challenge creation fail;
- the challenge expires at the exact expiry instant;
- incorrect secrets advance a revisioned attempt counter;
- the configured attempt limit locks the challenge;
- correct proof records the exact external subject and returns a canonical
  `ChannelBindingProof`;
- an exact retry after a successful proof returns the same proof with `replay: true`;
- replay with another subject or another secret fails closed;
- verified, locked and expired states never silently return to pending.

The successful proof uses the existing lifecycle method
`channel-possession-challenge`. The caller must still pass that proof into
`activateChannelBinding()`, which enforces the pending binding/account state and durable
revision boundary.

## Persistence and rate limits

This package deliberately does not introduce a new Identity store. Production custody must
persist the challenge with compare-and-set on its revision. The Gateway/account-link owner
must also apply user/account/IP rate limits around issuance and verification.

The durable store should persist only the challenge object. Never persist the issuance
secret, log it, include it in event payloads, or send it to analytics.

## Channel integration

A typical flow is:

1. signed-in Masanawa user chooses “Link WhatsApp” or “Link Telegram”;
2. Gateway issues the scoped challenge and gives the secret to that authenticated user;
3. user sends the secret to the configured Masanawa WhatsApp/Telegram account;
4. authenticated channel ingress resolves the external subject and challenge;
5. verification succeeds through this contract;
6. the returned proof activates the matching pending `UserChannelBinding`;
7. only active proof-backed bindings may route channel traffic to the canonical User.

Transport verification alone must never skip steps 2–6.


## Durable CAS coordinator

`ChannelLinkChallengeCoordinator` defines the required persistence behavior without
choosing a database schema.

The repository port has exactly three operations:

- `create(challenge)`: canonical RequestId is the issuance idempotency key; exact replay
  may return the existing challenge, but changed challenge state under that RequestId must
  fail;
- `load(requestId)`: always reload current state before verification;
- `compareAndSet(requestId, expectedRevision, next)`: atomically persist exactly one
  lifecycle transition and reject stale writers.

The coordinator never returns a newly verified proof or failed-attempt transition until
the returned repository state exactly matches the requested next state. Exact replay of an
already verified challenge requires no second storage mutation.

This is the concurrency boundary required before a real Gateway endpoint can use the
challenge safely across multiple instances.
