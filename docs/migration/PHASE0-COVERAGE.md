# Phase 0 Coverage Matrix

Status: closure audit in progress.

This document proves that source areas are either:
- deeply mined into ledgers;
- architecture/reference-only with an explicit Masanawa destination;
- third-party/static/generated material that is intentionally not migrated;
- or still an open Phase 0 gap.

It does not claim line-by-line source review.

## ChatWithStars

| Source area | Approx files | Disposition | Masanawa destination / evidence |
|---|---:|---|---|
| services/runtime | 500+ | A/B deep-mined | runtime, identity, memory, decisions, skills, workflows, commerce; source map + ledgers |
| services/calls | 50+ | A/B deep-mined | services/presence; call readiness/recovery/race/audio invariants |
| services/automation | 80+ | A/B deep-mined | services/social + proactivity/workflows |
| services/media-studio | 600+ incl. project assets | A/B engine deep-mined; project examples reference-only | services/studio |
| services/certification | small | B/reference | skills/testing/telemetry certification architecture |
| apps/admin | 250 | A/B operational semantics deep-mined; UI layout not migrated | apps/ops |
| packages/contracts | small | B | packages/contracts; source contract semantics represented in domain/ledger |
| supabase/migrations | 381 | A/B semantic families mapped; individual legacy migrations not copied | database + data ledger |
| src/public web | ~140 | C/B product UX reference | apps/web; no legacy Astro page copy requirement |
| infra/deploy | ~14 | C/B deployment reference | infra adapters; vendor not domain |
| scripts/data/public assets | ~50 | C/reference unless ledger-linked evidence | no direct migration |
| historical BLUEPRINT/old docs | small | C historical | canonical PLATFORM-FOCUS used instead |

Open check: repository-wide search for unique production concepts not yet represented in ledgers.

## OpenJarvis

| Source area | Approx files | Disposition | Masanawa destination / evidence |
|---|---:|---|---|
| src/openjarvis agents/skills/tools/engine | core | B/A deep-mined | agents, skills, tools, providers |
| security modules + tests | substantial | A/B deep-mined | packages/security |
| learning/traces/scheduler | substantial | A/B deep-mined | telemetry, skills, proactivity/workflows |
| memory/retrieval | secondary | B/reference | packages/memory derived retrieval |
| rust/crates | 146 | B implementation/performance reference, not separate runtime | possible native adapters only by later ADR |
| tests | 721 | behavior-mining source | parity/security fixtures |
| frontend/desktop | 128 | C/B UX reference | apps/web/client; not framework donor |
| configs/examples | ~55 | B/reference | testing/examples/docs |
| deploy/scripts/.github | ~54 | C/B engineering reference | Masanawa CI/infra independently designed |
| docs | 98 | architecture donor | source map/ledgers |
| assets/project governance docs | small | C/reference | no migration |

Open check: unique channel adapters and local-engine backends are recorded as ecosystem references; each future channel/provider is B/C until explicitly selected.

## N.E.K.O

| Source area | Approx files | Disposition | Masanawa destination / evidence |
|---|---:|---|---|
| memory | 68 | A/B deep-mined | packages/memory |
| plugin | 798 | A/B lifecycle/SDK deep-mined | plugin runtime/SDK |
| main_logic | 212 | A/B proactivity/voice/interaction deep-mined selectively | proactivity, presence, runtime |
| brain | 7 | B deep-mined for computer/browser/task patterns | tools/agents/workers |
| app/main server/agent server | 45 | B service behavior reference | runtime/presence/workers |
| tests | 1200 | major behavior source; targeted core domains mined | parity/security source |
| frontend | 392 | B/C embodiment UX reference | future clients/avatar surfaces |
| static | 1077 | C static/vendor/art assets | no core migration |
| docs | 420 | architecture/behavior reference | source map/ledgers |
| config/templates | ~148 | B schema/UX reference | identity/provider configuration |
| steamworks | 26 | C/B marketplace distribution reference | plugin marketplace future, not core runtime |
| knowledge | 4 | B retrieval reference | memory/knowledge tools |
| local_server/launcher/docker/pkgbuild | ~35 | C/B packaging/deployment reference | infra/client packaging only |
| deps/assets/scripts/.agent | mixed | C/B tooling/reference | no runtime authority |

Open check: avatar/client format support should become explicit provider/client roadmap items, not imported frontend code.

## CyberVerse

| Source area | Approx files | Disposition | Masanawa destination / evidence |
|---|---:|---|---|
| server | 127 | A/B behavior deep-mined, GPL-clean | services/presence + workflows |
| inference | 59 | B provider/persona/worker behavior deep-mined | providers/presence/agents |
| tests | 32 | behavior source deep-mined for presence/tasks | parity tests |
| frontend | 60 | B/C realtime UX/reference | apps/web/presence client |
| proto | 7 | B contract reference only | Masanawa contracts independently defined |
| infra | 25 | B provider config reference | providers/infra |
| models | 176 | C third-party/bundled model code; not copied | selected model providers separately licensed/deployed |
| docs | 19 | behavior/architecture reference | source map |
| scripts | 9 | C/B operational reference | independent tooling |
| root configs | small | C/reference | no migration |

GPL boundary: no CyberVerse core implementation is copied into Masanawa. Behavioral contracts are independently implemented.

## Cross-source coverage domains

The Feature/Behaviour/Data/Integration ledgers currently cover:
- identity and relationships;
- memory;
- world/life;
- decisions/JEV;
- agents/background work;
- skills/tools/plugins;
- provider routing;
- proactivity/scheduling;
- perception/computer use;
- realtime voice/presence/avatar;
- channels/cross-channel continuity;
- durable tasks/workflows;
- commerce/financial evidence;
- social automation;
- media studio;
- learning/evaluation;
- security;
- Ops/acceptance/kill switches;
- infrastructure/provider boundaries.

## Remaining closure checks

Before marking Phase 0 complete:
1. run keyword/folder coverage sweeps against all four pinned trees for concepts absent from Feature Ledger;
2. inspect unclassified database migration families/config/env/provider names;
3. verify all Feature Ledger entries have A/B/C classification and destination;
4. explicitly record C-retired/reference categories rather than leaving them implicit;
5. verify donor decisions cover all major overlaps;
6. create Phase 0 completion report with known deferred/non-goal inventory.
