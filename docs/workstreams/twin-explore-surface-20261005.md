# Twin Explore mobile surface workstream

Owner/window: current ChatGPT implementation window
Branch: `work/twin-explore-surface-20261005`
Base SHA: `c00de8cf7845c3a4caa39f088539c547e6a76b87`
Tasks: safe new-file portion of TWIN-020..024

## Scope

Build the public twin discovery surface without touching the existing agent directory,
router or shared transport files.

## Owned paths

- new `apps/mobile/lib/src/agents/twin_directory.dart`
- new `apps/mobile/lib/src/state/twin_directory_state.dart`
- new `apps/mobile/lib/src/screens/explore/**`
- focused mobile tests
- this claim file

## Explicitly not owned

- existing `agent_directory.dart` / `masana_list_screen.dart`
- shared router/navigation
- shared transport/provider files
- Gateway/Identity implementation

## UX target

Explore only:
- search public twins;
- compact twin cards;
- open twin conversation;
- show owner-approved bio/languages and paid voice/owner-access availability;
- no posts, likes, reposts, comments, follower counts or social feed.

Status: isolated new-file Explore surface complete; backend/shared integration pending.

Implemented:
- public TwinDirectoryEntry/Page models;
- search/pagination transport seam;
- Riverpod Explore state with debounced search and deduplicated pagination;
- Explore screen;
- compact twin cards with owner-approved bio/languages;
- Voice / Owner chat availability tags;
- open-twin callback;
- tests showing likes/followers/posts are not part of the consumer model.

Not yet integrated:
- public twin directory Gateway endpoint/projection;
- discoverability/privacy filtering;
- deep link/share route;
- shared transport/provider;
- router/four-tab navigation;
- existing agent directory migration/deprecation.

No existing agent directory/router/shared transport file was modified.
