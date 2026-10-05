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

Status: feature lane implementation complete; shared integration pending.

Implemented:
- privacy-safe TwinActivity service projection;
- strict tenant/twin scope checks;
- safe event presentation with no transcript/message payload surface;
- isolated Gateway route registrar for GET /agent/twin/activity;
- backend service + route unit tests;
- mobile TwinActivity models/parser;
- Riverpod Activity state/controller with integration-owned transport seam;
- new Activity screen with Visitors / Chats / Earned summary, Needs You card and recent events;
- mobile model tests;
- twin-economy event -> Activity adapter with strict owner/twin scope checks.

Verification:
- GitHub Foundation CI run 37279313865 and Mobile Build run 37279314068 both failed before execution with zero job steps; this is the repository's known runner-allocation failure and is not a code-test result.
- compile/test execution remains required on a functioning runner.

Integration handoff:
- compose TwinActivityAuthorizer and TwinActivitySource in Gateway;
- register twin_activity_routes from shared app/main integration;
- implement authenticated TwinActivityTransport and override/provide twinActivityTransportProvider;
- add Activity to the four-tab router/root shell;
- connect the twin-economy event reader/outbox to the provided Activity adapter.
- do not use Activity as financial truth.
