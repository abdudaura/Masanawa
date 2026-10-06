# Character identity consistency across social/media/commerce — Task 137

Owner/window: ChatGPT continuation window / 2026-10-06
Branch: `work/character-surface-consistency-20261006`
PR: #268
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

State: ISOLATED COMPLETE / INTEGRATION READY.

## Completed implementation

- added a neutral Identity-domain evidence contract with no dependency on Social, Studio or Commerce packages;
- requires exact Tenant match across every surface;
- requires Social presentation, Studio media and Commerce originating evidence to resolve to the exact presentation Character;
- allows Commerce executor Character to differ only as an explicit execution role;
- executor identity can never substitute for missing/mismatched Commerce originating identity;
- evidence is source-reference + revision bound;
- duplicate evidence, missing required surfaces, cross-Tenant evidence and mismatched presentation identity fail closed;
- focused tests cover correct fallback executor behavior and all mismatch cases.

## Remaining integration dependencies

1. Identity public-barrel owner must append the new guard export when available.
2. Social/Studio/Commerce composition owners must map their canonical records into this evidence before publish/fulfillment handoff.
3. Gateway/Worker integration must fail before external publish/fulfillment when consistency evidence is invalid.
4. Task 138 golden journeys should exercise the composed rule end to end.

Implementation head before handoff: `75055d07e4bdb33bfefd4e2e5986555bc0f215e8`.

Last update: 2026-10-06.

## Verification

- Foundation CI run `37467868052`, job `112283363228`, on implementation/handoff head `374a442177fe2ab1dc08e9c95617f0ed690b9e60` failed before checkout with `runner_id=0` and `steps=[]`; no repository code executed.
- No pass is claimed from that CI result; executable typecheck/test/build remains required once hosted runner allocation recovers.
