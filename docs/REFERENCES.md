# External and Source References

## Donor repositories

- ChatWithStars: https://github.com/Baatiku/chatwithstars
- OpenJarvis: https://github.com/open-jarvis/OpenJarvis
- N.E.K.O: https://github.com/Project-N-E-K-O/N.E.K.O
- CyberVerse: https://github.com/Lynpoint/CyberVerse

Use exact revisions from `migration/SOURCE-LOCK.md`, not floating branches, for Phase 0 evidence.

## Particularly important OpenJarvis references

At the pinned revision, inspect at minimum:
- `docs/architecture/overview.md`
- `docs/architecture/agents.md`
- `docs/architecture/skills.md`
- `docs/architecture/memory.md`
- `docs/architecture/learning.md`
- `docs/architecture/engine.md`
- `src/openjarvis/skills/`
- `src/openjarvis/agents/`
- tool/execution/event/trace implementations and tests.

## Particularly important N.E.K.O references

Inspect at minimum:
- README architecture/features;
- `memory/`;
- `main_logic/`;
- `brain/`;
- plugin subsystem;
- character/persona configuration;
- proactive/activity/topic logic;
- realtime clients;
- avatar/frontend interaction logic;
- source tests and developer docs.

## Particularly important CyberVerse references

Inspect at minimum:
- README architecture;
- `inference/core/`;
- `inference/services/`;
- `inference/plugins/`;
- `inference/rag/`;
- `server/`;
- WebRTC/frontend session logic;
- digital-human/avatar services;
- interruption/foreground-background behavior;
- tests/configuration.

## Particularly important ChatWithStars references

Use `platform-unification` pinned source and inspect:
- canonical docs such as PLATFORM-FOCUS, SKILL-TOOL-ROUTING, JEV architecture, experience/ops/completeness docs;
- `services/runtime`;
- `services/calls`;
- `packages/contracts`;
- `apps/admin`;
- database migrations;
- current tests;
- world/identity/memory/handoff/commerce/social/studio implementations and historical compatibility behaviors still present.

## Technology references at foundation date

Official sources used for the initial technology ADR:
- Node.js downloads/releases: https://nodejs.org/en/download
- TypeScript 6 documentation: https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
- Next.js release/security blog: https://nextjs.org/blog
- Fastify documentation: https://fastify.dev/docs/latest/
- Python releases: https://www.python.org/downloads/
- PostgreSQL versioning: https://www.postgresql.org/support/versioning/

Technology references should be rechecked before major version upgrades.
