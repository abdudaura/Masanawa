# F12 companion — executable five-tab/legacy-route integration guard

**Date:** 2026-10-09. **Status: verification helper SOURCE_WRITTEN, unmerged; F12 and R17/C08 remain PARTIAL_IMPLEMENTATION.** This is a nonconflicting verification/recovery task selected after finding all U01–U30 lanes represented by existing open PRs. This branch does **not** own F12 implementation or assert runtime feature completion.

## Claim and exact ownership

- Window: GPT-6 independent F12 companion verification.
- Branch: `work/verify-f12-five-tab-guard-20261009-gpt6` (draft, do not merge without reviewed integration).
- Fresh `main` base SHA: `5e758673ae91082520b21b3153da53791ae2cbf3` (rechecked after source writes).
- Source/test checkpoint SHA: `a43777ed9f5d9ad1c426e5e642605de88d9b6a4a` (handoff commit follows).
- **Only owned paths:** `scripts/verify-five-tab-shell.mjs`, `scripts/verify-five-tab-shell.test.mjs`, this handoff document. Claims were committed before source edits at `464915f89ce8ece65dbbd429ece22770d2a31155`.
- Not claimed/edited: `apps/mobile/**`, `services/gateway/**`, Postgres migration registry, auth, C01–C07, Firebase, provider/wallet source, release workflows, production services.
- Read: `CONTINUE-HERE.md`, `docs/UNFINISHED-SCOPE-RECONCILIATION-20261008.md`, `docs/ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md`, `docs/20-WINDOW-AI-CHAT-EXECUTION-20261008.md`, `docs/MULTI-WINDOW-WORK.md`, `docs/APP-SHELL-CONTRACT.md`, `#493` and current main shell/router. Software Factory SKILL.md, AGENTS.md and relevant protocol/parallel references also reviewed.

## Implemented recovery

Added an ESM, Node-builtin-only source checker, with no source-side-effect or external provider requirements. It reads three canonical Flutter files and fails nonzero on inconsistent identity, route or shell contracts:

1. **Exactly five roots in approved order** with typed locations: Talks, human Chats, private Assistant, Wallet, Agents. Checks actual enum values, mounted page slots, visible navigation destinations and bounded indices; guard is not fooled by intended labels in comments.
2. **Historical private-AI route meanings**: old `/chat`, `/chats` and `home?tab=talk` must not become human DMs or public Talk pages; `/home` remains Talk discovery; old create/activity/you actions remain.
3. **Human-private isolation/auth routing:** `/messages`, `/messages/new`, `/messages/:conversationId` exist, new/thread UI is human DM, both root and thread require signed-in routing, `/chat/:id` keeps a character-specific AI screen. This is NOT a substitute for server-side C01/C02 authorization tests.
4. **Talk/voice safety:** public Start Talk FAB must stay on first/Talks tab; idle Assistant must unmount its session on leaving the center tab. Does NOT verify native microphone permissions or LiveKit.
5. Seven deterministic source-fixture tests cover positive behavior, four-to-five migration, old alias hijack, missing route protection, incorrect FAB/index/order, Assistant unmount and comment spoofing. One script, no new Flutter dependencies or shared-file modifications.

## Executed evidence (specific, bounded)

- Executed the **authored JavaScript checker and authored regression test cases** in an isolated V8 harness by loading the committed scripts from GitHub and replacing only Node import/test-runner boilerplate: **7/7 fixture cases passed**. This does not count as a native `node --test` process run.
- Executed the **same authored checker** over the three actual GitHub file contents on `main` at the base SHA: **FAIL, 18 static violations**. Main still uses four tabs; do not represent it as shipping five tabs.
- Executed the same checker over the three GitHub file contents at draft F12 PR #493 head `050b101c3f701db8b1d68f15d455a9bf3acd8dcb`: **PASS, zero static violations**. This is source-shape evidence only, **not** compilation, C01/C02 integration, sign-in/device verification or approval to merge.
- No physical Android test, Flutter analyzer, `flutter test`, end-to-end Gateway/Postgres or full CI run was executed in this connector-only private checkout. External GitHub Actions quota incident #457 remains independently unresolved.

## Reproduce and required next integrator actions

```bash
node --test scripts/verify-five-tab-shell.test.mjs
node scripts/verify-five-tab-shell.mjs
cd apps/mobile && flutter pub get && flutter gen-l10n
flutter analyze
flutter test test/app_shell_route_compatibility_test.dart
```

Run the checker on an **integration branch containing the F12 five-tab source**. It correctly fails on today's `main` until the route/shell changes are composed; do not bypass it or retrofit the old four-tab implementation just to get green. Add it to CI only under the designated CI owner, avoiding duplicate workflow ownership. Follow with full Flutter tests and real two-account C01/C02 sign-in/deny/revoke/restart/deeplink checks, Talk FAB and microphone/device tests (320dp and low RAM), Firebase/auth redirects, provider security and release qualification as required by R17/C08, K/J journeys and Work #497. Server authorization, C02/C05 migration resolution and five-root composition remain owned by their original PR/Work integrator. Keep all existing drafts intact; no merges, force pushes, production writes or releases performed.

## SHA-specific handoff interpretation

Claim SHA `464915f89ce8ece65dbbd429ece22770d2a31155`; checker SHA `ef68797ca9889cadb2eb2fb8973f1bcb4e2fe296`; regression test/source checkpoint SHA `a43777ed9f5d9ad1c426e5e642605de88d9b6a4a`. The PR's final head will be its handoff commit; use the PR head in preference to an earlier snapshot. **Release-readiness: NO-GO** until runtime/DB/provider/device/CI evidence exists.
