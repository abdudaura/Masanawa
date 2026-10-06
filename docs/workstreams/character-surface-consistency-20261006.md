# Character identity consistency across social/media/commerce — Task 137

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/character-surface-consistency-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Production task: 137 — enforce Character identity consistency across social/media/commerce.

## Coordination

No competing Task 137 claim was found at selection. Social Task 131 is active in PR #261, Social publication Task 132 in #263, Studio Task 135 in #264 and Task 136 in #266. This lane does not modify any of those files.

## Exact owned paths

- `docs/workstreams/character-surface-consistency-20261006.md`
- `packages/identity/src/character-surface-consistency.ts`
- `packages/identity/src/character-surface-consistency.test.ts`

## Explicitly excluded/shared paths

- `packages/identity/src/index.ts`
- Social/Studio/Commerce package files
- Gateway/Worker/Ops/mobile/Admin composition
- persistence/migrations
- lockfile/root workspace files

## Rule

- social presentation Character = expected presentation Character;
- Studio/media Character = expected presentation Character;
- Commerce originating Character = expected presentation Character;
- Commerce executor Character is an execution role and MAY differ, but must never be accepted as a replacement for the originating/presentation Character;
- Tenant must match everywhere;
- evidence is revision/source bound and cannot silently change role;
- empty or duplicate contradictory evidence fails closed.

State: CLAIMED.

Last update: 2026-10-06.
