# Phase 0A — Landscape Expansion

## Why this checkpoint exists

The original donor set (ChatWithStars, OpenJarvis, N.E.K.O, CyberVerse) was useful but not sufficient to prove we had surveyed the strongest available open-source architecture before rewriting Masanawa.

Before architecture freeze, we therefore added a broader reference vault and paused implementation.

## Reference families

### Original four
- ChatWithStars
- OpenJarvis
- N.E.K.O
- CyberVerse

### Expanded landscape
- AIRI
- LiveKit server
- LiveKit Agents TypeScript
- LiveKit Agents Python
- Pipecat
- Letta server
- Letta Code
- Mem0
- AI Town
- elizaOS
- Microsoft Agent Framework
- OpenClaw
- OpenClaw Agent Skills

Exact commits and local paths: `SOURCE-LOCK.md`.

## Evaluation questions

Every new donor must be evaluated with the same questions:

1. What mature capability does it provide that our current donors lack?
2. Is it a framework, product, infrastructure component or reference implementation?
3. Which behavior is proven by source/tests rather than README claims?
4. What state does it own?
5. How does it isolate users/agents/tenants?
6. What is its tool/skill/plugin/provider model?
7. How does it handle side effects, approval and idempotency?
8. How does it recover from crash/reconnect/retry?
9. How does it represent sessions, memory, tasks and background work?
10. How does it support local/cloud/device execution?
11. What observability/operational controls exist?
12. What license constraints affect direct adaptation?
13. Does adopting its skeleton simplify Masanawa or introduce a second source of truth?
14. Which exact Masanawa package/service would own the adapted behavior?

## Required deep comparisons before donor freeze

### Skills/runtime
OpenJarvis vs OpenClaw vs elizaOS vs Microsoft Agent Framework.

### Memory
N.E.K.O vs Letta vs Mem0 vs OpenClaw, while ChatWithStars privacy/world isolation remains a hard requirement.

### Realtime presence
LiveKit/Agents vs Pipecat vs CyberVerse vs AIRI embodiment.

### Gateway/channels/device nodes
OpenClaw vs elizaOS vs existing CWS channel/runtime behavior.

### World simulation
AI Town vs ChatWithStars world/life engine.

### Plugins
elizaOS vs N.E.K.O vs OpenClaw.

## Freeze gate

Phase 0A ends only when:
- each expanded donor has a source map;
- major candidate features are represented in FEATURE-LEDGER;
- important behavior/data/integration findings are recorded;
- licenses are verified;
- overlapping subsystems have comparative donor decisions;
- SOURCE-OWNERSHIP no longer contains unresolved primary-candidate conflicts for the foundation subsystems.

Only then resume the remaining original-donor deep mining and complete Phase 0 coverage proof.
