# Owner-session privacy and recording policy — TWIN-096

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/owner-session-privacy-policy-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`

## Task references
- `docs/TWIN-TRANSFORMATION-TASKS.md` — **TWIN-096** audit human-owner session privacy and recordings policy.
- Existing owner-access Commerce/Gateway contracts remain canonical and are not edited here.

## Owned paths
- `packages/identity/src/owner-session-privacy.ts` (new)
- `packages/identity/src/owner-session-privacy.test.ts` (new)
- `docs/workstreams/owner-session-privacy-policy-20261006.md`

## Excluded/shared paths
- No edits to owner-access Commerce state machine, Gateway owner-access services/routes, mobile chat/router, migrations, production environment or PR #136-owned paths.
- No edit to `packages/identity/src/index.ts` while overlapping shared export work remains active.

## Dependencies
- Owner-access runtime supplies authenticated participant/session facts.
- Production policy persistence/versioning remains a shared/admin integration concern.
- Recording/transcript storage, if later enabled, must be implemented by the owning persistence lane; this work grants no storage authority.

## Current state
CLAIMED. Implement a deterministic privacy policy that separates attendance/completion evidence from content capture, forbids silent recording, requires explicit participant consent whenever recording is enabled, and exposes bounded retention decisions without inventing a second owner-access runtime.