# Feature Ledger

Status: Phase 0 working document.

Purpose: exhaustive inventory of every meaningful capability across the four pinned sources.

## Required fields

| Field | Meaning |
|---|---|
| ID | Stable Masanawa migration ID |
| Domain | Canonical Masanawa domain |
| Feature | Human-readable capability |
| Source | Source repository |
| Source refs | Files/docs/tests that prove behavior |
| Maturity | prototype / working / production-oriented |
| Class | A preserve / B redesign / C retire |
| Donor role | primary / secondary / reference |
| Masanawa destination | canonical package/service |
| Dependencies | capabilities/data/providers |
| Behavior IDs | links to BEHAVIOUR-LEDGER |
| Data IDs | links to DATA-LEDGER |
| Integration IDs | links to INTEGRATION-LEDGER |
| License note | relevant provenance/license |
| Status | migration lifecycle |
| Evidence | tests/PRs/commits after implementation |
| Notes | conflicts, risks, decisions |

## Domain taxonomy

- foundation
- identity
- relationships
- memory
- world
- decisions
- agents
- skills
- tools
- workflows
- perception
- proactivity
- presence
- avatar
- channels
- social
- commerce
- studio
- plugins
- learning/evaluation
- security
- operations
- observability
- infrastructure
- developer experience

## Seed decisions

| ID | Domain | Feature | Source | Class | Donor role | Masanawa destination | Status |
|---|---|---|---|---|---|---|---|
| SKL-001 | skills | SkillManager/discovery architecture | OpenJarvis | B | primary | packages/skills | discovered |
| SKL-002 | skills | versioned certification/risk/expertise | ChatWithStars | A | primary governance | packages/skills | discovered |
| MEM-001 | memory | layered cognitive memory concepts | N.E.K.O | B | primary taxonomy | packages/memory | discovered |
| MEM-002 | memory | fan/user isolation from shared world state | ChatWithStars | A | primary privacy | packages/memory | discovered |
| RTC-001 | presence | WebRTC realtime digital-human session | CyberVerse | B | primary architecture | services/presence | discovered |
| RTC-002 | presence | barge-in/interruption | CyberVerse | A | primary behavior | services/presence | discovered |
| AGT-001 | agents | pluggable agent strategies | OpenJarvis | B | primary | packages/agents | discovered |
| AGT-002 | agents | foreground persona/background specialist | CyberVerse | B | primary pattern | packages/agents + runtime | discovered |
| WLD-001 | world | shared character life state/events | ChatWithStars | A | primary | packages/world | discovered |
| PRO-001 | proactivity | proactive/time-aware interaction | N.E.K.O | B | primary | packages/proactivity | discovered |
| COM-001 | commerce | quote/payment/approval/reconcile/receipt | ChatWithStars | A | primary | packages/commerce + workflows | discovered |
| SOC-001 | social | durable character social publishing | ChatWithStars | A | primary | services/social | discovered |
| STD-001 | studio | produced media pipeline | ChatWithStars | A | primary | services/studio | discovered |

This seed is not exhaustive. Phase 0 must expand it by systematic source inspection.
