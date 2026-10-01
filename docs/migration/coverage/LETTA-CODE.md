# Phase 0B Forensic Coverage — Letta Code

Pinned revision: letta-ai/letta-code@3687ea51f6d11eabc4ad7a7b163c649d023801ba

Status: COVERED AT PINNED REVISION

Letta Code is the implementation donor for memory mutation/revision/conflict/shared-memory and working-context mechanics. It does not own Masanawa Character identity, relationship identity, canonical memory storage, provider registry, workflow engine, or channel routing.

## Descendant capability matrix

| Family | Evidence | State treatment | A/B/C | Canonical destination | Acceptance/parity gate |
|---|---|---|---|---|---|
| Memory filesystem/repository | src/agent/memory-filesystem.ts, memory-git.ts, worktree.ts + tests | donor Git/filesystem state | B | packages/memory | preserve revision/conflict semantics; canonical storage is PostgreSQL-backed MemoryRevision/Record |
| Writer serialization | memory-operation.ts + tests | D-MEM-020 | A | memory/workflows | current writer lease serializes harness-owned mutations; dead owner may be reaped, live owner keeps exclusivity |
| Conflict repair | memory-conflict-repair.ts + tests | D-MEM-021 | A | memory/workflows | stale worker CAS token cannot alter newer repair attempt; same failed state not retried every turn |
| Memory constraints | memory-constraints.ts + validator/tests | D-MEM-024 | A/B | memory/ops/security | size/depth/layout validated before commit; autonomous worker cannot silently relax policy |
| Memory confinement | memory-confinement.ts + permission tests | security boundary | A | memory/security | unattended worker fails closed if sandbox unavailable; symlink/realpath escapes blocked |
| Own-memory writes | permissions/memory-write-allowance.ts + path tests | scope authorization | A | memory/security | every write target must remain within authorized roots after canonicalization |
| Shared/attached memory | shared-memory skills/runtime/e2e | D-MEM-023 | A/B | packages/memory | primary/private and attached/shared scopes stay distinct with explicit permissions |
| Background memory workers | subagents/memory-worker*, memory-task lifecycle | isolated mutation proposal | B | workflows + memory | worker edits isolated candidate revision/worktree; merge/admission remains canonical memory responsibility |
| Post-turn sync/notification | turn-cleanup memory e2e | D-MEM-025 | A | memory/events | unfinished turn does not push; client success event follows successful canonical sync/commit |
| Local-vs-remote failure semantics | memory worker e2e | MemorySyncReceipt | A/B | memory/events/workflows | local committed change may exist when remote sync fails; failure surfaced as task/sync state, never false success |
| Memory formatting/frontmatter/layout | memory-format/frontmatter/tests | import/export representation | B/C | memory import/export | representation is replaceable; canonical record model independent |
| Working context pressure | max-context, local-context-estimate, compaction tests | D-CTX-001 | A/B | agents/context + memory | compact working projection under pressure without rewriting durable memory |
| Compaction | backend/local/compaction.ts + tests | ephemeral projection | A | agents/context | compaction alters active context only unless explicit memory consolidation workflow runs |
| Memory prompts/skills | prompts and builtin memory skills | operator/agent guidance | C/B | skills/docs | guidance may inform UX but prompts do not define memory authority |
| Conversation runtime | backend/conversation*, websocket listener | donor session/conversation state | C/B | agents/gateway/conversation | no Letta conversation/workspace identity becomes canonical user/relationship state |
| Channel integrations | channels/** | adapter state | C/B | gateway | adapters optional; no channel owns memory/identity |
| Attachments | Slack attachment task/primitives; WhatsApp attachment policy/tests | D-ATT-001 | B | gateway/knowledge/security | recipient/MIME/path admission required before ingestion/send |
| Providers | providers/** and backend model clients | provider state | C/B | packages/providers | optional adapters under ADR-0010 |
| Tools/skills | tools/**, skills/** | tool/skill runtime | C/B | packages/tools/skills | useful behavior only; OpenJarvis/elizaOS/Masanawa remain canonical registries |
| Cron/reminders/queue | cron/**, reminders/**, queue/** | scheduler/runtime state | C/B | workflows/proactivity | no competing task/scheduler authority |
| Sandbox | sandbox/** | execution boundary | B | security/tools | useful hardening may migrate behind canonical sandbox/tool policy |
| Telemetry | telemetry/** | telemetry only | B | telemetry | observations/redaction only |
| CLI/web/viewers | cli/**, web/** | presentation | C | clients/ops | no domain ownership |
| Hooks/mods | hooks/**, mods/** | extension runtime | C/B | plugins/events | no independent plugin/approval authority |
| Vendor/assets/deploy/python wrapper | vendor/**, assets/**, docker/**, nix/**, python/** | build/runtime artifacts | C/B | deployment/reference | optional implementation support only |
| Tests/integration tests | tests co-located throughout src + src/integration-tests | evidence | evidence | acceptance/parity | tests define observable behavior, not architecture |

## File accounting

letta-code-file-family-manifest.json accounts for all 2,429 pinned files with zero unresolved paths.

## Integration disposition

letta-code-integration-disposition-manifest.json explicitly dispositions 739 channel/provider/backend/websocket/auth files. Structural memory/backend behavior may migrate; concrete integrations stay behind canonical Gateway/provider/storage contracts.

## Memory authority boundary

LETTA-CODE-MEMORY-AUTHORITY.md maps Git repositories, worktrees, locks, shared repositories, context compaction and client notifications into storage-neutral Masanawa concepts.

## Merge decision

Adopt strongly:
- memory mutation lease;
- immutable revision lineage;
- conflict detection/repair with stale-worker CAS protection;
- fail-closed memory worker confinement;
- scope-safe write path validation;
- explicit attached/shared memory permissions;
- bounded memory constraints with protected policy updates;
- post-commit/sync notification semantics;
- bounded working-context compaction separate from durable memory;
- attachment path/recipient/MIME policy.

Redesign:
- Git commits/worktrees -> MemoryRevision / candidate revision / conflict evidence;
- filesystem memory tree -> canonical scoped PostgreSQL MemoryRecords plus import/export projections;
- Letta conversations/workspaces -> Masanawa session/relationship/context contracts;
- channel/provider/backend state -> canonical adapters.

Do not adopt as canonical:
- agent-local filesystem as memory truth;
- Letta agent/workspace = Character;
- Git remote = canonical memory authority;
- conversation object = relationship identity;
- Letta tool/skill/provider registries as parallel registries.

## Closure

No unresolved Letta Code source family remains at this pinned revision.
