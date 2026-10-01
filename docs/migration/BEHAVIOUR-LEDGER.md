# Behaviour Ledger

Features describe what exists; this ledger records observable and operational behavior that must not be lost during the rewrite.

## Required fields

| Field | Meaning |
|---|---|
| ID | Stable behavior ID |
| Feature ID | parent feature |
| Trigger/precondition | starting state |
| Required behavior | exact outcome/invariant |
| Failure behavior | what happens on error |
| Source evidence | source test/code/docs |
| Class | A/B/C |
| Masanawa test | future test path/name |
| Status | discovered -> verified |

## Current invariants

| ID | Feature | Required behavior | Class | Source evidence | Status |
|---|---|---|---|---|---|
| B-MEM-001 | MEM-002 | A private fact learned from user A must never appear in user B's character context without explicit privacy-safe promotion. | A | CWS PLATFORM-FOCUS | analysed |
| B-MEM-002 | MEM-003 | Recent context remains bounded; older content is summarized while newest turns remain verbatim. | B | N.E.K.O memory-system | analysed |
| B-MEM-003 | MEM-004 | Fact deduplication must not silently discard historical/audit-relevant facts; absorbed facts can archive. | B | N.E.K.O memory-system | analysed |
| B-MEM-004 | MEM-005 | Retrying reflection synthesis for the same source fact set must be idempotent. | A | N.E.K.O reflection ID contract | analysed |
| B-MEM-005 | MEM-007 | Memory retrieval failure must not prevent ordinary conversation from continuing. | A | N.E.K.O recall handler contract | analysed |
| B-MEM-006 | MEM-008 | Replayable background memory operations may be delivered at least once, therefore handlers must be idempotent. | A | N.E.K.O memory-system | analysed |
| B-MEM-007 | MEM-005 | Mention suppression changes proactive surfacing, not underlying evidence or deletion state. | B | N.E.K.O memory-system | analysed |
| B-MEM-008 | MEM-009 | Expired or inactive/reconciled memories must not re-enter runtime context. | A | CWS memory lifecycle + cross-channel continuity test | analysed |
| B-MEM-009 | MEM-009 | Constraint/prohibition memories retain a stronger importance floor than ordinary preferences during decay. | B | CWS memory-lifecycle.ts | analysed |
| B-SKL-001 | SKL-002 | A blocked/uncertified skill cannot be advertised/routed as available for consequential execution. | A | CWS SKILL-TOOL-ROUTING | analysed |
| B-SKL-002 | SKL-004 | Cyclic skill dependencies must be rejected before production execution. | A | OpenJarvis skills architecture | discovered |
| B-SKL-003 | SKL-007 | Skill Contract v2 rejects unknown capability keys and requires negative activation, tests and certification. | A | CWS skill-contract.ts | analysed |
| B-SKL-004 | SKL-007 | Side-effect skill classes require idempotency rules; paid skills require confirmation rules. | A | CWS skill-contract.ts | analysed |
| B-TOL-001 | TOL-002 | Tool readiness must include authorization/health, not merely existence of a prompt or binding. | A | CWS SKILL-TOOL-ROUTING | analysed |
| B-COM-001 | COM-001 | An uncertain external financial/provider result is reconciled before retry that could duplicate a side effect. | A | CWS PLATFORM-FOCUS | analysed |
| B-COM-002 | COM-001 | Price/quote occurs before payment; high-impact execution receives confirmation/approval at the correct boundary. | A | CWS PLATFORM-FOCUS | analysed |
| B-COM-003 | COM-002 | Derived balance must be explainable from immutable/append-only ledger evidence. | A | CWS PLATFORM-FOCUS | analysed |
| B-COM-004 | COM-004 | Production commerce rejects sandbox provider execution unless an explicit controlled override permits it. | A | CWS provider-production-safety.test.ts | analysed |
| B-COM-005 | COM-004 | A retired provider must not remain reachable through runtime fallback/import paths. | A | CWS provider-production-safety.test.ts | analysed |
| B-COM-006 | COM-003 | Retryable provider webhook work is durably claimed and failed replay attempts are persisted, not only logged in memory. | A | CWS flutterwave-inbox-retry.ts | analysed |
| B-COM-007 | COM-003 | Stale funding provisioning and expired billing state are periodically reconciled after transient failures/restarts. | A | CWS billing-reconciler.ts | analysed |
| B-AGT-001 | AGT-003 | Long-running specialist work must not replace the foreground character identity. | B | CyberVerse PersonaAgent design | analysed |
| B-AGT-002 | AGT-003 | Foreground persona should acknowledge accepted long work promptly before background execution blocks realtime conversation. | B | CyberVerse PersonaAgent design | analysed |
| B-TSK-001 | TSK-002 | Reconnecting clients can recover task progress from ordered persisted task events. | A | CyberVerse PersonaAgent/TaskService design | analysed |
| B-TSK-002 | TSK-001 | Terminal tasks reject late running/completed/artifact mutations. | A | CyberVerse design/store tests (to deep verify) | discovered |
| B-TSK-003 | TSK-004 | Before re-sending scheduled outbound work, durable delivery evidence must be checked and previously recorded delivery recovered as completed. | A | CWS durable-whatsapp-idempotency.test.ts | analysed |
| B-RTC-001 | RTC-002 | User speech during character output interrupts output without destroying session/conversation continuity. | A | CyberVerse README/tests (deep verify pending) | discovered |
| B-RTC-002 | RTC-004 | Disabling avatar rendering still permits a functioning voice session. | A | CyberVerse README/config | analysed |
| B-CALL-001 | CALL-001 | A connected engine with previously verified primitives remains usable despite a stale/missing diagnostics heartbeat; explicit proof of primitive unavailability blocks it. | A | CWS call-readiness.test.ts | analysed |
| B-CALL-002 | CALL-001 | Pairing/explicit runtime failure is reported as action-required rather than silently treated as ordinary degradation. | A | CWS call-readiness.test.ts | analysed |
| B-CALL-003 | CALL-002 | Hard recovery requires repeated soft-repair failures plus sustained degradation and must never interrupt pairing or an active/setup call. | A | CWS recovery-policy.test.ts | analysed |
| B-CALL-004 | CALL-003 | Incoming accept retries for a bounded period until provider call state materializes, preventing a signalling/provider race from causing false failure. | A | CWS incoming-accept-race + provider-call-store tests | analysed |
| B-CALL-005 | CALL-004 | Routine reconnect restarts the browser/call client without killing the HTTP gateway or erasing credentials; explicit relink clears only the dedicated call-device profile. | A | CWS runtime-ownership.test.ts | analysed |
| B-CALL-006 | CALL-002 | Recovery/stabilization must not interfere with QR pairing or run renderer stabilization before WhatsApp/provider connection is established. | A | CWS recovery-policy + startup-renderer-safety tests | analysed |
| B-CALL-007 | CALL-005 | On outbound timeout, retain last offer phase and provider-call presence/state for diagnosis before surfacing failure. | B | CWS outbound-offer-diagnostics.test.ts | analysed |
| B-CALL-008 | CALL-006 | Playback is normalized/soft-limited before output and final audio fades to silence to reduce clipping/click artifacts. | B | CWS live-call-quality-regression.test.ts | analysed |
| B-WLD-001 | WLD-001 | Shared character/world events remain consistent across users while private memories remain isolated. | A | CWS PLATFORM-FOCUS | analysed |
| B-WLD-002 | WLD-003 | Only published, valid, complete character Constitutions may drive automatic life events. | A | CWS star-life-engine.ts | analysed |
| B-WLD-003 | WLD-003 | Reprocessing the same routine occurrence must not duplicate the life event. | A | CWS engine key + idempotency migration | analysed |
| B-IDN-001 | IDN-001 | Production character face/voice/core biography cannot silently mutate from an ad-hoc prompt edit. | A | CWS PLATFORM-FOCUS | analysed |
| B-HND-001 | HND-001 | Cross-character handoff context contains bounded request/entities/task/preferences and explicitly excludes source private memory/full transcript. | A | CWS star-handoff.ts + privacy test | analysed |
| B-HND-002 | HND-002 | Only the active destination character may return or complete a named handoff. | A | CWS star-handoff.ts | analysed |
| B-HND-003 | HND-002 | Handoff completion requires durable task evidence matching the inherited handoff task. | A | CWS star-handoff.ts | analysed |
| B-HND-004 | HND-001 | Failure of evaluation/JEV replay attachment must not roll back or delay an otherwise valid deterministic handoff. | A | CWS star-handoff.ts | analysed |
| B-HND-005 | HND-001 | Ownership scoping of messages/memory/commitments occurs before continuity-window limits are applied. | A | CWS cross-channel continuity test | analysed |
| B-CHN-001 | CHN-001 | Web, WhatsApp and Telegram persist learned character turns through shared character-scoped continuity. | A | CWS cross-channel continuity test | analysed |
| B-DEC-001 | DEC-001 | Low-confidence/model decision never authorizes paid/destructive execution. | A | CWS PLATFORM-FOCUS/JEV | analysed |
| B-PLG-001 | PLG-001 | Extension failure must be isolated from the host process as far as plugin architecture permits. | B | N.E.K.O plugin process model | discovered |
| B-OJ-SKL-001 | SKL-005 | External executable scripts are not imported by default; executable content requires explicit opt-in and provenance. | A | OpenJarvis importer + tests | analysed |
| B-OJ-SKL-002 | SKL-005 | Symlinked imported resources are rejected before replacing an existing install, preventing traversal/out-of-package reads. | A | OpenJarvis importer + tests | analysed |
| B-OJ-SKL-003 | SKL-005 | Unknown vendor metadata is preserved for provenance/compatibility rather than silently discarded. | B | OpenJarvis parser + tests | analysed |
| B-OJ-SKL-004 | SKL-004 | Dependency cycles/depth excess are rejected and a bad cyclic cluster must not cause all healthy skills to disappear. | A | OpenJarvis dependency + manager | analysed |
| B-OJ-SEC-001 | SEC-003 | Unreviewed imported skills requesting dangerous capabilities are blocked before installation unless explicitly reviewed/confirmed; Masanawa adds certification before production use. | A | OpenJarvis importer/security | analysed |
| B-OJ-SEC-002 | SEC-004 | SSRF validation blocks private, loopback, link-local, metadata, mapped/disguised addresses and fails closed on DNS failure by default. | A | OpenJarvis SSRF tests | analysed |
| B-OJ-PRV-001 | PRV-004 | Explicitly requested provider/engine is authoritative and never silently substituted if unavailable. | A | OpenJarvis engine discovery | analysed |
| B-OJ-PRV-002 | PRV-004 | Default provider fallback considers health, model compatibility and local/cloud class rather than picking an arbitrary provider. | B | OpenJarvis engine discovery | analysed |
| B-OJ-AGT-001 | AGT-006 | Repeated identical tool calls and runaway poll loops can be blocked with an observable guard event. | A | OpenJarvis loop guard tests | analysed |
| B-OJ-AGT-002 | AGT-007 | Cost/token budget excess is represented as an execution state rather than silently continuing. | B | OpenJarvis budget tests | analysed |
| B-OJ-LRN-001 | LRN-004 | Optimization requires a minimum trace count and writes a separate candidate overlay instead of mutating the base skill. | A | OpenJarvis skill optimizer tests | analysed |
| B-OJ-TRC-001 | LRN-001 | Trace listeners unsubscribe at end of execution so later stray events cannot contaminate subsequent traces. | B | OpenJarvis trace collector tests | analysed |
| B-NEKO-MEM-001 | MEM-010 | Repeated terminal failure of the same background cognition item must eventually dead-letter/advance its stable progress marker so one poison input cannot stall the whole character pipeline forever. | A | N.E.K.O memory liveness tests | analysed |
| B-NEKO-MEM-002 | MEM-010 | Successful processing clears failure-attempt state, and progress updates preserve work that arrived while a pass was in flight. | A | N.E.K.O memory liveness tests | analysed |
| B-NEKO-MEM-003 | MEM-011 | A completed foreground turn is durably persisted before asynchronous fact/evidence work is spawned. | A | N.E.K.O cache/settle regression tests | analysed |
| B-NEKO-MEM-004 | MEM-011 | If current recent-history identity is stale/deleted, downstream memory persistence aborts rather than attaching data to the wrong state lineage. | A | N.E.K.O cache/settle tests | analysed |
| B-NEKO-MEM-005 | MEM-012 | Automatic context compilation remains bounded and distinct from explicit semantic recall; an explicit recall failure must not break normal conversation. | A/B | N.E.K.O memory architecture | analysed |
| B-NEKO-PLG-001 | PLG-004 | Hot reload must not restart a plugin the user explicitly stopped, including races where stop occurs between watcher check and operation-lock acquisition. | A | N.E.K.O plugin hot-reload tests | analysed |
| B-NEKO-PLG-002 | PLG-004 | Once host shutdown begins, new plugin starts/registrations are rejected so an in-flight reload cannot create an orphan host. | A | N.E.K.O plugin hot-reload tests | analysed |
| B-NEKO-PLG-003 | PLG-004 | Busy hot reload retries later instead of waiting unboundedly; stop is idempotent and restart drain has a deadline. | A | N.E.K.O plugin hot-reload tests | analysed |
| B-NEKO-PRO-001 | PRO-003 | Proactive source/repetition history survives restart so restarting the process cannot reset anti-repetition policy. | A | N.E.K.O proactive state/source-history tests | analysed |
| B-NEKO-PRO-002 | PRO-004 | If durable proactive-history state cannot be loaded, do not overwrite it with partial/empty in-memory history and silently truncate prior state. | A | N.E.K.O source-history load-failure design/tests | analysed |
| B-NEKO-PRO-003 | PRO-004 | An atomic persistence operation already offloaded to a worker must complete before cancellation releases the logical write lock. | A | N.E.K.O proactive persistence design | analysed |
| B-NEKO-PER-001 | PER-002 | Activity/perception APIs explicitly distinguish visible, private and unavailable states and do not leak detailed foreground signals when privacy state is unavailable/private. | A/B | N.E.K.O plugin SDK runtime tests | analysed |
| B-NEKO-CUA-001 | PER-003 | Model-generated desktop actions cannot escape the approved action surface through reflection, arbitrary imports, unpacking or hidden backend access. | A | N.E.K.O computer-use hardening tests | analysed |
| B-NEKO-CUA-002 | PER-003 | Computer-use sessions hold an exclusive desktop lease until the synchronous worker exits and input-state cleanup has completed. | A | N.E.K.O computer-use hardening tests | analysed |
| B-NEKO-CUA-003 | PER-003 | Failed key/button releases remain tracked for retry and safety/failsafe state is restored after cleanup attempts. | A | N.E.K.O computer-use hardening tests | analysed |
| B-NEKO-VID-001 | VID-001 | Speaker-verification activation has explicit ready/degraded/unsupported-route states; an incompatible route must degrade rather than silently bypass enforcement. | A | N.E.K.O voice identity runtime tests | analysed |
| B-NEKO-VID-002 | VID-001 | Enrollment/suppression state is restored on unregister/cancel/failure, and sensitive computed embeddings are wiped on cancelled work. | A | N.E.K.O voice identity tests | analysed |
| B-NEKO-EMB-001 | EMB-001 | Embodied interaction memory is deduplicated by event key/rank, allowing a stronger summary to replace a weaker repetition without logging every physical interaction. | B | N.E.K.O avatar memory contract tests | analysed |
| B-NEKO-EMB-002 | EMB-001 | Missing/unsupported physical interaction details are not invented and free-form compatibility context cannot leak into the factual memory event. | A | N.E.K.O avatar memory contract tests | analysed |
| B-CV-RTC-001 | RTC-006 | AV-sync/control feedback from a previous playback epoch/turn must not change the current turn's audio/video timing. | A | CyberVerse audio_delay/session tests | analysed |
| B-CV-RTC-002 | RTC-007 | Media reset clears stale output tracks/codec/bitrate/sync state while preserving the inbound user-audio path needed for continued conversation. | A | CyberVerse audio_delay tests | analysed |
| B-CV-RTC-003 | RTC-007 | Large idle RTP gaps may be skipped according to frame-duration policy rather than replayed as long frozen latency. | B | CyberVerse rtp_gap tests | analysed |
| B-CV-RTC-004 | RTC-008 | Avatar-disabled sessions continue as valid audio-only sessions and must not invoke avatar generation. | A | CyberVerse orchestrator_audio_only tests | analysed |
| B-CV-RTC-005 | RTC-008 | Idle avatar filler stops when real speech video becomes active and resumes only after the speech turn finishes. | A | CyberVerse silent_avatar_runtime tests | analysed |
| B-CV-RTC-006 | RTC-009 | A late finish callback from an older pipeline generation cannot clear/cancel the currently active pipeline. | A | CyberVerse session tests | analysed |
| B-CV-RTC-007 | RTC-009 | Delayed assistant output is ordered beside its matching user turn, not merely appended by arrival time. | A | CyberVerse session turn-seq tests | analysed |
| B-CV-RTC-008 | RTC-009 | Provider dialog projections do not create user/assistant pairs across different session IDs and drop orphan/incomplete pairs. | A | CyberVerse dialog-context tests | analysed |
| B-CV-TSK-001 | TSK-005 | Once a task is terminal, late state events and artifact creation are rejected. | A | CyberVerse agenttask store tests | analysed |
| B-CV-TSK-002 | TSK-006 | Task event sequence increments atomically with status/progress and supports list-after-sequence reconnect catch-up. | A | CyberVerse agenttask store tests | analysed |
| B-CV-TSK-003 | TSK-005 | External task/artifact identifiers containing traversal/path segments are rejected. | A | CyberVerse agenttask store tests | analysed |
| B-CV-AGT-001 | AGT-009 | Long background work returns an accepted task to the foreground persona before execution so the persona can acknowledge immediately. | B | CyberVerse PersonaSupervisor/PersonaAgent tests | analysed |
| B-CV-AGT-002 | AGT-009 | Final natural persona response is emitted only after terminal task completion and must not expose internal task/artifact IDs or raw JSON. | A/B | CyberVerse PersonaAgent/Supervisor tests | analysed |
| B-CV-AGT-003 | AGT-008 | Background worker receives only explicitly allowed tools/skills/packages/extensions and selected provider credentials; unrelated parent secrets are not inherited. | A | CyberVerse subagent runner tests | analysed |
| B-CV-AGT-004 | AGT-008 | Background cancellation sends an explicit cancel signal; timeout force-terminates the stuck child; child failure is reaped before surfacing structured error. | A | CyberVerse subagent runner tests | analysed |
| B-CV-AGT-005 | AGT-008 | Background artifact size is bounded before it enters the canonical task/artifact system. | A | CyberVerse subagent runner tests | analysed |
| B-CV-AVT-001 | AVT-004 | Multi-GPU/distributed avatar warmup occurs only when both global and distributed warmup policies permit it and remains timeout-bounded. | B | CyberVerse avatar warmup tests | analysed |
| B-CWS-SOC-001 | SOC-003 | Restart/redeploy against the same durable queue must not re-enqueue or re-publish media already known or posted. | A | CWS posting cadence tests | analysed |
| B-CWS-SOC-002 | SOC-004 | Review approval transitions only review-state work to pending; rejection is terminal and cross-tenant rows are not disclosed. | A | CWS review queue tests | analysed |
| B-CWS-SOC-003 | SOC-005 | Destination cadence overrides global cadence, and quiet windows handle same-day/wrap-around/equal-start-end semantics deterministically in configured timezone. | B | CWS cadence/sleep tests | analysed |
| B-CWS-STD-001 | STD-004 | A completed render job is idempotently skipped unless an explicit force/revision requests regeneration. | A | CWS render_queue.py | analysed |
| B-CWS-STD-002 | STD-004 | Failed quality gates retry only within a bounded budget; exhaustion becomes needs-review rather than an infinite render loop. | A | CWS quality_gate.py/render_queue.py | analysed |
| B-CWS-STD-003 | STD-005 | Continuity references are updated from actual accepted render outputs/end frames rather than plan-time assumptions. | A/B | CWS render_queue/continuity tracker | analysed |
| B-CWS-STD-004 | STD-006 | Lip-sync/audio stages fit durations explicitly and may pause in an awaiting-backend state instead of pretending GPU work completed. | A/B | CWS lipsync.py | analysed |
| B-CWS-OPS-001 | OPS-003 | Configured/ready is not equivalent to production-proven: live acceptance evidence can be missing/stale without inventing synthetic customer/provider transactions. | A | CWS acceptance-health/operations | analysed |
| B-CWS-OPS-002 | OPS-004 | Operator/JEV telemetry exposes privacy-safe aggregate evidence, not raw private semantic packets, secrets or hidden reasoning. | A | CWS operations-observability tests | analysed |
| B-CWS-OPS-003 | OPS-005 | Emergency global pause/resume is a durable service-side operation and must not silently destroy individual per-group/user modes. | A | CWS group-kill-switch tests | analysed |
| B-CWS-OPS-004 | OPS-006 | Manual financial adjustment requires allowed direction, bounded amount, reason and evidence/reference. | A | CWS financial-adjustments tests | analysed |
| B-LRN-001 | LRN-003 | Learned/optimized skill changes are candidates and require evaluation/certification before consequential production promotion. | A | Masanawa decision from CWS+OpenJarvis | designed |
| B-OC-CHN-001 | CHN-003 | Each configured agent has an isolated workspace/session store and explicit channel/account routing; a channel binding must not silently collapse agent identities. | B | OpenClaw agent + multi-agent docs | discovered |
| B-OC-AGT-001 | AGT-008 | Mid-run steering is checked before unstarted tool launches/next model call; a running tool is not retroactively cancelled unless explicit interrupt semantics apply. | B | OpenClaw agent runtime docs | discovered |
| B-OC-AGT-002 | AGT-008 | Sequential tool calls skipped because of a steer receive paired synthetic results so the model's tool-call protocol remains consistent. | B | OpenClaw agent runtime docs | discovered |
| B-OC-SKL-001 | SKL-008 | Skill precedence is deterministic across scopes and invalid skills are skipped without preventing valid siblings from loading. | B | OpenClaw skills docs | discovered |
| B-OC-SEC-001 | SEC-005 | A previously attested workspace that disappears is not silently reseeded as a fresh identity/workspace. | A | OpenClaw agent runtime docs | discovered |
| B-OC-MEM-001 | MEM-013 | Pre-compaction memory flush uses private housekeeping context and must not leak housekeeping messages into later user turns. | A/B | OpenClaw memory docs | discovered |
| B-OC-MEM-002 | MEM-013 | Memory maintenance requiring write access is skipped when sandbox/workspace policy is read-only rather than bypassing sandbox restrictions. | A | OpenClaw memory docs | discovered |

Deep behavior mining from tests remains required before Phase 0 completion.
