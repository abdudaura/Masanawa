# @masanawa/skills — canonical boundary

Status: Phase 6 production acceptance complete. See `docs/PHASE-6-CLOSURE-AUDIT.md`.

Owns canonical Skill/SkillVersion contracts, dependency graph, execution composition, provenance/trust, risk classification, exact rehearsal/certification evidence, eligibility/revision pins, deterministic trace metadata/failure evidence, immutable revisions and readiness. Source Markdown/files are import formats and never certification authority.

See ADR-0008 and `docs/migration/RUNTIME-SKILLS-WORKFLOW-ADOPTION-BOUNDARY.md`.

`SkillRepository` is the internal canonical catalog port. The PostgreSQL adapter
persists immutable logical identities and normalized certified versions, with
atomic dependency admission and revision-checked readiness updates. Skills owns
the migration under `packages/skills/migrations`; storage implementation remains
in `adapters/storage/postgres`.

`restoreSkillRegistry` builds a disposable validated projection from a consistent
catalog snapshot. Missing readiness fails closed. Exact revision pins preserve
certified content and dependency identities across restart; current readiness must
be reloaded before resumed execution. Catalog registration conveys no authority.
Tool dispatch still checks current authority, Provider readiness, operation
idempotency and reconciliation through the canonical Tools executor.
