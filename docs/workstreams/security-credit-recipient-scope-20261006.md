# Credit recipient Tenant/identifier isolation hardening — Production Task 145

Owner/window: ChatGPT continuation window / 2026-10-06
Lease acquired under the five-minute stale-claim rule.
Branch: `work/security-credit-recipient-scope-20261006`
Base main: `8648c5f524108d825fa52e3a7f735675dd8b78f7`
Task: Production Task 145 — security review, abuse cases and Tenant isolation.

## Security finding

`createPlatformCreditRecipientResolver` sends exact Tenant + normalized email/phone to
`PlatformSessionRepository.resolveProfile`, but previously trusted whatever profile the
repository returned. A faulty/stale/compromised repository could substitute a profile from
another Tenant or a different identifier and redirect a Credit transfer.

## Exact owned paths

- `docs/workstreams/security-credit-recipient-scope-20261006.md`
- `services/gateway/src/credit_transfer_recipient.ts`
- `services/gateway/src/credit_transfer_recipient.test.ts`

## Acceptance

- returned profile Tenant must equal requested Tenant;
- returned email/phone must equal the exact normalized identifier used for lookup;
- cross-Tenant substitution fails closed;
- same-Tenant different-identifier substitution fails closed;
- normal email/phone resolution and self-transfer rejection remain unchanged.

State: IMPLEMENTED / VERIFICATION PENDING.

## Completed

- returned PlatformAuthProfile Tenant must match the transfer request Tenant;
- returned profile email/phone must equal the exact normalized lookup identifier;
- cross-Tenant profile substitution is rejected;
- same-Tenant wrong-email substitution is rejected;
- same-Tenant wrong-phone substitution is rejected;
- normal normalized email/phone lookup and self-transfer behavior remain intact.

Implementation head before handoff: `f43d63bb186c80cf87c02b43cf99152014351421`.

Last update: 2026-10-06.

## Verification

- Verification: Foundation CI run `37491437907`, job `112364893112`, failed before checkout with `runner_id=0` and `steps=[]`; no application test result is claimed.
