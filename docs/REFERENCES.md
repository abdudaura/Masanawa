# External and Source References

## Canonical local reference vault

All donor repositories are available as pinned submodules under `references/sources/`.

Read:
- `references/README.md` for usage rules;
- `references/SOURCES.md` for the navigation index;
- `migration/SOURCE-LOCK.md` for exact revisions;
- `migration/LICENSE-LEDGER.md` before direct code adaptation.

Do not use floating upstream branches as Phase 0 evidence unless performing an explicit reference refresh.

## Donor groups

### Domain/product
- Baatiku/chatwithstars

### Agent/runtime/workflow
- open-jarvis/OpenJarvis
- elizaOS/eliza
- microsoft/agent-framework
- openclaw/openclaw

### Companion/digital life
- Project-N-E-K-O/N.E.K.O
- moeru-ai/airi

### Memory
- letta-ai/letta
- letta-ai/letta-code
- mem0ai/mem0
- openclaw/openclaw memory system

### Presence
- livekit/livekit
- livekit/agents-js
- livekit/agents
- pipecat-ai/pipecat
- Lynpoint/CyberVerse

### World
- a16z-infra/ai-town

### Skills
- OpenJarvis skill system
- OpenClaw skill system
- openclaw/agent-skills
- Microsoft Agent Framework skills
- CWS Skill Contract governance

## OpenClaw areas to inspect

At the pinned revision inspect at minimum:
- Gateway/concepts architecture;
- agent runtime/workspaces/sessions;
- multi-agent routing/bindings;
- channels;
- nodes/platforms;
- tools/security/sandbox;
- skills/install/update/verify/workshop/ClawHub;
- plugins;
- memory/search/dreaming/wiki/user model;
- queue/steering;
- cron/intents;
- operator/control UI and device trust.

## Existing deep-mined sources

### ChatWithStars
Inspect canonical docs, runtime/calls, migrations, automation, studio, Ops and tests.

### OpenJarvis
Inspect architecture docs, agents, skills, tools, engine, security, traces/learning, scheduler and tests.

### N.E.K.O
Inspect memory, proactivity, plugin lifecycle/SDK, character/avatar/voice, computer/browser use and extensive tests.

### CyberVerse
Inspect Go session/media server, Python inference plugins, PersonaAgent/SubAgent, task store/recovery, avatar synchronization and visual input.

## Expanded donor source maps

Initial maps live under `migration/sources/`. Phase 0A must deepen them before donor freeze.

## Technology references at foundation date

- Node.js: https://nodejs.org/en/download
- TypeScript: https://www.typescriptlang.org/docs/
- Next.js: https://nextjs.org/blog
- Fastify: https://fastify.dev/docs/latest/
- Python: https://www.python.org/downloads/
- PostgreSQL: https://www.postgresql.org/support/versioning/

Recheck technology sources before major version upgrades.
