# Twin Activity workstream

Owner/window: current ChatGPT implementation window
Branch: `work/twin-activity-20261005`
Base SHA: `584c75ec1f7be4b437040c2554d1afe03457509d`
Tasks: TWIN-060, TWIN-061, TWIN-062, TWIN-063

## Scope

Implement Lane G from `docs/TWIN-MULTI-WINDOW-EXECUTION.md`:
- privacy-safe owner Activity projection contract/service;
- Gateway feature route module without editing shared app/main composition;
- mobile Activity models/state/screen as new files;
- compact My Twin summary projection contract where it can be isolated;
- unit tests for projection/privacy rules.

## Owned paths

- `services/gateway/src/twin_activity*.ts`
- `apps/mobile/lib/src/agents/twin_activity.dart`
- `apps/mobile/lib/src/state/twin_activity_state.dart`
- `apps/mobile/lib/src/screens/activity/**`
- this claim file

## Explicitly not owned

- `services/gateway/src/app.ts`
- `services/gateway/src/main.ts`
- `apps/mobile/lib/src/router/app_router.dart`
- `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`
- `apps/mobile/lib/src/agents/masanawa_transport.dart`
- Commerce model/repository/migrations
- active billing/crypto/onboarding files

## Dependencies

Integration lane must later compose the route, transport provider and router.
Activity remains a derived read model and never owns financial truth.

Status: implementation started 2026-10-05.
