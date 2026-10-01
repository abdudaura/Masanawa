# Source Ownership and Donor Decisions

## Governing principle

ChatWithStars, OpenJarvis, N.E.K.O and CyberVerse are donors/reference systems. Masanawa owns the resulting architecture.

## Domain donor matrix

| Masanawa domain | Primary donor | Secondary donor | Masanawa additions |
|---|---|---|---|
| Product/domain model | ChatWithStars | — | generalized beyond Stars product |
| Character identity/versioning | ChatWithStars | N.E.K.O character-card experience | canonical Constitution/identity compiler |
| Shared world/life | ChatWithStars | N.E.K.O time awareness | explicit world engine |
| Private relationships | ChatWithStars | N.E.K.O companion continuity | strict type+scope memory |
| Memory taxonomy | N.E.K.O | ChatWithStars | unified scoped memory service |
| Agent execution | OpenJarvis | CyberVerse foreground/background | character-aware execution envelope |
| Skills | OpenJarvis | ChatWithStars | CWS governance/certification/risk |
| Tools | OpenJarvis | ChatWithStars | provider-neutral capability/readiness |
| Learning/traces | OpenJarvis | ChatWithStars JEV/rehearsal | gated candidate promotion |
| Decision fabric | ChatWithStars JEV | — | generalized platform decisions |
| Durable workflows | ChatWithStars | N.E.K.O task concepts | canonical workflow engine |
| Proactivity | N.E.K.O | ChatWithStars world/routines | permission/frequency/privacy gates |
| Perception | N.E.K.O | CyberVerse media | canonical PerceptionEvent |
| Realtime presence | CyberVerse architecture | ChatWithStars calls | clean implementation, no GPL core copy |
| Avatars | N.E.K.O breadth | CyberVerse generated humans | AvatarProvider abstraction |
| Social | ChatWithStars | N.E.K.O AI social concept | canonical outbox/publish state |
| Commerce | ChatWithStars | — | deterministic ledger/reconciliation |
| Studio | ChatWithStars | CyberVerse live media concepts | separate produced-media pipeline |
| Ops/governance | ChatWithStars | OpenJarvis evaluation | unified operator control |
| Plugin ecosystem | N.E.K.O packaging | OpenJarvis skills | plugin registers canonical components |

## Skills decision

OpenJarvis is the structural donor because its system separates:
- SkillManager;
- parser;
- loader;
- dependency graph;
- executor;
- SkillTool adapter;
- source resolvers/importers;
- security/trust;
- learning overlays.

ChatWithStars remains the governance donor because its design adds:
- SkillVersion;
- risk;
- approvals;
- pricing;
- idempotency;
- provider reconciliation;
- expertise bindings;
- JEV routing;
- rehearsal;
- certification/readiness.

Masanawa must combine these, not choose one or run both.

## Memory decision

N.E.K.O's working/recent/factual/reflection/persona concepts are a useful cognitive taxonomy. ChatWithStars contributes multi-user privacy and world/fan separation. Masanawa implements a new type+scope memory model; neither source storage system is imported as canonical.

## Presence decision

CyberVerse is studied for WebRTC, realtime digital-human services, interruption and foreground/background patterns. Because its repository is GPLv3, its code must not be copied into proprietary Masanawa core without a deliberate licensing decision. Prefer clean implementation from documented behavior/architecture.

## Donor conflict procedure

When two sources solve the same capability:
1. record both in FEATURE-LEDGER;
2. compare behavior and operational maturity;
3. select structural donor;
4. preserve any stronger behavior from the other;
5. record decision in an ADR or this matrix;
6. create parity fixtures;
7. implement once.

Never keep both implementations as a shortcut.
