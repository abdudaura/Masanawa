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

## Seed invariants

| ID | Feature | Required behavior | Class |
|---|---|---|---|
| B-MEM-001 | MEM-002 | A private fact learned from user A must never appear in user B's character context without an explicit privacy-safe promotion rule. | A |
| B-RTC-001 | RTC-002 | When a user speaks during character speech, current output is interrupted without destroying conversation/session continuity. | A |
| B-COM-001 | COM-001 | An uncertain external financial/provider result is reconciled before any retry that could duplicate a side effect. | A |
| B-SKL-001 | SKL-002 | A blocked/uncertified skill cannot be advertised/routed as available for consequential execution. | A |
| B-AGT-001 | AGT-002 | Long-running specialist work must not require replacing the foreground character identity. | B |
| B-WLD-001 | WLD-001 | Shared character/world events are consistent across users while private user memories remain isolated. | A |

Phase 0 must mine source tests because edge-case tests often reveal important behavior not mentioned by README files.
