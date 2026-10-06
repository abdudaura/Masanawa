# Cellular call Character routing — Task 127

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/cellular-call-routing-20261006`
Base SHA: `23980903fe528292d25398bd091ec23734c7e355` (Task 119 PresenceSession bridge / PR #248)

## Task references
- `docs/PRODUCTION-MASTER-TASKS.md` — **127** Implement real inbound/outbound cellular call Character routing.
- Actual Android/OmniSIP dialing transport remains Tasks 124/126 and physical-device ownership.

## Owned paths
- `services/presence/src/telephony-routing.ts` (new)
- `tests/contracts/telephony-routing.test.ts` (new)
- `docs/workstreams/cellular-call-routing-20261006.md`

## Excluded/shared paths
- No Android runtime, Telecom/ConnectionService APIs, OmniSIP adapter, Device package, Gateway, CharacterSession persistence, migrations, package manifests/lockfile or production config.
- No phone-number ownership or Device assignment state is invented here.

## Dependencies
- Device/assignment owner supplies authoritative Device -> Tenant/User/Character/Relationship binding.
- Task 126 provider supplies authenticated inbound/outbound telephony events.
- CharacterSession owner opens/resolves durable conversation continuity after routing.

## Current state
CLAIMED. Implement fail-closed inbound/outbound telephony routing contracts that accept only authoritative assignment resolution, normalize call/provider identities and phone numbers, bind exact Character/Relationship scope, and preserve idempotent provider call identity without performing device side effects.