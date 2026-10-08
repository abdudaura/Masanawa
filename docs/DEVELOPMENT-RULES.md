# Development Rules

## Latest completeness audit and ownership rules (2026-10-08)

The old U01–U20 plan remains active but did not specify all remaining work. Read [R01–R19/C01–C08 + 60 open PRs at audit](UNFINISHED-SCOPE-RECONCILIATION-20261008.md), [K13–K20 Contacts privacy/UX](CONTACTS-AND-ADDRESS-BOOK-EXPERIENCE-20261008.md), [U21–U30 new + F01–F18 recovery owners](ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md), and [79 historical unchecked tasks](LEGACY-150-TASK-RECONCILIATION-20261008.md). **F is a continuation/election of existing source**, not a fresh parallel implementation of core C02 migrations/Gateway/Flutter routes/finance. Only live unowned exact paths can be claimed. No false DONE, unauthorized phonebook upload, unsafe PR merge, native permission changed by Shorebird patch or lost original R/C/Work code.


## Owner-approved parallel U01–U20 work (2026-10-08)

The earlier global pause is lifted **only for independent development**. Before claiming a U scope, read the new [20-window plan](20-WINDOW-AI-CHAT-EXECUTION-20261008.md), [operator security contract](AI-OPERATOR-ACTION-AND-TASK-CONTRACT-V1-20261008.md), [human Chats privacy contract](HUMAN-CHAT-AND-CONTEXTUAL-AI-CONTRACT-20261008.md) and [acceptance gates](20-WINDOW-INTEGRATION-AND-ACCEPTANCE-20261008.md). Check live PRs and path leases, preserve C/R/Work code; never simultaneously edit shared Gateway composition, Flutter router, Firebase, migration registries or money authority. A model may propose but not authorize/write a consequential action. Mandatory draft/unmerged feature PR and actual code/test/blocked-evidence handoff. Work #497 remains a draft to reconcile later, not an active stop to isolated implementation.


## Flutter OTA and release safety (owner-approved 2026-10-08)

Every change in `apps/mobile` must declare its intended delivery tier: **server-driven versioned configuration** (supported existing client contract), **Shorebird candidate** (signed, release-compatible Dart-only code change), or **new signed Android/iOS store binary** (native/plugin/asset/engine/permission and policy-sensitive functionality changes). Flutter remains canonical; do not introduce a parallel React Native consumer. Release code must never be marked complete from source review, patch build or docs alone. Never expose signing keys, Firebase values or release secrets in Git. No `--allow-native-diffs`/`--allow-asset-diffs` bypass. Mandatory gates: [mobile Shorebird policy](FLUTTER-RELEASE-AND-SHOREBIRD-POLICY.md) and [qualification runbook](../apps/mobile/docs/SHOREBIRD-QUALIFICATION-RUNBOOK.md). Respect active consolidation ownership and real device/provider/rollback evidence.


## Before coding

1. Read CONTINUE-HERE.
2. Identify active phase.
3. Find or create the relevant Feature Ledger row.
4. Confirm canonical subsystem owner.
5. Read donor evidence listed on the row.
6. Check ADRs.
7. Define/extend contracts and tests before implementation where practical.

## Branching

Do not commit substantial feature work directly to main. Use focused branches and PRs. Foundation bootstrap may establish initial repository state, but normal work is PR-based.

## Source donor policy

- Never copy whole donor directories.
- Never create donor-branded architecture inside Masanawa.
- Adapt behaviors and patterns into canonical contracts.
- Track direct Apache-source adaptations in provenance.
- Treat CyberVerse GPL code as architecture reference by default.

## Code organization

- domain logic belongs in packages;
- transport/orchestration belongs in services;
- presentation belongs in apps;
- external side effects sit behind tools/providers/workflows;
- tests may import internal implementations; production packages must respect dependency boundaries.

## Behavioral preservation

When porting a capability:
- mine source tests;
- record hidden behaviors;
- write Masanawa parity fixtures;
- distinguish behavior parity from code parity.

## Errors

Use typed error classes/codes at boundaries. Do not make workflow decisions by parsing human error strings.

## Configuration

- configuration schema validated at startup;
- no implicit production defaults for secrets/financial providers;
- feature flags are explicit and observable;
- provider selection does not leak into domain entities.

## Data changes

- migration first;
- no manual production schema edits as the canonical process;
- reversible/expand-migrate-contract changes for important production data;
- destructive migrations require explicit review and backup/recovery plan.

## Side effects

No provider action without:
- validated input;
- idempotency plan;
- timeout;
- retry policy;
- reconciliation behavior;
- trace/correlation ID.

## Completion

A feature is not complete until its ledger status/evidence is updated.
