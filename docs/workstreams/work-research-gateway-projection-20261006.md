# Work/Research Gateway projection seam

Status: CLAIMED — 2026-10-06
Branch: `work/work-research-gateway-projection-20261006`
Base: PR #136 production integration head

Owned paths only:
- `services/gateway/src/work_research_room.ts`
- `services/gateway/src/work_research_room.test.ts`
- `docs/workstreams/work-research-gateway-projection-20261006.md`

No edits to `services/gateway/src/app.ts`, `main.ts`, mobile router/chat/transport, migrations, production env, Commerce, or Workflow implementation.

Goal:
- produce server-owned Work & Business / Research & Answers room projections;
- map canonical run/progress/artifact/evidence inputs into the mobile Lane W contract;
- expose opaque quick-start intent ids only;
- require HTTPS source/artifact URLs;
- fail closed on malformed current-research evidence;
- do not execute work, research, providers, or workflows here.

Shared #136 owner mounts the route and resolves quick-start intents into the canonical runtime.