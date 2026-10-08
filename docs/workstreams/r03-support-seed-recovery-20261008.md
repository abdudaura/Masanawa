# R03 — Recover interrupted default support-agent provisioning

- Owner: ChatGPT independent R03 Gateway bootstrap lane.
- Branch: `work/r03-support-seed-recovery-20261008`; base main SHA `ae80941295d67c53d8e3eff1aa0447af8f49ec6e`.
- Last repository-visible update: 2026-10-08T05:59:17.867Z.
- Scope: `services/gateway/src/platform_agent_bootstrap.ts`, `services/gateway/src/platform_agent_bootstrap.test.ts`, this claim only.
- Dependency: existing canonical Character, presentation, skill assignment and support-profile repositories; no shared Gateway composition, schemas, persona pricing or public AI Seat catalog edits.
- Found gap: bootstrap returns as soon as it sees one support profile, leaving missing Gwana or Gwani after a partial migration; stale presentation/skills may need completing. Preserve admin-owned noncanonical profiles and all existing edits; never use new IDs for an existing character.
- Work: CLAIMED; design conservative interrupted-default-only recovery, tests for partial and admin-existing profiles. Do not seed unavailable 15 experts or claim AI Talk audio readiness.
- Verification/deployment/device: not run, not deployed, no voice qualification; R03 remains PARTIAL.
