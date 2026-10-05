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

Status: isolated new-file My Twin surface complete; shared integration pending.

Implemented:
- compact TwinProfile projection model;
- performance summary model (visitors/chats/earned/pending owner requests);
- public URL/discoverability/voice/owner-access presentation flags;
- My Twin Riverpod state/transport seam;
- My Twin primary screen;
- no-twin empty state;
- Talk / Teach / Share actions;
- discoverability toggle;
- language chips;
- concise status chips and performance card;
- tests proving Skill/workflow metadata is not part of the consumer model.

Not yet integrated:
- canonical Gateway TwinProfile endpoint and transport;
- active clone onboarding -> My Twin transition;
- share implementation/deep link;
- Talk/Teach route callbacks;
- four-tab router;
- Settings cleanup.

No existing onboarding/router/settings/shared transport file was modified.
