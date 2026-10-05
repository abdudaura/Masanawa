# Mobile cache-first UX polish — 2026-10-05

Owner/window: ChatGPT startup-performance continuation after PR #164.
Branch: `work/mobile-cache-first-ux-20261005`
Base: `4ed5923436bd617cc7cedeb5c3c637adda3aa8ae`

Purpose:
1. Make cached agents immediately actionable while the live directory refreshes.
2. Remove misleading loading copy when useful cached data is already on screen.

Owned paths:
- `apps/mobile/lib/src/screens/chat/chat_list_screen.dart`
- `apps/mobile/lib/src/screens/chat/masana_list_screen.dart`
- focused mobile tests if needed
- `docs/AGENT-HARNESS.md` and `CONTINUE-HERE.md` only at checkpoint
- this claim file

Boundaries:
- presentation-only; no auth, Gateway, directory-cache, workflow, billing or provider changes;
- cached roster remains presentation-only and live server authorization remains canonical.

Acceptance:
- no-chat users with cached agents can open Agents immediately during refresh;
- cached Agent list reports refresh without implying there are no usable agents;
- true empty/no-cache startup still shows an honest loading state;
- docs updated before merge.

Implemented:
- empty Chats no longer disables "Choose an agent" when a cached roster is already available;
- blocking "Loading your agents…" is reserved for the true no-cache/no-roster state;
- Agents shows the cached roster count with a non-blocking "refreshing…" indicator while live data updates;
- no authority, transport or persistence behavior changed.

Verification:
- PR #166 merged into `work/billing-main-integration-20261005` at `c878f23ce3f77c68dcfb1f76ecc44561f4702d96`;
- Foundation CI run 37293538837 and Mobile Build run 37293538755 again ended with `steps: null`, so no application step executed;
- branch diff is limited to the two owned presentation screens and checkpoint docs;
- no APK rebuild was performed;
- hosted Flutter execution remains subject to the repository runner-allocation issue.

Status: merged implementation checkpoint.
