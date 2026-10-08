# All 79 unchecked entries from the historical 150-task production ledger

**Re-audit: 2026-10-08. This is a documentation-status crosswalk, not an executed code audit.** Historical source is `docs/PRODUCTION-MASTER-TASKS.md`, read on current `main` after PR #506. The file contains exactly **79 unchecked** and **71 checked** numbered entries under its recorded checkboxes. Some unchecked tasks have meaningful later source, and some checked tasks may still lack 2026 release evidence. No status changes were applied to the original.

## Rules

1. **CURRENT CORE:** existing R01–R19/C01–C08 and U/F lanes must implement and verify the relevant active product outcome. A historical task number is not a new right to fork the same DB or tool engine.
2. **P1 — opt-in / PRIVACY-GATED:** explicit consent, control and evidence are mandatory before user exposure. User-initiated Gemini voice does not justify silent camera, phonebook, location or third-party content surveillance.
3. **FUTURE — owner approval:** historical external device control, OmniSIP/real calls/SMS/USSD, background camera, full Studio/media rendering and general plugins/MCP are preserved for future review but are NOT approved first-release features. Their listed F/U owner is an **inventory steward**, not a developer automatically authorized to build or activate the future product.
4. **RELEASE GATE:** real runner/device/provider/backup/financial security evidence is required; source or docs alone never close these tasks.
5. The 20 initial U scopes persist; U21–U30 address missing product/Contacts detail; F01–F18 recover and reconcile existing core. For concrete scope and PR collisions see `docs/UNFINISHED-SCOPE-RECONCILIATION-20261008.md` and `docs/ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md`.

## Complete unchecked tasks (all 79; original titles retained)

| Historical task and source line | Original unchecked requirement | Current classification | Accountable scope(s) | Evidence gate |
| --- | --- | --- | --- | --- |
| 072 (line 189) | Implement AgentRun identity, lineage and durable trace references. | CURRENT CORE | F18 / U01 / U02 / U05 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 073 (line 203) | Implement AgentStrategy interface and provider-neutral inference boundary. | CURRENT CORE | F18 / U01 / U02 / U05 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 074 (line 208) | Implement Character-aware context compiler using Identity/Memory/World. | CURRENT CORE | F18 / U01 / U02 / U05 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 075 (line 209) | Implement tool/skill selection orchestration. | CURRENT CORE | U01 / U04 / U28 / F18 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 076 (line 215) | Implement run budgets, token/cost/time/tool guards. | CURRENT CORE | U01 / U04 / U28 / F18 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 077 (line 218) | Implement foreground conversational strategy. | CURRENT CORE | U01 / U04 / U28 / F18 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 078 (line 219) | Implement research/multi-step strategy. | CURRENT CORE | U01 / U04 / U28 / F18 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 079 (line 220) | Implement background/delegated specialist strategy. | P1 — opt-in | U02 / U20 / F18 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 080 (line 224) | Implement run cancellation, supersession and stale-result protection. | CURRENT CORE | U02 / U20 / F18 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 081 (line 225) | Implement AgentRun telemetry/evidence and operator diagnostics. | CURRENT CORE | U02 / U20 / F18 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 082 (line 226) | Pass agent-runtime golden journey and provider/model replacement tests. | CURRENT CORE | U02 / U20 / F18 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 083 (line 230) | Implement bounded typed Decision/JEV contracts. | CURRENT CORE | U02 / F11 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 084 (line 231) | Implement Workflow and immutable WorkflowVersion graph model. | CURRENT CORE | U02 / F11 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 085 (line 232) | Implement WorkflowRun and Task canonical state. | CURRENT CORE | U02 / F11 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 086 (line 233) | Implement transactional task admission/outbox. | CURRENT CORE | U02 / F11 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 087 (line 234) | Implement atomic task checkout/lease/fencing. | CURRENT CORE | U02 / F11 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 088 (line 235) | Implement heartbeats, stale-run adoption and crash recovery. | CURRENT CORE | U02 / F11 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 089 (line 236) | Implement versioned checkpoints and compatibility validation. | CURRENT CORE | U02 / F11 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 090 (line 237) | Implement retries/backoff and dead-letter/needs-attention. | CURRENT CORE | U02 / F11 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 091 (line 238) | Implement human-in-loop pending requests and approvals. | CURRENT CORE | U02 / U25 / U20 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 092 (line 239) | Implement schedules/occurrences and durable timers. | P1 — opt-in | U02 / U25 / U20 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 093 (line 240) | Integrate Tool Operations/receipts/reconciliation into workflow truth. | CURRENT CORE | U02 / U25 / U20 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 094 (line 241) | Implement workflow cancellation/compensation/supersession semantics. | CURRENT CORE | U02 / U25 / U20 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 095 (line 242) | Implement workflow/run cost and operator visibility. | CURRENT CORE | U02 / U25 / U20 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 096 (line 243) | Pass restart/no-duplicate-side-effect workflow acceptance suite. | CURRENT CORE | U02 / U25 / U20 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 097 (line 247) | Implement durable ingress admission/dedupe and normalized subject envelope. | CURRENT CORE | F18 / U01 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 098 (line 248) | Implement deterministic Tenant/User/Relationship/Character routing. | CURRENT CORE | F18 / U01 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 099 (line 249) | Implement CharacterSession command/streaming gateway APIs. | CURRENT CORE | F18 / U01 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 100 (line 250) | Implement channel binding/account lifecycle model. | CURRENT CORE | U26 / F08 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 101 (line 251) | Implement WhatsApp adapter end-to-end. | CURRENT CORE | U26 / F08 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 102 (line 252) | Implement Telegram adapter end-to-end. | CURRENT CORE | U26 / F08 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 103 (line 253) | Implement email/webhook extensible channel pattern. | FUTURE — owner approval | F11 / U27 [future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 104 (line 254) | Implement Device registration and secure pairing. | FUTURE — owner approval | F11 / U27 [future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 105 (line 255) | Implement DeviceCapability publication/readiness/health. | FUTURE — owner approval | F11 / U27 [future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 106 (line 256) | Implement CharacterDeviceAssignment and capability policy. | FUTURE — owner approval | F11 / U27 [future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 107 (line 257) | Implement device credential generation/revocation and reconnect control plane. | FUTURE — owner approval | F11 / U27 [future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 108 (line 258) | Pass cross-channel continuity and Device replacement/revocation journeys. | FUTURE — owner approval | F11 / U27 [future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 109 (line 262) | Implement normalized permission-scoped PerceptionEvent. | PRIVACY-GATED | U05 / U07 / U09 / F10 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 110 (line 263) | Implement text/file/document perception admission. | CURRENT CORE | U05 / U07 / U09 / F10 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 111 (line 264) | Implement device microphone/camera/screen perception contracts. | PRIVACY-GATED | U05 / U07 / U09 / F10 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 112 (line 265) | Implement notification/device-state/location sensor contracts. | PRIVACY-GATED | U05 / U07 / U09 / F10 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 113 (line 266) | Implement proactive trigger model for schedules/events/conditions. | P1 — opt-in | U25 / U05 / U20 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 114 (line 267) | Implement promises, commitments and follow-up triggers. | P1 — opt-in | U25 / U05 / U20 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 115 (line 268) | Implement quiet hours, frequency, privacy and relationship policy. | CURRENT CORE | U25 / U05 / U20 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 116 (line 269) | Implement routine/world-event proactive integration. | P1 — opt-in | U25 / U05 / U20 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 117 (line 270) | Implement perception-to-memory promotion governance. | CURRENT CORE | U25 / U05 / U20 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 118 (line 271) | Pass governed offline/online proactivity and privacy acceptance suite. | P1 — opt-in | U25 / U05 / U20 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 119 (line 275) | Implement canonical PresenceSession and CharacterSession bridge. | CURRENT CORE | F02 / U09 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 120 (line 276) | Integrate LiveKit WebRTC transport. | CURRENT CORE | F02 / U09 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 121 (line 277) | Implement realtime STT/LLM/TTS and direct-live provider seams. | CURRENT CORE | F02 / U09 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 122 (line 278) | Implement semantic turn detection, interruption/barge-in and playback generations. | CURRENT CORE | F02 / U09 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 123 (line 279) | Implement renderer-neutral avatar/presentation provider. | FUTURE — owner approval | F11 / U27 [future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 124 (line 280) | Build minimal Masanawa Android Agent Device runtime. | FUTURE — owner approval | F11 / U27 [future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 125 (line 281) | Implement signed DeviceOperation local custody/offline queue/receipt replay. | FUTURE — owner approval | F11 / U27 [future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 126 (line 282) | Integrate OmniSIP as Android telephony Device Provider. | FUTURE — owner approval | F11 / U27 [future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 127 (line 283) | Implement real inbound/outbound cellular call Character routing. | FUTURE — owner approval | F11 / U27 [future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 128 (line 284) | Implement SMS/USSD Device capabilities. | FUTURE — owner approval | F11 / U27 [future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 129 (line 285) | Implement approved mobile app/browser/notification automation capabilities. | FUTURE — owner approval | F11 / U27 [future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 130 (line 286) | Pass real-device, connectivity-loss, call ambiguity and device-replacement acceptance suite. | FUTURE — owner approval | F11 / U27 [future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 131 (line 290) | Implement canonical social identity/account binding and content state. | CURRENT CORE | U23 / U30 / F04 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 132 (line 291) | Implement social draft/approval/publish/outbox/receipt/retry journey. | CURRENT CORE | U23 / U30 / F04 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 133 (line 292) | Implement deterministic quote/payment/ledger/fulfillment domain. | CURRENT CORE | F05 / F06 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 134 (line 304) | Implement payment reconciliation/refund/adjustment/receipt journeys. | CURRENT CORE | F05 / F06 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 135 (line 308) | Implement Studio project/artifact/provenance domain. | FUTURE — owner approval | U07 / U17 [studio future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 136 (line 309) | Implement script/storyboard/render/voice/lipsync production workflow. | FUTURE — owner approval | U07 / U17 [studio future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 137 (line 310) | Enforce Character identity consistency across social/media/commerce. | FUTURE — owner approval | U07 / U17 [studio future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 138 (line 311) | Pass social, commerce and studio production golden journeys. | FUTURE — owner approval | U07 / U17 [studio future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 139 (line 315) | Implement Plugin manifest/component/capability/lifecycle model. | FUTURE — owner approval | U01 / U20 / U27 [plugin future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 140 (line 316) | Implement plugin trust/permissions/versioning/uninstall behavior. | FUTURE — owner approval | U01 / U20 / U27 [plugin future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 141 (line 317) | Implement external MCP/A2A/protocol bridge pattern where justified. | FUTURE — owner approval | U01 / U20 / U27 [plugin future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 142 (line 318) | Implement trace/evaluation datasets and regression harness. | CURRENT CORE | U01 / U20 / U27 [plugin future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 143 (line 319) | Implement candidate optimization/learning pipeline with promotion gates. | FUTURE — owner approval | U01 / U20 / U27 [plugin future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 144 (line 320) | Pass plugin isolation and no-silent-self-mutation acceptance tests. | FUTURE — owner approval | U01 / U20 / U27 [plugin future] | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 145 (line 346) | Complete production security review, abuse cases, tenant isolation and secret-leak testing. | RELEASE GATE | F11 / U20 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 146 (line 347) | Complete performance/load/backpressure/realtime-latency/fleet capacity validation. | RELEASE GATE | F11 / U20 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 147 (line 348) | Complete observability/SLOs/alerts/runbooks/incident and reconciliation operations. | RELEASE GATE | F11 / U20 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 148 (line 349) | Complete backup/restore/DR, migration, rollback, data export/deletion and credential/device recovery drills. | RELEASE GATE | F11 / U20 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 149 (line 350) | Run all golden journeys in production-like pilot, resolve parity ledger and prove rollback/cutover readiness. | RELEASE GATE | F11 / U20 | Source-only or unverified until actual current full-stack tests; do not infer DONE |
| 150 (line 351) | Production release: cut over canonical Masanawa, verify post-release health, and close the first complete-generation acceptance audit. | RELEASE GATE | F11 / U20 | Source-only or unverified until actual current full-stack tests; do not infer DONE |

## Additional explicit decisions

- **072–082 agent runtime**: real AgentRun, user-visible task/action planning, memory and tool cost guards are carried by U01–U05/U28/F18. Existing source is evidence only; no chat-only tool impersonation or fake receipt.
- **083–096 workflows/tasks**: U02 builds durable execution and authorized approval; U25 builds opt-in schedules. Background work must have true leasing, retry, cancellation, costs and crash-safe idempotency.
- **097–108 channels/devices**: account-linked WhatsApp/Telegram customer assistance is current U26/F08; external device provisioning/pairing/telephony is intentionally future-gated.
- **109–118 proactivity/perception**: current private user-selected file and reminders are U05/U07/U25; passive camera/screen/device telemetry is never presumed authorized.
- **119–130 live presence and phones**: real public LiveKit and Gemini audio are F02/U09; OmniSIP, SIM calls, SMS/USSD and phone-robot automation are separate future programs.
- **131–138 social/commerce/studio**: authentic Talks/people, payments and real artifacts are current; professional studio rendering/lipsync is not silently added.
- **139–144 plugin governance**: first-party typed tool safety/evaluation is current U01/U20; generic third-party plugin marketplace/self-modifying agent contracts are future-gated.
- **145–150 production**: F11/U20 and final Work owner perform executable security, monitoring, load, restore, app signing and physical-device/rollback qualification before a first public release. No production cutover authorized by this document.

## Work accountability

At final integration, review **every row** and record last tested commit, actual implemented interfaces, branch disposition, relevant current R/C gate and whether release/legacy acceptance was actually executed. Do **not** set all 79 old boxes to checked simply because the 48 scopes have PRs, and do not erase historical unfinished work.
