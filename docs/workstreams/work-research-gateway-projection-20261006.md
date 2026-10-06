# Work/Research Gateway projection seam

Status: ISOLATED SERVER PROJECTION COMPLETE — shared route/runtime composition remains
Branch: `work/work-research-gateway-projection-20261006`
Base: `work/production-apk-integration-20261005` / PR #136
PR: #216

## Ownership

Changed paths only:
- `services/gateway/src/work_research_room.ts`
- `services/gateway/src/work_research_room.test.ts`
- `docs/workstreams/work-research-gateway-projection-20261006.md`

No edits to Gateway `app.ts`/`main.ts`, mobile router/chat/transport, migrations,
production environment, Commerce, Workflow implementation or provider code.

## Completed

- Exact server projection contract matching Lane W mobile wire models.
- Work & Business and Research & Answers server-owned titles, subtitles and approved quick starts.
- Opaque quick-start intent identifiers; this module grants no execution authority.
- Exact server-side quick-start allowlist resolution; cross-Room and arbitrary forged runtime intent ids fail closed.
- Canonical `AgentRun` lifecycle validation and mapping:
  - running -> working
  - completed -> completed
  - failed -> failed
- Explicit pending-runtime projection for queued/waiting before an AgentRun is available.
- Fail-closed progress bounds and terminal-state consistency checks.
- Typed artifact projection with HTTPS-only optional URI.
- Typed evidence/source projection with HTTPS-only source URI and canonical Instant normalization.
- Per-item `requiresEvidence` switch so current/specialist research fails closed without sources while file/document work is not forced to invent web citations.
- Focused tests for quick starts, intent allowlisting/forgery rejection, lifecycle mapping, pending states, sourced research, evidence-required rejection, insecure URL rejection and inconsistent terminal progress.

## Architecture boundary

This module does not execute Workflows, research, Tools or providers. The owning runtime
supplies canonical AgentRuns, artifacts and evidence. It does not invent a second
Workflow/research execution engine.

## Verification

- Gateway already declares `@masanawa/agents`, so this projection adds no workspace dependency.
- PR diff remains exactly the three claimed files.
- Latest Foundation CI run `37452381188`, job `112231756261`, failed before checkout with
  `steps = null`; no code/test verdict is fabricated.
- Source was manually audited against the exact Lane W mobile wire contract and the current
  PR #136 canonical AgentRun contract.

## Remaining shared-owner work

- #136: register the authenticated route and mount Work/Research navigation.
- Canonical runtime owner: resolve opaque intent ids into existing Skill/Workflow/research execution.
- #136/shared artifact handling: open/download canonical artifacts and HTTPS sources.
- Activity/Wallet remain projections of canonical runtime/financial outcomes.

**No further isolated implementation remains in this server projection slice.**
