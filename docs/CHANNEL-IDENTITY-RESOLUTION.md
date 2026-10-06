# Proof-backed channel identity resolution

Status: Identity-domain implementation.

## Rule

An authenticated WhatsApp or Telegram webhook proves transport origin only. It does not,
by itself, identify a Masanawa User.

`createChannelIdentityResolver()` resolves an external channel subject only through the
canonical ChannelAccount/UserChannelBinding repository boundary.

Resolution succeeds only when:

- the requested ChannelAccount exists in the requested Tenant;
- the account is active and matches the exact WhatsApp/Telegram channel;
- a binding exists for that exact account + external subject;
- the binding belongs to the same Tenant/account/channel;
- the binding is active;
- the binding carries explicit account-link proof.

The result contains canonical UserId plus the binding revision and proof evidence reference.
It does not create a Relationship, Character session or new identity.

## Fail-closed behavior

The resolver returns an explicit unlinked result for:

- missing channel account;
- disabled/revoked or cross-channel account;
- missing subject binding;
- pending/revoked/mismatched/unproven binding.

Repository/storage failures are **not** converted to unlinked. They propagate so the
Gateway can return retryable infrastructure failure instead of inviting a user to relink
an account whose identity store is temporarily unavailable.

## Integration

After authenticated webhook admission:

1. use the webhook's configured canonical ChannelAccountId;
2. pass the transport-verified external subject to this resolver;
3. proceed to canonical User/Relationship runtime only for `status: resolved`;
4. for `status: unlinked`, offer the account-link challenge flow rather than assigning
   transport identity directly to a User;
5. never allow provider usernames, phone numbers or Telegram ids to become canonical UserId
   without a proof-backed binding.

This contract deliberately has no provider credential, Gateway route or storage
implementation.
