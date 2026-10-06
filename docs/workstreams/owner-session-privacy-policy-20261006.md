# Owner-session privacy and recording policy — TWIN-096

Owner/window: ChatGPT continuation window (2026-10-06)
Branch: `work/owner-session-privacy-policy-20261006`
Base SHA: `b8d415f09424ddf3e1a90a578f54c5792668bc3b`
Implementation commit: `6ac30bd3576567d7c945d59dab0f6d96144f14a4`
PR: #221

## Task references
- `docs/TWIN-TRANSFORMATION-TASKS.md` — **TWIN-096** audit human-owner session privacy and recordings policy.
- Existing owner-access Commerce/Gateway contracts remain canonical and are not edited here.

## Owned paths
- `packages/identity/src/owner-session-privacy.ts`
- `packages/identity/src/owner-session-privacy.test.ts`
- `docs/workstreams/owner-session-privacy-policy-20261006.md`

## Excluded/shared paths
- No edits to owner-access Commerce state machine, Gateway owner-access services/routes, mobile chat/router, migrations, production environment or PR #136-owned paths.
- No edit to `packages/identity/src/index.ts` while overlapping shared export work remains active.

## Completed implementation
- Added a versioned privacy policy contract for text transcript retention, audio recording and video recording.
- Launch defaults keep audio/video recording disabled.
- Any policy that enables recording is rejected unless requester consent, owner consent and a visible recording indicator are all mandatory.
- Added modality/capture compatibility checks so text, voice and video capture cannot be silently mixed.
- Added bounded retention decisions; denied capture always resolves to zero retained days.
- Explicitly separated attendance/completion/participant metadata evidence from content capture, so settlement evidence never becomes implicit permission to store transcripts or recordings.
- Added tests for launch defaults, explicit consensual recording, missing consent/indicator, modality mismatch, metadata-only evidence and unsafe policy revisions.

## Changed-file audit
Exactly three files:
1. `docs/workstreams/owner-session-privacy-policy-20261006.md`
2. `packages/identity/src/owner-session-privacy.ts`
3. `packages/identity/src/owner-session-privacy.test.ts`

No shared Gateway/mobile/Commerce/Event/migration/production files changed.

## Verification
GitHub Actions Foundation CI run `37452118529`, job `112230895669` ended `failure` with `steps = null`. The runner did not execute checkout, install, typecheck or tests. This is not recorded as a pass and does not provide application failure evidence.

## Remaining dependencies
- Identity/shared integration owner: export this module through the canonical package surface after overlapping #136 export work is reconciled.
- Owner-access shared owner: compose the policy with authenticated session creation/activation and recording controls without changing the canonical owner-access state machine.
- Persistence/admin owner: persist policy revisions, explicit consent receipts and any approved retained content under existing privacy/storage boundaries.
- Device qualification owner: verify visible recording indication and consent UX on the exact release APK if recording is ever enabled.

## Current state
**ISOLATED COMPLETE / INTEGRATION READY.**

No further isolated implementation remains in this lane.
