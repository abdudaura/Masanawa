# Mobile startup production reconciliation — 2026-10-05

Owner/window: ChatGPT startup-performance continuation reconciling verified mobile startup work onto the live production integration line.
Branch: `work/mobile-startup-production-reconcile-20261005`
Base: `ad0b3899203778d038df79bd0c5bb059dd55c0d5`

Purpose:
1. Port the completed cache-first/session/first-frame startup work from the billing integration branch onto the currently deployed production APK integration branch without overwriting newer production work.
2. Preserve the server-driven agent model while eliminating avoidable startup waits.
3. Keep changes narrowly scoped to mobile startup/cache presentation code and checkpoint docs.

Owned paths:
- `apps/mobile/lib/main.dart`
- `apps/mobile/lib/src/agents/agent_directory.dart`
- new `apps/mobile/lib/src/agents/agent_directory_cache.dart`
- `apps/mobile/lib/src/state/agent_directory_state.dart`
- `apps/mobile/lib/src/state/session_state.dart`
- `apps/mobile/lib/src/state/ai_chat_state.dart` only targeted cache-startup helpers
- `apps/mobile/lib/src/screens/chat/chat_list_screen.dart` only cached-roster loading behavior
- `apps/mobile/lib/src/screens/chat/masana_list_screen.dart` only refreshing label behavior
- focused mobile tests for these paths
- this claim and checkpoint docs

Boundaries:
- do not overwrite production crypto/billing/onboarding work;
- no Gateway/domain/provider changes in this branch;
- no client hard-coding of Gwani/Gwana identities;
- cached presentation never grants authority;
- server history/directory remain canonical;
- no APK rebuild in this slice.

Acceptance:
- current-format auth restores from one encrypted session record;
- legacy/fresh auth fallback uses one bulk secure-storage read;
- cached agent roster is account-scoped and appears before live directory refresh;
- cached agents remain immediately actionable during refresh;
- push/Firebase initialization starts after first frame;
- cached conversation hydration precedes Connectivity platform monitoring and reuses the resolved documents directory;
- production-only mobile functionality remains intact.

Status: active.
