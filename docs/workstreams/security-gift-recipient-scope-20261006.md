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

State: IMPLEMENTED / VERIFICATION PENDING.

## Completed

- resolver now requires returned ownership Tenant to equal the requested Tenant;
- resolver now requires returned ownership Character to equal the requested Character;
- cross-Tenant personal-Twin substitution is rejected;
- same-Tenant different-Character substitution is rejected;
- existing eligible personal-Twin resolution, self-gift rejection and non-personal rejection remain unchanged.

This closes a concrete fail-open trust assumption between Gateway Gift resolution and the injected Identity ownership reader.

Implementation head before handoff: `c09c1aafcffb535a82f3f473b54ddb836d520e31`.

Last update: 2026-10-06.

## Verification

- Verification: Foundation CI run `37491132841`, job `112363850595`, failed before checkout with `runner_id=0` and `steps=[]`; no application test result is claimed.
