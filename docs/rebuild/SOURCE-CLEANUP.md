# Source cleanup — **CODE**, not just guidance
**Owner request 2026-10-10. Main source has not been rewritten.** This is a manifest for a controlled full cleanup of obsolete application paths. File paths are [enumerated machine-readably](SOURCE-CLEANUP-MANIFEST.json) from main `7c443966be97e9092cbc1fb98562c75253434326`; each is classified by filename/path and **does not prove unused imports**. The rebuild guide branch is `planning/masanawa-blueprint-v1-20261010`. Do not mistake this for a completed code removal.

## Audit summary
- **1354** tracked source/build/test files examined; **73** applied/potentially applied migration files protected from deletion.
- **157** retire twin clone owner economy after replacement.
- **10** integrator shared composition refactor.
- **23** review world for character canon reuse.
- **177** extract reusable audio comments then retire old talk stages.
- **6** refactor profile home activity.
- **22** review financial gift voice transfer boundaries.
- **1** retire human contacts after replacement.
- Definitively empty obsolete packages `packages/decisions`, `packages/perception`, `packages/proactivity`, `packages/testing`: only a .gitkeep placeholder each; removal of their four files removes these empty tracked directories from the branch. Any populated package such as `packages/world` **must not be deleted based solely on its name**, because current agents and memory may use it.
- **Not yet removed:** wired real Twin/clone economy, user Talk stages, human contact/DM APIs, payments/owner access; they currently have Gateway `app.ts`/ `main.ts`, Flutter `app_router.dart` or tests/SQL references. Their removal requires a new source layout/API replacement and integration tests. In particular **do not delete `packages/talks/migrations`** just because the Talk product is gone—historical migration checksums/upgrade and obligations survive.

## Feature-level disposal rules
| Legacy family | Removal gate | Preserve/reuse |
|---|---|---|
| Twin, creator/owner access | New Masana profile+fan model and service denies, account/ledger reconciliation, impacted PRs merged or explicitly disposed | agent roster, memory, skills, verified purchase ledger |
| Human contacts/DM/calls | Masana-only message/call API, router/transport replacement, explicit forbidden-human-target tests | reliable compose/outbox, WebRTC/Live audio, session auth, user data retention |
| Old live/user Talks, seats, polls, gifts | New Masana-only Home post/Room APIs and media tests, then unregister old routes/workers before deletion | media uploads, audio, comments/follows/reporting where meaningful |
| World simulation | Profile canon and agent fan memory sourced from existing strong packages; remove irrelevant world loops only after dependency-graph proof | versioned story/persona canon |
| Old commerce gifts/credits | Audit actual ledger balances and current subscriptions/payments; use compatible forward-only migrations and settlement reconciliation | MSN/crypto/billing and historical receipts |
| Empty placeholder packages | Directory has exactly one `.gitkeep`, no manifest or source | nothing |

**Every removal includes:** enumerate inbound imports/exports/routes, user-facing links, provider jobs, SQL migration references, tests and open PR edits; preserve reusable logic in clean feature-named module; cut server authority first; delete now-orphaned imports and files; update Node/Flutter dependencies and localization; run TypeScript, Vitest, PostgreSQL 18 fresh/upgrade, Flutter analyzer/tests and Android build. Record exact head/merge SHA, runner and evidence. Do NOT interpret a zero-step or skipped run as PASS. If blocked, call it not complete.

## Execution ownership
AF00 owns shared app router/shell/API composition/migration registry and must sequence retirement with its source changes. Appropriate independent owners implement clean Masana Posts+Videos, platform-only communications, Rooms/entitlements, Gwani moderation/admin and new agent canon. AF13 runs independent integration tests. Old claims can be stale while PR work exists; review the PR heads before disposal. Prefer existing PRs, do not accumulate patch-only cleanup branches.

## Actual work in this source-cleanup commit
Only the four **confirmed empty placeholder package directories** are removed at this stage. No claim that user-visible runtime is already free of excluded features. The detailed manifest makes the much larger required code removal auditable and assignable without corrupting the financial/back-end or local code.
