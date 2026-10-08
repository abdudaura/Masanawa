# F03 — authorized support default recovery

Owner: autonomous Work window /root, 2026-10-09.
Branch: work/r03-support-preference-authorization-20261008; existing draft PR #495.
Observed main: 5e758673ae91082520b21b3153da53791ae2cbf3; resumed head: d2dc8982330ce2c7f2a5913ceda1bee51b6feb0f.
Claim: 2026-10-08T23:47:17.264Z; ACTIVE, five-minute repository-visible lease.

Scope: complete safe directory default read resolution when the saved preference is hidden, revoked, non-support or unavailable; preserve saved preference and select only a unique currently visible authorized platform default. Sanitize preference readback failures and revalidate returned tenant/user/character authority. Continue #495, no parallel preference schema.

Exact owned paths:
- services/gateway/src/agent_directory.ts
- services/gateway/src/agent_directory.test.ts
- services/gateway/src/agent_support_default_recovery.test.ts (new)
- docs/workstreams/f03-support-default-recovery-20261009.md

No shared Gateway composition, Flutter Settings, root router, migrations, native Firebase, voice runtime or financial changes. Existing #495 Flutter transport/state/settings consumers already use defaultPlatformAgent from this projection. Preserve all existing #495 source.

Inspection: main continuation, U/F reconciliation and 20-window workbook, live 70 open PR heads, #495 source/files and #441 atomic-bootstrap handoff. U01-U20 reserved; U21-U30 implemented drafts; F01 visual decision blocked; F02 requires shared native/runtime/device ownership; F03 independent directory recovery is safe. #495 last visible update 2026-10-08T12:02:32Z, stale >5 minutes; #497 owns shared composition only. Full F03 remains PARTIAL_IMPLEMENTATION.

Status: SOURCE partial; INTEGRATION existing reviewed-source draft #495; EVIDENCE pending local execution. No E2E, deployment, merge or runtime-voice claim.
