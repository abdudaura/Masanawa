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
| B-RTC-001 | RTC-002 | User speech during character output interrupts output without destroying session/conversation continuity. | A | CyberVerse + LiveKit interruption regressions | analysed |
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
| B-OC-CHN-001 | CHN-003 | Each configured agent has an isolated workspace/session store and explicit channel/account routing; a channel binding must not silently collapse agent identities. | B | OpenClaw agent + multi-agent docs | analysed |
| B-OC-AGT-001 | AGT-012 | Mid-run steering is checked before unstarted tool launches/next model call; a running tool is not retroactively cancelled unless explicit interrupt semantics apply. | B | OpenClaw agent runtime docs | analysed |
| B-OC-AGT-002 | AGT-012 | Sequential tool calls skipped because of a steer receive paired synthetic results so the model's tool-call protocol remains consistent. | B | OpenClaw agent runtime docs | analysed |
| B-OC-SKL-001 | SKL-008 | Skill precedence is deterministic across scopes and invalid skills are skipped without preventing valid siblings from loading. | B | OpenClaw skills docs | analysed |
| B-OC-SEC-001 | SEC-005 | A previously attested workspace that disappears is not silently reseeded as a fresh identity/workspace. | A | OpenClaw agent runtime docs | analysed |
| B-OC-MEM-001 | MEM-013 | Pre-compaction memory flush uses private housekeeping context and must not leak housekeeping messages into later user turns. | A/B | OpenClaw memory docs | analysed |
| B-OC-MEM-002 | MEM-013 | Memory maintenance requiring write access is skipped when sandbox/workspace policy is read-only rather than bypassing sandbox restrictions. | A | OpenClaw memory docs | analysed |
| B-OC-GW-001 | GW-002 | Channel/account binding selects a destination only after channel admission; a binding must never itself grant sender access. | A | OpenClaw agent-bindings/access-control docs | analysed |
| B-OC-GW-002 | SEC-006 | Session owner/participant visibility is not a security boundary; Masanawa must enforce tenant/user/relationship authorization independently. | A | OpenClaw multi-user/security docs | analysed |
| B-OC-GW-003 | SEC-006 | Broad cross-session/cross-agent defaults from a trusted Gateway must not become Masanawa public-platform defaults. | A | OpenClaw sessions/subagents security config | analysed |
| B-OC-DEV-001 | DEV-003 | Consumed pairing bootstrap credential with uncertain response delivery is recorded as delivery-uncertain and reconciled by setup ID before declaring success/expiry. | A | OpenClaw device pairing RPC docs | analysed |
| B-OC-DEV-002 | DEV-004 | Remote node execution may retry only a recognized pre-execution not-ready rejection; disconnects/timeouts/failures after progress are not blindly replayed. | A | OpenClaw node invoke RPC docs | analysed |
| B-OC-APR-001 | APR-001 | Approval resolution is first-answer-wins and waiters settle from the canonical recorded result. | A | OpenClaw approval RPC docs | analysed |
| B-OC-APR-002 | APR-001 | Authority revoked before commit admission blocks a delayed mutation; disconnect alone does not revoke already admitted work. | A | OpenClaw approval/plugin SDK docs | analysed |
| B-OC-SKL-002 | SKL-009 | Saving a managed skill produces an immutable content-derived revision; identical save is a no-op and stale edit conflicts rather than overwrites. | A/B | OpenClaw skills docs | analysed |
| B-OC-SKL-003 | SKL-009 | Existing sessions retain selected skill IDs/revisions until explicit refresh/attachment; publishing a revision does not silently alter a running session. | A | OpenClaw skills docs | analysed |
| B-OC-MEM-003 | MEM-017 | Active-memory recall can only use tools remaining after parent effective policy/sandbox/provider restrictions; it cannot gain authority the parent lacks. | A | OpenClaw active-memory docs | analysed |
| B-OC-MEM-004 | MEM-017 | If recall tools are unavailable or recall fails, normal conversation continues without fabricated memory context. | A | OpenClaw active-memory docs | analysed |
| B-OC-PLG-001 | PLG-007 | A delayed plugin mutation rechecks current authority after async preparation; a stale owner boolean is not sufficient authorization. | A | OpenClaw Plugin SDK docs | analysed |
| B-OC-GW-004 | GW-001 | Gateway-accepted user input is durably recorded before acknowledgement; reconnect may reconcile accepted input, while the in-memory run queue is not treated as durable workflow truth. | A | OpenClaw queue/session docs | analysed |
| B-OC-SEC-002 | SEC-007 | Tool deny policy remains authoritative: session exec/elevation settings cannot make a deterministically denied tool callable, and required sandbox policy fails closed. | A | OpenClaw sandbox/tool-policy docs | analysed |
| B-AIRI-CARD-001 | IDN-004 | Imported character packages are validated before activation; invalid format/missing required assets do not become an active Character presentation. | A/B | AIRI card import docs/store | analysed |
| B-AIRI-CARD-002 | IDN-004 | A card override does not permanently replace inherited/global client defaults; switching to an inheriting card restores the true defaults. | B | AIRI airi-card inheritance tests | analysed |
| B-AIRI-CARD-003 | IDN-004 | Changing a provider cannot silently retain a model belonging to the previous/different provider. | A/B | AIRI airi-card inheritance tests/store | analysed |
| B-AIRI-AVT-001 | AVT-005 | Renderer/model-driver stop or dispose explicitly releases the target; generator replacement need not tear down the target. | B | AIRI MAGIC Live2D driver | analysed |
| B-AIRI-PLG-001 | PLG-009 | A wildcard permission request narrowed by host policy is stored/enforced as the concrete approved key, never widened back to the wildcard. | A | AIRI plugin permission tests | analysed |
| B-AIRI-PLG-002 | PLG-009 | Runtime-declared permissions extend the requested set but receive no authority until explicitly granted. | A | AIRI plugin permission tests | analysed |
| B-AIRI-PLG-003 | PLG-009 | A child module's effective grant cannot exceed the parent extension's permission ceiling. | A | AIRI plugin permission tests | analysed |
| B-AIRI-PLG-004 | PLG-010 | Unloading an extension retains session ownership until runtime and asset cleanup independently succeed; retry does not repeat already-completed cleanup. | A | AIRI ManagedExtensionSessions | analysed |
| B-AIRI-PLG-005 | PLG-010 | Owned asset creation requires the exact active extension ID + session ID, not either identifier alone. | A | AIRI managed-session test | analysed |
| B-AIRI-VOICE-001 | RTC-013 | A new voice-input start waits for an in-progress stop; an old teardown cannot close newly created microphone consumers. | A | AIRI voice-input lifecycle tests/ADR | analysed |
| B-AIRI-VOICE-002 | RTC-013 | Microphone startup errors propagate to the caller while partial resources remain cleanable; UI must not falsely remain enabled. | A | AIRI voice-input lifecycle tests | analysed |
| B-AIRI-VOICE-003 | RTC-013 | Replacing a stream/provider creates a fresh binding and an aborted prior binding cannot deliver late transcript callbacks into the replacement. | A | AIRI voice-input ADR | analysed |
| B-AIRI-CUA-001 | PER-004 | Browser DOM, terminal/tool and raw desktop control are distinct execution lanes; deterministic structured execution is preferred before blind coordinate action. | B | AIRI computer-use-mcp README | analysed |
| B-AIRI-CUA-002 | PER-004 | Computer-use actions retain approval, trace/audit and run evidence; approval alone is not treated as Masanawa's complete isolation policy. | A/B | AIRI computer-use-mcp + Masanawa security decision | analysed |
| B-LK-RTC-001 | RTC-016 | Detector-specific endpointing defaults may differ, explicit overrides win, and runtime endpointing overrides survive activity handoff. | A/B | LiveKit Agents endpointing tests | analysed |
| B-LK-RTC-002 | RTC-016 | A reply interrupted before its first audio playout cannot leave the speech handle wedged and block every subsequent turn. | A | LiveKit Agents interrupt-before-playout regression | analysed |
| B-LK-RTC-003 | RTC-016 | Interruption thresholds apply consistently to empty/short transcripts so incidental noise/backchannels need not stop output. | B | LiveKit Agents interruption tests | analysed |
| B-LK-RTC-004 | RTC-014 | Reusable realtime resources transfer ownership during activity handoff; untransferred resources are cleaned on failed next-start, transferred resources are not double-cleaned. | A | LiveKit Agents handoff tests | analysed |
| B-LK-AVT-001 | RTC-017 | Remote avatar lifecycle is tied to the active job/session and waits for the avatar participant/video track with a bounded timeout. | B | LiveKit Agents AvatarSession | analysed |
| B-LK-AVT-002 | RTC-017 | Cleanup treats an already-absent avatar participant as success; other remote cleanup failure is observable but must not leak local session ownership. | A/B | LiveKit Agents AvatarSession tests | analysed |
| B-LK-AVT-003 | RTC-017 | Ambiguous avatar provisioning may roll back local start state without blindly deleting a remote participant that may have been created successfully. | A | LiveKit Agents AvatarSession rollback | analysed |
| B-PC-RTC-001 | RTC-018 | Media/control items explicitly declare interruptibility; function-result/end/control work may remain uninterruptible while speech/text is interruptible. | A/B | Pipecat interruptible-frame tests | analysed |
| B-PC-RTC-002 | RTC-018 | TTS ordering preserves start -> audio -> stop boundaries and interruption during paused processing cannot permanently deadlock downstream work. | A | Pipecat TTS-ordering regressions | analysed |
| B-PC-RTC-003 | RTC-018 | Provider generation completion with zero audio and actual playout completion are distinct cases; either must not leave a pipeline indefinitely paused. | A | Pipecat TTS-ordering regressions | analysed |
| B-PC-RTC-004 | RTC-019 | Turn inference may begin speculatively before semantic finalization, but speculation must be explicitly confirmed or cancelled rather than silently committed. | B | Pipecat turn-stop strategy contracts | analysed |
| B-PRS-ARCH-001 | RTC-014 | LiveKit worker/job/session state is realtime infrastructure state and cannot become the durable Masanawa Task or Character identity record. | A | ADR-0006 | designed |

Deep behavior mining from tests remains required before Phase 0 completion.


### Phase 0A memory comparison additions

| ID | Feature | Required behavior | Class | Evidence | Status |
|---|---|---|---|---|---|
| B-MEM-010 | MEM-023 | Resolve tenant, character, relationship and visibility authorization before candidate lookup; retrieval scoring can never widen scope. | A | CWS privacy invariant + Mem0 explicit scope pinning | selected |
| B-MEM-011 | MEM-018 | Extraction runs asynchronously/idempotently after foreground persistence; failure or poison input cannot block conversation or later memory work. | A/B | Mem0 extraction architecture + N.E.K.O liveness | selected |
| B-MEM-012 | MEM-018 | Contradictory/new facts append with provenance and validity/supersession state instead of silently destroying historical evidence. | A/B | Mem0 ADD-only extraction + N.E.K.O archival | selected |
| B-MEM-013 | MEM-019 | Hybrid retrieval may combine semantic, lexical, entity and temporal signals only after scope filtering and must return provenance with compiled context. | A/B | Mem0 retrieval + Masanawa privacy boundary | selected |
| B-MEM-014 | MEM-021 | Always-visible working blocks are bounded compiled views; editing/projecting a block cannot mutate authored Character identity implicitly. | A/B | Letta Code memory blocks + Masanawa identity invariant | selected |
| B-MEM-015 | MEM-022 | Concurrent/stale memory workers cannot overwrite a newer revision; repair/retry transitions are token/version guarded and idempotent. | A | Letta Code memory operation/conflict repair | selected |
| B-MEM-016 | MEM-020 | Expiration hides ordinary recall without physical deletion; tombstone and physical purge remain separate policy-governed states. | B | Mem0 expiration/decay + Masanawa retention policy | selected |
| B-MEM-017 | MEM-024 | Vector/lexical/entity/temporal indexes can be deleted and rebuilt from canonical records without changing authorized semantic truth. | A | ADR-0007 | selected |
| B-MEM-018 | MEM-016 | Memory evaluation reports privacy leakage, retrieval accuracy, provenance correctness, context tokens, latency/cost and liveness under fixed retrieval budgets. | B | Mem0 evaluation methodology + Masanawa privacy requirements | selected |


### Phase 0A runtime/skills/plugins/workflow additions

| ID | Feature | Required behavior | Class | Evidence | Status |
|---|---|---|---|---|---|
| B-AGT-003 | AGT-014 | Repeated identical tool calls, polling loops and budget overruns terminate with typed evidence rather than running indefinitely. | A | OpenJarvis agent guards | selected |
| B-AGT-004 | AGT-014 | Explicit provider/engine selection is authoritative; fallback is allowed only for default/auto policy and must satisfy requested model capability. | A | OpenJarvis engine discovery | selected |
| B-AGT-005 | AGT-015 | Model output proposes execution but cannot manufacture access/disclosure/tool authority not present in the compiled run envelope. | A | elizaOS gates + Masanawa security invariant | selected |
| B-SKL-009 | SKL-009 | Invalid/cyclic skills are isolated without discarding healthy siblings, and model-hidden skills never enter the model-facing catalog. | A/B | OpenJarvis SkillManager | selected |
| B-SKL-010 | SKL-010 | File skill resources/scripts reject traversal and symlink escape at use time, not only at discovery. | A | Microsoft AF Agent Skills | selected |
| B-SKL-011 | SKL-009 | Learned/optimized skill output remains a candidate until certification publishes an immutable production version. | A | OpenJarvis overlays + CWS certification | selected |
| B-PLG-008 | PLG-012 | Core runtime never implicitly installs/imports unresolved package names; missing resolver or invalid dependency graph fails closed before activation. | A | elizaOS plugin loader | selected |
| B-PLG-009 | PLG-011 | Service shutdown rejects new admission before draining already-admitted work; stop/cleanup is idempotent. | A/B | elizaOS Service lifecycle + AIRI cleanup invariant | selected |
| B-WFL-001 | WFL-002 | Checkpoint restore requires a compatible versioned graph signature and follows checkpoint lineage rather than assuming iteration number identifies latest state. | A | Microsoft AF WorkflowCheckpoint | selected |
| B-WFL-002 | WFL-002 | Checkpoints preserve committed executor state, edge/fan-in delivery state and pending human/request events across pause/restart. | A | Microsoft AF checkpoint tests/contracts | selected |
| B-WFL-003 | WFL-003 | Resume never treats captured authorization as permanently valid; current authority is revalidated immediately before consequential mutation. | A | OpenClaw current-authority + MAF restore + CWS side-effect policy | selected |
| B-WFL-004 | WFL-003 | A restored or retried workflow checks durable side-effect receipts/reconciliation before reissuing a consequential provider call. | A | CWS idempotency/reconciliation + MAF checkpointing | selected |
| B-WFL-005 | AGT-012 | Steering/cancellation may prevent unstarted work but cannot undo, duplicate or blindly replay a side effect already admitted or executed. | A | OpenClaw steering + Masanawa workflow boundary | selected |

### Phase 0A world simulation comparison additions

| ID | Feature | Invariant / expected behavior | Class | Evidence | Status |
|---|---|---|---|---|---|
| B-WLD-004 | WLD-005 | Simulation time is explicit and monotonic; wall-clock receipt time does not silently become canonical simulation time. | A | AI Town AbstractGame/engine schema | selected |
| B-WLD-005 | WLD-006 | Two workers using the same world generation cannot both commit; a stale generation must reload/retry rather than overwrite newer truth. | A | AI Town generationNumber/loadEngine/applyEngineUpdate | selected |
| B-WLD-006 | WLD-006 | A committed simulation transition records admitted input outcomes with the world transition so retries can distinguish completed from unprocessed input. | A/B | AI Town runStep/applyEngineUpdate | selected |
| B-WLD-007 | WLD-009 | Approved shared canon is immutable except explicit retirement/replacement; model or simulation proposals do not silently rewrite it. | A | CWS life-event immutability + Star Constitution | selected |
| B-WLD-008 | WLD-009 | Automatic life events require an active published valid complete Character identity and retain visibility/provenance/effective-time metadata. | A | CWS star-life-engine + RPC | selected |
| B-WLD-009 | WLD-003/WLD-006 | Reprocessing the same deterministic routine/input occurrence cannot duplicate the authoritative world event. | A | CWS engine key + AI Town processed input semantics | selected |
| B-WLD-010 | WLD-010 | Pause/restart behavior follows versioned WorldPolicy: skip, bounded catch-up, queued-input replay or operator reconciliation; no universal replay rule is assumed. | B | AI Town restart semantics + Masanawa synthesis | selected |
| B-WLD-011 | WLD-008 | Spatial state is optional; disabling coordinates/pathfinding does not remove Character life state, routines or semantic locations. | A/B | AI Town spatial model + CWS coarse location | selected |
| B-WLD-012 | WLD-011 | Private relationship memory may influence a private interaction but cannot silently mutate shared Character/world canon. | A | CWS privacy invariant + memory ADR | selected |
| B-WLD-013 | WLD-011 | World events cross explicit typed boundaries to memory/workflows/presence; donor Agent/Player/session objects never become canonical world truth. | A | ADR-0009 | selected |

### Phase 0A OpenClaw Agent Skills additions

| ID | Feature | Invariant / expected behavior | Class | Evidence | Status |
|---|---|---|---|---|---|
| B-SKL-012 | SKL-011 | Imported/distributed skill bundles are validated before activation; invalid frontmatter or unsafe source/destination layout fails without corrupting healthy skills. | A/B | OpenClaw Agent Skills validator/installer tests | selected |
| B-EVL-001 | EVL-001 | Acceptance tests may validate externally observable behavior against a contract without depending on donor implementation internals. | A/B | behavior-validator skill | selected |
| B-DEV-001 | DEV-004 | Session/transcript artifacts intended for sharing require explicit redaction/provenance treatment; local private output is not implicitly publishable. | A | agent-transcript/session-viewer guidance | selected |

### Phase 0B ChatWithStars coverage additions

| ID | Feature | Required behavior | Class | Evidence | Status |
|---|---|---|---|---|---|
| B-SUB-001 | SUB-001 | Billing state alone never grants a capability; entitlement resolution and current policy determine usable access, and retries/webhooks remain idempotent. | A | runtime/admin subscription, entitlement and billing tests | analysed |
| B-PRV-001 | PRV-001 | Export/delete operates on the authenticated subject and declared inventory; deletion cannot silently erase immutable financial/audit evidence that must instead be minimized/retained by policy. | A | consumer privacy, data inventory and privacy routes | analysed |
| B-KNO-001 | KNO-001 | Knowledge retrieval is scoped before search and preserves source/evidence metadata; extracted content is not promoted to shared canon merely because it was ingested. | A/B | knowledge routes/extraction + grounding patterns | analysed |
| B-GRP-001 | GRP-001 | Group context and membership are explicit scopes; group conversation state cannot expose or merge a member's private relationship memory. | A | group membership/thread/listener tests | analysed |
| B-MSN-001 | MSN-001 | Autonomous mission work requires current authority, bounded policy and durable outcome/evaluation evidence; stale or revoked authority cannot commit a consequential action. | A/B | mission constitution/control/evaluator + durable authority tests | analysed |
| B-CRT-001 | CRT-001 | Creator/tenant provisioning and payout/service settings remain tenant-scoped and cannot authorize another tenant's funds, credentials or runtime. | A | tenant provisioning + creator mode/payout safety tests | analysed |
| B-TEL-001 | TEL-001 | A telecom/bill purchase has explicit quote/confirmation/order/provider outcome/reconciliation/receipt semantics and safe repeat handling. | A | bill-service/telecom/repeat/receipt tests | analysed |
| B-CVI-001 | CVI-001 | Civic/public-information assertions preserve jurisdiction, source and freshness/truth lifecycle; uncertain extraction is not silently promoted to canonical fact. | A/B | civic source/truth/jurisdiction/grounding tests | analysed |
| B-LEG-001 | LEG-001 | Legacy UI/runtime boundaries are not preserved as parallel Masanawa authorities; only required externally observable behavior and migration evidence survive. | C | old Astro surface + legacy contracts vs canonical platform services | selected |

### Phase 0B N.E.K.O coverage additions

| ID | Feature | Required behavior | Class | Evidence | Status |
|---|---|---|---|---|---|
| B-VOI-001 | VOI-001 | Voice-input endpointing/candidate decisions are explicit and cancellable; stale worker/candidate results cannot commit after the active turn changes. | A/B | ASR lifecycle, candidate-control, endpointing and worker-failure modules/tests | analysed |
| B-VOI-002 | VOI-002 | Speaker recognition is probabilistic evidence only and cannot by itself authenticate a user or rewrite durable identity. | A | speaker-shadow/voice-identity and speaker-trust boundaries | analysed |
| B-ACT-001 | ACT-001 | Activity/focus signals may propose proactive behavior but remain permission/frequency/privacy gated and cannot directly cause consequential side effects. | A/B | activity state machine + proactive settings/runtime | analysed |
| B-CFG-001 | CFG-001 | Config/cloud-save writes are staged/versioned and migration-aware; partial or stale snapshots cannot silently replace a newer healthy configuration. | A/B | cloudsave runtime fences/staging/snapshots + config migrations | analysed |
| B-PLG-012 | PLG-012 | Plugin communication is schema/permission validated and lifecycle bounded; plugin deadlock/crash/reload cannot become canonical domain truth or stall the host indefinitely. | A | plugin message plane, host, deadlock detector and tests | analysed |
| B-AST-001 | AST-001 | Bundled models/corpora/binaries are never inherited under the repository license by assumption; each artifact requires its own provenance/license record before redistribution. | A | third-party notices, corpus license files, vendored deps | selected |
| B-EXT-001 | EXT-001 | Optional games/watch/music extensions consume Character/session contracts without becoming alternate memory, identity or world authorities. | B/C | game/watch/music routers and SDK | selected |

### Phase 0B provider synthesis invariants

| ID | Feature | Required behavior | Class | Evidence | Status |
|---|---|---|---|---|---|
| B-PRV-001 | provider execution | A provider adapter cannot directly commit canonical business/domain success; only the owning domain/workflow may transition after validated provider evidence. | A | cross-donor synthesis; commerce/social/studio/channel evidence | selected |
| B-PRV-002 | provider retries | Generic middleware must never blindly retry consequential writes after timeout/network ambiguity. Retry class is declared per operation. | A | Flutterwave side-effect flag, Telegram document no-auto-retry, workflow idempotency evidence | selected |
| B-PRV-003 | provider reconciliation | Ambiguous consequential outcomes create reconciliation work and must be resolved before repeat execution unless the provider offers documented replay-safe idempotency. | A | Flutterwave pending/uncertain lookup + provider inbox; Telegram ambiguity | selected |
| B-PRV-004 | readiness | Configured, ready and accepted are distinct states; stale credential/egress/webhook/provider evidence invalidates dependent readiness/acceptance. | A | Flutterwave cutover fingerprint/expiry invalidation | selected |
| B-PRV-005 | provider credentials | Raw provider credentials never enter domain records, model context, audit logs or traces; execution resolves scoped vault refs only at the edge. | A | ChatWithStars vault/encryption patterns + Masanawa security boundary | selected |
| B-PRV-006 | provider idempotency | Canonical workflow idempotency remains authoritative even when the provider supplies its own idempotency/reference key; provider receipts are deduplicated before domain application. | A | Flutterwave/NOWPayments/Telegram/workflow evidence | selected |
| B-PRV-007 | model providers | Model retries may repeat inference because model output is only a proposal, but every attempt still counts for cost/rate-limit evidence and cannot itself commit business truth. | A/B | Gemini routing/quota evidence + decision fabric boundary | selected |

### Phase 0B OpenJarvis remediation invariants

| ID | Feature | Required behavior | Class | Evidence | Status |
|---|---|---|---|---|---|
| B-CON-020 | CON-020 | Progress, cancellation or failure may persist a resume cursor but must not advance the last-successful sync watermark; only exhaustion/success advances the watermark. | A | `connectors/sync_engine.py`, incremental/sync-engine tests | analysed |
| B-LRN-020 | LRN-020 | Learning edits are candidates: require minimum evidence, bounded cost/tool budget and risk tier; benchmark regression rejects/rolls back staged change; review-tier changes wait for explicit approval. | A/B | spec-search orchestrator, checkpoint store, benchmark/regression/pending-queue tests | analysed |
| B-LRN-021 | LRN-020 | Learning rollback preserves history by reverting committed staged changes rather than rewriting history, and dirty configuration state blocks automated staging. | A/B | `checkpoint/store.py`, rollback tests | analysed |
| B-APR-020 | APR-020 | A dangerous tool cannot execute merely because confirmation infrastructure is absent: non-interactive/no-callback/denied cases all fail closed. | A | `test_tool_confirmation.py` | analysed |
| B-SES-020 | SES-020 | Channel history may feed runtime context, but session linkage is not proof of canonical user identity and must not merge private relationship memory without identity authorization. | A/B | session store + wire-channel-history tests, Masanawa relationship rules | selected |
| B-SCH-020 | SCH-020 | Cron evaluation uses configured IANA timezone but persists next run in UTC; pause/resume/cancel are durable and one-shot tasks clear next run after completion. | A/B | scheduler implementation/tests | analysed |
| B-TRC-020 | TRC-020 | Trace collectors unsubscribe at run completion so later events cannot contaminate another execution trace. | A | `traces/collector.py`, collector tests | analysed |
| B-SEC-020 | SEC-021 | SSRF checks fail closed on unresolved DNS by default and normalize IPv4-mapped/compatible/disguised forms before private/metadata classification. | A | `security/ssrf.py`, SSRF/disguised tests | analysed |

### Phase 0B N.E.K.O remediation invariants

| ID | Feature | Required behavior | Class | Evidence | Status |
|---|---|---|---|---|---|
| B-PLG-020 | PLG-001/012 | Plugin replacement is transactional: invalid/preflight-broken source cannot displace a healthy running instance; hot reload rechecks running intent under the operation lock and cannot resurrect an explicitly stopped plugin. | A | plugin lifecycle/hot-reload/install transaction modules and tests | analysed |
| B-PLG-021 | PLG-012 | Plugin calls have typed envelopes and bounded call chains; circular/deadlocked calls fail explicitly rather than blocking the host indefinitely. | A/B | plugin core/message-plane/call-chain/deadlock modules | analysed |
| B-ASR-020 | VOI-001 | Voice endpoint/candidate callbacks are generation-scoped; a stale candidate/provider worker result cannot deliver after suppression, replacement or turn closure. | A | ASR lifecycle/candidate/worker/endpointing tests | analysed |
| B-SPK-020 | VOI-002/VID-001 | Enrollment/activation is reversible and policy-versioned; cancellation/failure restores voice-input suppression and wipes/closes sensitive model state. | A | voice identity service/runtime tests | analysed |
| B-CFG-020 | CFG-001 | Cloud/config restore is staged and fenced; stale, partial or legacy-migration output cannot replace a newer verified current revision. | A/B | cloudsave runtime lifecycle/startup/config tests | analysed |
| B-ACT-020 | ACT-001 | Raw device activity may be visible/private/unavailable; private/unavailable state cannot be silently enriched into inferred user activity or proactive context. | A | activity privacy/state/gating evidence | selected |

### Phase 0B CyberVerse clean-room invariants

| ID | Feature | Required behavior | Class | Evidence | Status |
|---|---|---|---|---|---|
| B-RTC-030 | RTC-006/007 | AV feedback is scoped to the active playback epoch; stale feedback from an older turn cannot change current audio delay/sync state. | A | direct audio-delay tests | selected clean-room |
| B-RTC-031 | RTC-007 | RTP gap clocks reset across playback epochs but remain continuous within one epoch; real idle gaps may advance media time while normal jitter does not. | A/B | direct RTP gap/pacing tests | selected clean-room |
| B-RTC-032 | RTC-007 | Media-path reset clears transport/media sync state without tearing down still-valid user input channels unnecessarily. | A/B | direct media-path reset test | selected clean-room |
| B-RTC-033 | RTC-008 | Avatar-disabled mode remains a valid audio-only session and must not call avatar generation; conversation history/session state still progresses. | A | orchestrator audio-only test | selected clean-room |
| B-RTC-034 | AVT-003/004 | Idle/avatar media caches are keyed by renderer-relevant profile/resolution; wrong-resolution cache entries are not reused. | B | idle-video tests | selected clean-room |
| B-TSK-030 | TSK-005/006 | Task events are monotonically sequenced and terminal tasks reject late events and artifacts. | A | agenttask store tests | selected clean-room |
| B-TSK-031 | TSK-006 | Reconnect/catch-up reads task events strictly after a supplied sequence cursor and preserves ordering. | A | agenttask event store/API tests | selected clean-room |
| B-TSK-032 | TSK-005 | External task/artifact IDs are validated against path traversal before any filesystem persistence. | A | agenttask external-ID tests | selected clean-room |
| B-RAG-030 | RAG-001 | Re-indexing a source replaces that source's prior chunks rather than silently accumulating stale copies; source provenance remains query-visible. | A/B | RAG engine/vector backend behavior | selected clean-room |
| B-RAG-031 | RAG-001 | Vector backend scores are normalized to one higher-is-better contract before min-score filtering, regardless of backend metric representation. | B | vector-store backend interface | selected clean-room |

### Phase 0B AIRI descendant invariants

| ID | Feature | Required behavior | Class | Evidence | Status |
|---|---|---|---|---|---|
| B-PLG-030 | PLG-030 | Extension activation planning is side-effect free and deterministic; missing/incompatible dependencies, duplicate providers, runtime/version mismatch and dependency cycles block activation before lifecycle mutation. | A | plugin activation planner/tests | analysed |
| B-PLG-031 | PLG-031 | Effective permission = intersection(requested, granted); wildcard requests are narrowed to concrete approved keys/actions and child-module grants cannot exceed the parent extension ceiling. | A | permission service/tests | analysed |
| B-RTC-040 | RTC-040 | Voice-input start/stop/replace operations serialize; a newer binding supersedes queued stale work, an in-flight old start is cleaned before replacement, and failed start remains an error while cleanup still runs. | A | voice-input lifecycle/binding tests | analysed |
| B-AVT-030 | AVT-030 | Replacing an active renderer generator must not release the target; stop/dispose releases target exactly once and clears generated/filter state. | A/B | MAGIC Live2D driver tests | analysed |
| B-CUA-030 | CUA-030 | Desktop tool input is restricted to an allowlisted command grammar; host-owned routing/storage flags cannot be overridden; screenshot reads resolve real paths and stay inside the artifact store. | A | AIRI computer-use runtime/tests | analysed |
| B-CUA-031 | CUA-030 | Desktop commands are serialized; a failed command cannot poison the queue; disposal rejects queued/future work and tears down private daemon/socket state. | A | AIRI computer-use runtime/tests | analysed |
| B-MOB-001 | MOB-001 | Native-host WebSocket bridge distinguishes close-before-open from post-open close and removes closed session mappings so stale native events cannot target a new logical connection. | A/B | Stage Pocket bridge implementation/tests | analysed |

### Phase 0B LiveKit Server transport invariants

| ID | Feature | Required behavior | Class | Evidence | Status |
|---|---|---|---|---|---|
| B-RTC-050 | RTC-050 | Room admission enforces configured participant limits; track publication is checked against participant publish/source permissions before media becomes visible. | A | room/participant tests | analysed |
| B-RTC-051 | RTC-050 | Participant state/track updates are versioned/ordered so stale or out-of-order updates cannot silently replace newer participant state. | A/B | participant/room update tests | analysed |
| B-RTC-052 | RTC-051 | Migration continuity buffers are size/time bounded; overflow/timeout degrades explicitly rather than growing unbounded. | A | migration data cache tests | analysed |
| B-RTC-053 | RTC-052 | RTP accounting distinguishes loss, out-of-order, duplicate and restart conditions; old/pre-start packets do not rewrite current stream baseline. | A/B | RTP stats tests | analysed |
| B-RTC-054 | RTC-052 | Connection-quality scoring is transport telemetry only; muted/no-packet states are interpreted explicitly and never become Character/user quality truth. | B | connection quality tests | selected |
| B-RTC-055 | RTC-053 | Node/room routing may relocate transport, but Masanawa PresenceSession/CharacterSession identity survives infrastructure placement changes. | A/B | routing/migration architecture + ADR-0006 | selected |

### Phase 0B LiveKit Agents TypeScript invariants

| ID | Feature | Required behavior | Class | Evidence | Status |
|---|---|---|---|---|---|
| B-RTC-060 | RTC-060 | Endpointing defaults are detector-aware, while explicit runtime overrides survive activity/agent handoff. | A/B | agent_session_endpointing tests | analysed |
| B-RTC-061 | RTC-061 | STT/realtime resources transfer only when implementation, context, tool and capability compatibility allows; ownership transfers exactly once and failed destination startup cleans only untransferred resources. | A | agent_activity_handoff tests | analysed |
| B-RTC-062 | RTC-062 | A user interruption before first playout frame cannot wedge future speech or discard a later-resumed valid turn; playback-start evidence may arrive after generation forwarding ends. | A | generation_interrupt_before_first_frame + deadlock tests | analysed |
| B-RTC-063 | RTC-063 | Generated text/audio completion, playback start and playback completion are separate facts; transcript synchronization follows actual playout timing. | A | generation/transcription synchronizer tests | analysed |
| B-PVD-020 | PVD-020 | Provider fallback after output has begun is policy-controlled; failure of one provider changes availability/recovery state but must not silently duplicate partial user-visible output unless explicitly permitted. | A/B | LLM/STT/TTS fallback adapter tests | analysed |
| B-AVT-040 | AVT-040 | Avatar output is optional/recoverable; ambiguous remote startup or cleanup cannot destroy the underlying live session, and already-absent remote avatar state is idempotent cleanup. | A/B | avatar session tests | analysed |

### Phase 0B LiveKit Agents Python parity/delta invariants

| ID | Feature | Required behavior | Class | Evidence | Status |
|---|---|---|---|---|---|
| B-RTC-070 | RTC-070 | Realtime fallback candidates must agree on pipeline-shaping hard capabilities; soft capabilities expose only the intersection supported by every candidate. | A | realtime fallback adapter | analysed |
| B-RTC-071 | RTC-070 | During realtime provider swap, interrupt current playout through the session, preserve user-heard chat context/instructions/tools, drop live audio arriving during swap rather than replaying stale audio, and reissue reply only under explicit policy. | A | realtime fallback adapter | analysed |
| B-SPK-030 | SPK-030 | A diarization wrapper may identify/suppress background speakers, but speaker classification is conversational evidence only; wrapped-provider usage/metrics must not be counted twice. | A/B | multi-speaker adapter + tests | analysed |
| B-EVL-030 | EVL-030 | Post-session evaluators run independently/concurrently; a failed judge does not invalidate other judgments, and evaluation output remains evidence rather than self-authorizing production changes. | A/B | eval JudgeGroup/evaluation code | analysed |
| B-OBS-030 | OBS-030 | Conversational/tool payload PII is removed before unauthorized exporters receive telemetry; free-form exception descriptions are replaced while structured error type may remain. | A | telemetry pii filter | analysed |
| B-EXP-001 | EXP-001 | Serialized execution frames are research evidence only and cannot become Masanawa durable workflow truth without version/hash compatibility, checkpoint semantics and a separate architecture decision. | B/C | livekit-durable registry/function implementation | selected |
