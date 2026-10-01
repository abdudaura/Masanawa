# Phase 0B Remediation

Status: ACTIVE

## Why this exists

The first Phase 0B passes incorrectly treated top-level/root classification as exhaustive coverage. That was too weak for a rewrite whose main risk is silently losing behavior or preserving the wrong authority boundary.

The following source statuses are therefore reopened:
- ChatWithStars
- OpenJarvis
- N.E.K.O
- CyberVerse

No later source may be declared covered using the old standard.

## Required evidence per capability family

Each family must include:
1. exact implementation paths;
2. exact test/acceptance paths;
3. durable data/state paths and Data Ledger IDs, or explicit statelessness;
4. Integration Ledger IDs and auth/retry/idempotency/reconciliation treatment where external systems exist;
5. A/B/C classification;
6. one canonical Masanawa owner;
7. acceptance/parity gate stated as observable behavior;
8. license/provenance disposition;
9. unresolved items.

## Source completion gate

A source is covered only when all meaningful descendant families are represented and unresolved items are zero. A generic statement such as “remaining utils map to existing families” is insufficient.

## Remediation order

1. ChatWithStars — active; descendant runtime/domain evidence now captured in `coverage/CHATWITHSTARS.md`; migration and integration matrices remain.
2. OpenJarvis — next after ChatWithStars closure.
3. N.E.K.O.
4. CyberVerse — clean-room behavior-only proof plus independent third-party model provenance.
5. Continue the remaining 13 sources under the corrected standard.

## Rules added by remediation

- Do not count a root as evidence for its descendants.
- Do not count a filename alone as behavioral proof when the behavior is consequential.
- Do not mark a provider “analysed” until failure/retry/ambiguous-outcome behavior is understood.
- Do not mark a database root “covered” until migration families and orphan migrations are accounted for.
- Do not infer third-party asset/model rights from the parent repository license.
- Do not advance `CONTINUE-HERE.md` to the next donor merely because a table row exists.
