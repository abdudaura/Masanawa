# Phase 6 — Skills

Status: ACTIVE  
Started: 2026-10-02  
Active branch: `task063-skill-execution-planning`

Phase 5 Tools and Providers is closed by PR #45, merge
`0fe123e18a9163386c4ab10331139265ce26b64e`.
Credential-custody implementation head
`7d53562fe29f5aae6a3e69c495757ce22658df3a` passed Foundation CI run 365,
the final Phase 5 documentation head
`b6e5e1cdfddc9c7c9f2da8411c58c8f03c4785d4` passed run 368, and merged-main
run 369 passed the complete Foundation CI gate.

## Canonical ownership

- `packages/skills` is the sole canonical Skill/SkillVersion authority.
- `packages/tools` remains the atomic execution authority; Skills compose Tools and
  subskills but do not bypass Tool security/idempotency/reconciliation.
- `packages/security` remains the authority/approval owner.
- `packages/workflows` is Phase 8 durable multi-step business state and is not pulled
  forward into the Phase 6 foundation merely to implement Skills.
- source Markdown/files/repositories are authoring/import formats and candidate
  evidence, never production truth.
- production SkillVersion state is versioned/certified canonical state.

## Donor boundary

Primary structural donor: OpenJarvis.

Adopt:
- manifest/normalization discipline;
- catalog/manager;
- exact dependency/subskill graph;
- SkillTool adapter later in Phase 6;
- provenance/trust metadata;
- invalid/cyclic skill isolation;
- trace metadata;
- optimization overlays only as non-authoritative candidates.

OpenClaw contributes:
- immutable managed revisions;
- content-derived revision evidence;
- deterministic source precedence for import candidates;
- visibility and exact revision pinning;
- stale-edit conflict behavior.

Microsoft Agent Framework contributes:
- progressive disclosure;
- composable skill sources;
- safe resource/script boundaries and traversal defense;
- interoperability concepts.

ChatWithStars contributes:
- certification/readiness;
- activation and negative examples;
- risk/approval/pricing/idempotency/reconciliation policy;
- Character expertise binds certified SkillVersions only.

Reject:
- filesystem discovery order as production truth;
- donor runtime ownership;
- imported skill activation without certification;
- implicit latest-version selection where reproducibility matters;
- skill text/model intent as authorization;
- workflows hidden inside conversational skill state.

## Task 059 — canonical Skill / SkillVersion schema

The preserved pre-roadmap foundation was reconciled rather than merged wholesale. Task 059 separates stable logical `Skill` identity (`SkillId`, key, creation time) from immutable normalized `SkillVersion` content (`SkillVersionId`, exact version, activation/governance/schema/provenance/certification fields). Version-owned nested content is frozen after canonical normalization. The preserved dependency-aware registry remains useful groundwork for later Skills tasks but does not make Tasks 060-070 complete.


## Task 060 — Skill manifest validation and import format

Task 060 introduces a versioned native manifest validated with the repository's TypeBox stack and a bounded `SKILL.md` compatibility importer. Source files remain untrusted authoring evidence: successful import produces a quarantined candidate with deterministic content fingerprint and provenance, not a canonical/certified SkillVersion. Resource paths are relative-POSIX and traversal-safe; scripts are skipped by default and require explicit import opt-in, which still does not authorize execution. Capability/Tool requirement semantics remain Task 061 and dependency-graph semantics remain Task 062.

## Task 061 — capability requirements and Tool references

SkillVersions now declare provider-neutral required Tool capabilities and explicit named Tool references. A reference may remain capability-bound for runtime selection or pin an exact immutable `ToolVersionId`; it never pins a Provider. Normalization requires every Tool reference capability to be declared and every declared Tool requirement to have a reference. Resolution is fail-closed against the canonical Tool registry when capabilities are unknown, no matching ToolVersion exists, or an exact ToolVersion pin does not provide the declared capability. Provider selection remains owned by the Tool/Provider runtime boundary.

## Task 062 — Skill dependency graph and conflict validation

The canonical Skill registry validates exact immutable SkillVersion dependency graphs before mutating registry state. Batch registration is order-independent and atomic: missing dependencies, cycles, configured depth overflow, duplicate identity/version bindings and logical Skill identity conflicts all fail closed without partially activating the batch. Logical Skill keys and stable `SkillId` values are one-to-one across versions, preventing a key from silently changing identity or an identity from changing keys. Exact replay of an unchanged SkillVersion remains idempotent.

## Task 063 — Skill execution planning and composition

The Skills package now composes a deterministic immutable execution-plan snapshot from the canonical registry. Planning reuses the already-validated exact SkillVersion DAG: dependencies appear before dependants, shared dependencies are included once, the requested root is last, and every direct dependency is represented by an earlier step ordinal. Planning is fail-closed on readiness for the root and every exact dependency, while ready model-hidden SkillVersions may participate as dependencies without becoming advertised. The plan aggregates required Tool capabilities but does not select Providers or execute Tool/subskill calls; those remain later execution-boundary work.

## First canonical slice

Goal: establish the production SkillVersion identity/catalog/governance boundary before
parser/import/executor work.

Planned invariants:
- `SkillId` is stable logical identity and `SkillVersionId` is exact immutable
  certified revision identity;
- production registration requires certification evidence and positive + negative
  activation examples;
- definitions declare capabilities, exact SkillVersion dependencies, required Tool
  capabilities, schemas, authority requirements, risk/side-effect/sensitivity,
  billing/confirmation, idempotency/reconciliation and provenance/trust;
- consequential Skills inherit operation-bound idempotency/reconciliation constraints;
- user-billed Skills require explicit confirmation policy;
- registration is exact-replay idempotent and identity conflicts fail closed;
- batch registration validates the full dependency graph atomically, so missing/cyclic
  dependencies cannot partially activate healthy state;
- dependency depth is bounded;
- readiness/blocked/disabled state is mutable operational state separate from immutable
  SkillVersion content;
- model-hidden Skills may be exact dependencies but are never advertised to the model;
- advertised/executable Skills require ready dependencies;
- no implicit latest-version resolver exists in this slice.

Acceptance before moving deeper into Phase 6:
- strict TypeScript/unit/architecture/build gate;
- graph cycle/missing/depth/conflict tests;
- certification/governance tests;
- readiness/dependency eligibility tests;
- PostgreSQL-backed canonical Skill/SkillVersion persistence before source import is
  considered production-capable.
