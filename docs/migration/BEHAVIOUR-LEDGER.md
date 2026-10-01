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
| B-SKL-001 | SKL-002 | A blocked/uncertified skill cannot be advertised/routed as available for consequential execution. | A | CWS SKILL-TOOL-ROUTING | analysed |
| B-SKL-002 | SKL-004 | Cyclic skill dependencies must be rejected before production execution. | A | OpenJarvis skills architecture | discovered |
| B-TOL-001 | TOL-002 | Tool readiness must include authorization/health, not merely existence of a prompt or binding. | A | CWS SKILL-TOOL-ROUTING | analysed |
| B-COM-001 | COM-001 | An uncertain external financial/provider result is reconciled before retry that could duplicate a side effect. | A | CWS PLATFORM-FOCUS | analysed |
| B-COM-002 | COM-001 | Price/quote occurs before payment; high-impact execution receives confirmation/approval at the correct boundary. | A | CWS PLATFORM-FOCUS | analysed |
| B-COM-003 | COM-002 | Derived balance must be explainable from immutable/append-only ledger evidence. | A | CWS PLATFORM-FOCUS | analysed |
| B-AGT-001 | AGT-003 | Long-running specialist work must not replace the foreground character identity. | B | CyberVerse PersonaAgent design | analysed |
| B-AGT-002 | AGT-003 | Foreground persona should acknowledge accepted long work promptly before background execution blocks realtime conversation. | B | CyberVerse PersonaAgent design | analysed |
| B-TSK-001 | TSK-002 | Reconnecting clients can recover task progress from ordered persisted task events. | A | CyberVerse PersonaAgent/TaskService design | analysed |
| B-TSK-002 | TSK-001 | Terminal tasks reject late running/completed/artifact mutations. | A | CyberVerse design/store tests (to deep verify) | discovered |
| B-RTC-001 | RTC-002 | User speech during character output interrupts output without destroying session/conversation continuity. | A | CyberVerse README/tests (deep verify pending) | discovered |
| B-RTC-002 | RTC-004 | Disabling avatar rendering still permits a functioning voice session. | A | CyberVerse README/config | analysed |
| B-WLD-001 | WLD-001 | Shared character/world events remain consistent across users while private memories remain isolated. | A | CWS PLATFORM-FOCUS | analysed |
| B-IDN-001 | IDN-001 | Production character face/voice/core biography cannot silently mutate from an ad-hoc prompt edit. | A | CWS PLATFORM-FOCUS | analysed |
| B-DEC-001 | DEC-001 | Low-confidence/model decision never authorizes paid/destructive execution. | A | CWS PLATFORM-FOCUS/JEV | analysed |
| B-PLG-001 | PLG-001 | Extension failure must be isolated from the host process as far as plugin architecture permits. | B | N.E.K.O plugin process model | discovered |
| B-LRN-001 | LRN-003 | Learned/optimized skill changes are candidates and require evaluation/certification before consequential production promotion. | A | Masanawa decision from CWS+OpenJarvis | designed |

Deep behavior mining from tests remains required before Phase 0 completion.
