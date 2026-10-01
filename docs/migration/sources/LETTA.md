# Source Map — Letta

Pinned:
- landing/historical repository `5bcdd177d70fa2b31a754cfcd801e77b2e1ab16a`
- Letta Code `3687ea51f6d11eabc4ad7a7b163c649d023801ba`

Status: Phase 0A memory deep pass complete.

## Baseline correction

At the pinned revision, `letta-ai/letta` is not the active Letta server implementation. Its README and security policy identify it as a landing repository and direct current development to `letta-ai/letta-code`. The archived Python server is explicitly unsupported.

Therefore the memory comparison treats Letta Code as the implementation donor and the `letta` repository as provenance/history only.

## Memory architecture observed in Letta Code

### Core/working memory blocks

`src/agent/memory.ts` creates standard always-visible memory blocks, currently `persona` and `human`, with read-only labels supported. This is a useful separation between small compiled working context and larger durable memory.

Masanawa adaptation: a bounded working-context compiler may project canonical records/identity into blocks. Blocks do not own Character identity or durable memory.

### Memory filesystem and revision model

`src/agent/memory-filesystem.ts` scopes a memory tree by agent ID and supports local/cloud materialization. The current architecture is git-backed and includes root/system memory, constraints, sync and checkout semantics.

Useful concepts:
- human/agent-editable durable memory;
- explicit tree/character limits;
- revision history;
- local materialization;
- deterministic path/layout validation.

Rejected as canonical:
- agent ID as the privacy boundary;
- filesystem/git checkout as platform truth;
- cloud repository attachment as Masanawa sharing authority.

### Concurrency and repair

`memory-operation.ts` serializes harness-owned writers with process-aware leases. `memory-conflict-repair.ts` records repair attempts with state signatures and random tokens, uses compare-and-set transitions, detects dead owners and prevents stale workers from mutating newer repair state.

Masanawa should preserve the behavior using database transactions/advisory locks/idempotency keys and worker leases.

### Recall

The built-in recall subagent forks the parent conversation and receives search instructions separately. The architectural lesson is that explicit recall can be delegated and bounded without turning the primary prompt into the memory store.

### Shared memory

Attached repositories are resolved from server-declared attachments; leftover local sibling directories are deliberately ignored. This is a strong "declared authority beats ambient filesystem state" rule.

Masanawa sharing must be even stricter: shared-character/world scopes are explicit canonical scopes and private relationship memory never becomes shared by attachment or proximity.

## Adoption role

Primary donor for:
- working/core-context blocks;
- editable/revisioned durable-memory UX;
- serialized writes and conflict-repair behavior;
- explicit shared attachment semantics;
- recall-worker patterns.

Secondary/reference only for:
- persistent agent identity;
- filesystem/git persistence;
- cloud repository topology.

See ADR-0007 and `docs/migration/MEMORY-ADOPTION-BOUNDARY.md`.
