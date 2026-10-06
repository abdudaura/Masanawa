# Cross-channel continuity + Device replacement acceptance — Production Task 108

Owner/window: ChatGPT continuation window / 2026-10-06
Lease acquired under the five-minute stale-claim rule.
Branch: `work/cross-channel-device-replacement-acceptance-20261006`
Base: stale/reclaimable Task 107 head `e2a8dd3f6ad612399ae6eeb8833e2e91985ab0c9` (PR #241)
Task: Production Task 108 — cross-channel continuity and Device replacement/revocation journeys.

## Reclaimed prerequisites

- Task 104 PR #120 Device registration/pairing
- Task 105 PR #121 Device capability/readiness
- Task 106 PR #236 CharacterDeviceAssignment
- Task 107 PR #241 operational credential/reconnect
- Task 100 PR #231 channel-binding lifecycle

All prerequisite claims were inactive for more than five minutes when this lease was taken.
Useful completed source is preserved; no stale branch is rewritten or force-pushed.

## Exact owned paths

- `docs/workstreams/cross-channel-device-replacement-acceptance-20261006.md`
- `tests/integration/cross-channel-device-replacement-acceptance.test.ts`
- `packages/identity/src/channel-binding.ts` — exact preserved prerequisite source from PR #231, copied only because the Task 107 stack predates it.

## Explicitly excluded

- active PR #136 production Gateway/mobile/router/APK paths
- active PR #295 mobile accessibility paths
- channel adapter implementation PR #92
- PostgreSQL migrations/repositories
- Gateway/Presence/Worker/Ops composition
- Android/OmniSIP runtime/provider code
- production credentials/configuration

## Acceptance target

1. WhatsApp and Telegram proof-backed bindings resolve to the same canonical User while channel account/subject identities remain distinct.
2. Revoking one channel binding removes that channel's authority without changing the User represented by the other active channel.
3. An active Character assignment on the old Device can use only its allowed, currently-ready capability.
4. Device replacement creates a new Device/assignment/credential while preserving Character identity.
5. Old assignment revocation immediately denies capability use.
6. Old operational credential revocation prevents reconnect authentication.
7. Replacement Device with healthy capability snapshot and fresh credential can authenticate and execute the allowed capability.
8. Cross-Tenant/cross-Device substitution fails closed.

State: IMPLEMENTED / VERIFICATION PENDING.

## Completed

- reclaimed stale Tasks 100/104/105/106/107 contract lineage without rewriting their branches;
- preserved PR #231 channel-binding implementation exactly on the Task 107 stack;
- proves WhatsApp + Telegram proof-backed bindings converge on one canonical User while preserving distinct external identities;
- revoking one channel removes only that binding's authority and leaves the other channel usable;
- proves an old Character/Device assignment is allowed only while active/current/healthy;
- models replacement with a fresh Device, assignment and operational credential while preserving exact Character identity;
- revoked old assignment fails capability evaluation immediately;
- revoked old credential cannot complete a previously issued reconnect challenge;
- replacement credential completes strong device-key authentication;
- cross-Tenant/cross-Device substitution fails closed.

No active #136/#295 paths, provider adapters, migrations, production config or Android runtime code were modified.

Implementation head before handoff: `cf1d5f5593b079df60f434cf1a264afe802aa0c9`.

Last update: 2026-10-06.
