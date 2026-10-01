# Source Map — OpenClaw Agent Skills

Pinned revision: `edf1e2f436fa2a5375c98052180a090a57223f9e`.

Status: Phase 0B exhaustive skill/workflow coverage **COMPLETE** at the pinned revision. Exact closure: `docs/migration/coverage/OPENCLAW-AGENT-SKILLS.md`.

License: MIT at the pinned baseline.

## Role

This repository is the public canonical source for reusable OpenClaw coding-agent workflows. It is not a runtime skill engine and is not a second canonical Masanawa skill registry.

Primary evidence inspected:
- `README.md`
- `scripts/install-skills`
- `scripts/validate-skills`
- `scripts/check-skills`
- validation/install tests;
- `skills/behavior-validator`
- `skills/autoreview`
- `skills/handoff`
- `skills/agent-transcript`
- `skills/session-viewer`.

## Useful conventions

Preserve/adapt:
- one directory per skill with mandatory `SKILL.md`;
- small routing-oriented frontmatter with required name/description;
- support files/scripts colocated with the skill;
- canonical-source versus generated/vendored snapshot distinction;
- install-time source/destination boundary checks;
- dry-run and explicit force semantics;
- validation before distribution;
- behavior validation against an explicit contract;
- source-blind/black-box acceptance testing where implementation independence matters;
- redaction/provenance discipline for transcripts and session artifacts;
- path-free bounded handoff prompts;
- helper scripts for repeatable operational logic instead of embedding everything in prose.

## Masanawa boundary

`packages/skills` remains the sole canonical skill authority under ADR-0008.

OpenClaw Agent Skills contributes authoring, packaging, validation and acceptance-workflow conventions only. It does not own:
- SkillVersion persistence;
- certification/readiness/risk;
- runtime dependency resolution;
- tool authority;
- workflow state;
- Character identity;
- agent sessions.

OpenJarvis remains the structural SkillManager/parser/dependency/executor donor. OpenClaw main contributes revision/distribution/session-pinning semantics. Microsoft Agent Framework contributes progressive disclosure and resource safety. ChatWithStars contributes certification/governance.

## Adoption classification

Direct code dependency is unnecessary for the platform kernel.

Use as:
- import/authoring-format reference;
- validation convention;
- developer-experience and acceptance-test donor.

If individual scripts are directly adapted later, record their exact path/commit/license in the direct-adaptation provenance record.

## Phase 0B closure

All 8 pinned skills are classified:
- platform developer tooling;
- acceptance/parity tooling;
- optional imported operational skill;
- or reference-only.

Installer, validator and repository check orchestration are covered. No production skill runtime exists in this donor, and unresolved canonical-authority conflicts are zero.

Do not install this repository wholesale into production agents. Import individual skills only through Masanawa `packages/skills` certification/provenance rules.
