# R12 deletion intake and atomic verification integration

- Owner: ChatGPT consolidation window 2026-10-08 Africa/Lagos.
- Branch: `work/r12-atomic-intake-main-integration-20261008`; main at claim: `9fa9eb841f83e0c231588ddbb27ef685e0c7971a`.
- Scope: integrate stale base PR #409 plus stacked PR #416 without intermediate non-atomic verification deployment; preserve exact source blobs from #416 and unchanged latest main for non-owned paths.
- Unclaimed base PR #409 last updated 01:21Z; PR #416 last updated 05:18Z, five-minute lease expired. Current PR #423 remains active and stacks on #416; do not modify its owned paths.
- Fail-closed boundary: signed-in request/OTP verification and durable pending status only; the actual account erasure worker, financial clearance and provider purges do not execute from this integration. No claim of deleted data.
- Verification gate: GitHub source review; no functioning CI runner, no database integration or handset tests yet. Production erasure deliberately withheld.
- Destination: canonical main via dedicated integration PR, then close superseded base branches after confirmation.

## Integration source integrity

- Branch commit `51c2f5a73feff6e2d3f0aa968a895063f1b4cd59` grafts the 28 changed paths in old #409 plus #416 from exact stacked-source blob SHAs to current canonical main `9fa9eb841f83e0c231588ddbb27ef685e0c7971a`.
- All 28 source blobs existed, and none of their base SHA paths were changed by intervening main commits. This is a clean path-disjoint integration, not an overwrite of newer work.
- Source paths are limited to signed-in deletion intake/OTP challenge, atomic verify/retry, matching UI and external web proxy, identity migrations and **uncomposed** access revocation adapter. No final erasure worker or payment cancellation can activate from this merge.
- Active R12 #423 (customer session and channel guards) is not included; coordinate to rebase it on the merged main separately. Do not describe the account as deleted after verification alone.
- CI jobs still fail before runner execution with 0ms billable time; TypeScript, Vitest, PostgreSQL integration, Flutter analyzer and authenticated web browser acceptance remain **unverified**.
