# Workstream claim — skills-clones / Core Teaching

- Owner/window: ChatGPT window 2026-10-04 17:48 +01
- Branch: `work/skills-clones-core-teaching-20261004`
- Base SHA: `3906419669203844018b6687ad06ab2af48654eb`
- Draft PR: #94
- Task references: Core Teaching requirement in `CONTINUE-HERE.md`, `docs/SKILL-DESIGN.md`, and `docs/DIGITAL-COMMERCE-LAUNCH.md`; Phase 6 canonical Skills boundaries remain authoritative.
- Owned paths:
  - `docs/workstreams/skills-clones.md`
  - `docs/CORE-TEACHING-SKILL.md`
  - `packages/skills/src/teaching.ts`
  - `packages/skills/src/teaching.test.ts`
  - `packages/skills/src/index.ts` only for the teaching export
- Explicitly not owned: Gateway, mobile, channels/adapters, Commerce, NOWPayments, Agent runtime, migrations, package/root config, lockfile, deployment, existing Skill model/registry/guide files.
- Shared-contract dependencies: canonical Skills IDs/contracts and existing Relationship/Memory/Workflow boundaries are consumed by reference only; no shared owner contract changes were made.
- Current step: domain-contract + canonical authoring + selectable exercise/subject-reference implementation complete; awaiting executable verification/integration.
- Last update: 2026-10-04 17:53 +01.
- Implementation: exact SkillVersion + Relationship-scoped learner context, adaptive lesson/resource evidence, formative evaluation and progress-handoff contracts; canonical `core.teaching` SkillVersion + SkillGuide factory with teaching-specific certification gates; selectable exercise cards; exact resource/subskill references. No persistence/channel/runtime integration claimed.
- Verification: changed-file audit confirms exactly the five owned paths. Foundation CI runs 882, 890 and 897 all failed before executing steps; each single `check` job exposes no steps/logs. This is runner allocation/non-execution evidence, not a code test result. Local executable tests were not available in this connector-only window.
- Deployment: not attempted.
- Known gaps: author/certify exact Core Teaching SkillVersion + SkillGuide/resources; bind current runtime assignment/readiness; persist progress through canonical Relationship Memory/Workflow; project exercises through chat-actions; app/WhatsApp/Telegram rehearsals and physical voice verification.
- Handoff evidence: PR #94; latest implementation head before this handoff update `a7948be33eb8d2bf05fab9482b134f79d30c4e25`; CI run 897; changed paths listed above.

Collision rule: this claim remains active. Do not edit these owned paths from another window without explicit transfer; coordinate shared integration through the owning workstreams.
