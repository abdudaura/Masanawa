# Twin legacy compatibility migration claim

Status: ready for integration
Owner/window: ChatGPT twin-transformation continuation
Branch: `work/twin-legacy-compatibility-20261005`
Base: `2bdd99908d94cc39ada639af1f21ebbdccb6bfe2`
Task references: TWIN-085

## Exact owned paths

- `docs/workstreams/twin-legacy-compatibility-20261005.md`
- `packages/identity/src/twin-legacy-migration.ts`
- `packages/identity/src/twin-legacy-migration.test.ts`

## Scope

Add an additive, deterministic compatibility/migration contract for existing personal
clones so the simplified Twin product can adopt the existing canonical Character,
CharacterVersion, ownership and owner Relationship identities without destructive
rewrites or loss of lineage. This slice does not create database migrations, does not
modify package exports, does not touch Gateway/mobile/shared integration files, and does
not move or reinterpret Commerce balances, Agent Float, billing or crypto state.

## Explicit non-ownership

This claim does not own:
- PR #148 Twin profile/representational-memory files;
- PR #142/#146 Explore;
- PR #145/#171 My Twin;
- PR #138 Activity;
- PR #139 voice/trials;
- PR #141 owner access;
- PR #147/#150/#152/#155/#157 Wallet/economy/event work;
- PR #149 security/abuse/privacy;
- PR #159/#161 chat admission/identity UI;
- active billing, crypto, APK, shared Gateway composition, migrations or deployment.

## Acceptance

- unchanged canonical tenant/user/Character/CharacterVersion/Relationship identifiers;
- only `personal-clone` ownership is eligible;
- cross-tenant and cross-character evidence fails closed;
- owner relationship must match the ownership owner and Character;
- migration output contains no wallet, provider reserve or Agent Float concepts;
- replay of the same legacy snapshot is deterministic;
- no mutation of source objects.


## Implementation handoff

Implemented:
- `projectLegacyPersonalCloneToTwin()` validates an existing personal clone as a
  continuity source for the simplified Twin product;
- preserves the canonical Tenant, owner User, Character, active CharacterVersion and
  owner Relationship identifiers exactly;
- rejects non-personal ownership, missing owners, cross-tenant/cross-Character evidence,
  owner/Relationship mismatch, stale active versions and inactive Character/Relationship
  state;
- returns a frozen identity-only projection and never mutates the source;
- intentionally carries no wallet, Float, reserve, provider, billing, crypto or
  commission state.

Integration guidance:
- after PR #148 public Twin profile contracts are reconciled, the shared integration
  owner may use this projection as the legacy adoption preflight before creating any new
  profile projection;
- adoption should be in-place: do not generate a replacement Character, owner
  Relationship or financial account;
- discoverability should remain fail-closed until the public Twin profile policy has an
  explicit value; this compatibility slice does not infer it from legacy clone state;
- no database migration number is consumed by this branch.

Validation:
- live branch diff rechecked against current `main`: exactly the three claimed paths,
  3 commits ahead and 0 behind at verification time;
- implementation source compiled with global TypeScript 5.8.3 under a strict NodeNext
  no-emit harness using the canonical Identity shapes fetched from current main;
- the execution container could not resolve `github.com`, so a full workspace
  `pnpm`/Vitest checkout could not be run here; no full-suite pass is claimed.
