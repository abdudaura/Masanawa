# My Twin mobile surface workstream

Owner/window: current ChatGPT implementation window
Branch: `work/my-twin-surface-20261005`
Base SHA: `c00de8cf7845c3a4caa39f088539c547e6a76b87`
Tasks: safe new-file portion of TWIN-015, TWIN-063, TWIN-070, TWIN-075

## Scope

Build the new My Twin product surface without touching current clone-onboarding,
router, shared transport or Settings files.

## Owned paths

- new `apps/mobile/lib/src/agents/twin_profile.dart`
- new `apps/mobile/lib/src/state/my_twin_state.dart`
- new `apps/mobile/lib/src/screens/twin/**`
- focused mobile tests
- this claim file

## Explicitly not owned

- existing clone onboarding/setup files
- `apps/mobile/lib/src/router/app_router.dart`
- Settings
- `apps/mobile/lib/src/agents/masanawa_transport.dart`
- shared providers
- Gateway/Identity implementation

## UX target

One screen:
- twin identity/status;
- Talk to my twin;
- Teach my twin (same conversation, seeded intent);
- Share twin;
- visitors / chats / earned / pending owner requests;
- simple public/voice/owner-access indicators;
- no Skill/workflow/provider configuration.

Status: implementation started 2026-10-05.
