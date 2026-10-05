# Twin legacy compatibility migration claim

Status: active
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
