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
| B-LRN-001 | LRN-003 | Learned/optimized skill changes are candidates and require evaluation/certification before consequential production promotion. | A | Masanawa decision from CWS+OpenJarvis | designed |

Deep behavior mining from tests remains required before Phase 0 completion.
