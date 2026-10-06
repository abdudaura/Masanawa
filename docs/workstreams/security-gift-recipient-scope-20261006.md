# Gift recipient Tenant/Character isolation hardening — Production Task 145

Owner/window: ChatGPT continuation window / 2026-10-06
Lease acquired under the five-minute stale-claim rule.
Branch: `work/security-gift-recipient-scope-20261006`
Base main: `8648c5f524108d825fa52e3a7f735675dd8b78f7`
Task: Production Task 145 — security review, abuse cases and Tenant isolation.

## Security finding

`createGiftRecipientResolver` trusted the injected `CharacterOwnershipReader` to return
the exact requested Tenant + Character. The resolver checked owner/kind/self-gift but did
not verify returned `tenantId` or `characterId`.

A faulty, stale or compromised reader could therefore substitute another personal Twin
record and redirect gift recipient resolution across Tenant or Character scope.

## Exact owned paths

- `docs/workstreams/security-gift-recipient-scope-20261006.md`
- `services/gateway/src/gift_recipient.ts`
- `services/gateway/src/gift_recipient.test.ts`

## Explicitly excluded

- Gateway composition/routes
- active unrelated mobile/teaching/golden-journey leases
- Commerce ledger/repositories/migrations
- production environment/credentials
- Gift executor and Wallet/Event composition

## Acceptance

- returned ownership Tenant must equal requested Tenant;
- returned ownership Character must equal requested Character;
- cross-Tenant substitution fails before recipient projection;
- same-Tenant different-Character substitution fails before recipient projection;
- existing personal-Twin owner resolution/self-gift/non-personal behavior remains intact.

State: CLAIMED.

Last update: 2026-10-06.
