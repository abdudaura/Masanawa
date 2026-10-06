# Creator clone provisioning scope hardening — Production Task 145

Owner/window: ChatGPT continuation window / 2026-10-06
Lease acquired under the merged five-minute stale-claim rule.
Branch: `work/security-clone-provision-scope-20261006`
Base: reclaimed stale PR #136 head `0235e7b570689bcdfae432a97eba0ff2bab65f38`
Task: Production Task 145 — security review, abuse cases and Tenant isolation.

## Security finding

`createCreatorCloneService` trusted the full result returned by
`PersonalCloneProvisioningRepository.getOrCreatePersonalClone` and immediately used the
returned Character to read/write Agent presentation and Skill assignment state.

A faulty, stale or compromised repository could return a graph whose Tenant, owner User,
Character, CharacterVersion or Relationship does not match the authorized request.

## Exact owned paths

- `docs/workstreams/security-clone-provision-scope-20261006.md`
- `services/gateway/src/creator_clone.ts`
- `services/gateway/src/creator_clone.test.ts`

## Explicitly excluded

- all other stale #136 Gateway/mobile/router/APK/production paths
- Identity repository implementation and migrations
- Agents repository implementation
- production environment/credentials

## Acceptance

Before any presentation or Skill assignment read/write:
- Character Tenant matches authorized Tenant;
- CharacterVersion Tenant + Character match;
- active CharacterVersion identity matches returned version;
- ownership Tenant + Character match, kind is personal-clone, owner User matches authority;
- Relationship Tenant + Character + User match;
- any mismatch fails closed and causes zero downstream Agent writes.

State: IMPLEMENTED / VERIFICATION PENDING.

## Completed

- validates the full PersonalCloneProvision graph before any Agent presentation/Skill repository access;
- Character Tenant must match the authorized Tenant;
- CharacterVersion Tenant/Character must match the returned Character;
- Character.activeCharacterVersionId must equal the returned CharacterVersion identity;
- ownership must be same Tenant/Character, kind=personal-clone, ownerUserId=authorized User;
- Relationship must be same Tenant/Character/User;
- forged Tenant, CharacterVersion, ownership User and Relationship User substitutions all fail closed;
- regression tests prove zero downstream presentation/Skill reads or writes occur on rejected graphs.

Implementation head before handoff: `fef4bfe54927c092bff45eebd0973d1942742d1a`.

Last update: 2026-10-06.
