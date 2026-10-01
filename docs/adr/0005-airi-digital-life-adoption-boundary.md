# ADR-0005: AIRI Digital-Life and Embodiment Adoption Boundary

Status: accepted for Phase 0A architecture selection
Date: 2026-10-01

## Decision

AIRI is selected as Masanawa's primary architectural donor for the **digital-life client and embodiment layer**.

AIRI is not selected as:
- Masanawa's canonical Character identity system;
- memory system;
- server runtime;
- realtime media transport;
- business workflow engine;
- provider-of-record configuration model.

Masanawa retains its own canonical Character/Constitution, relationship, memory, world, task and provider systems.

## Adopted architectural concepts

### Shared "stage" experience

Masanawa should expose one Character Presence/Stage contract that can be rendered in:
- web;
- desktop;
- mobile;
- future device/ambient surfaces.

Each client may implement different native capabilities while consuming the same canonical character/session contracts.

### AvatarRenderer abstraction

AIRI demonstrates mature separation across multiple presentation forms:
- Live2D;
- VRM/Three.js;
- MMD;
- Spine;
- Tachie/static character presentation;
- Godot/native renderer experiments.

Masanawa should define a renderer-neutral interface roughly equivalent to:

```
AvatarRenderer
  load(identityPresentation)
  activate()
  setExpression(...)
  setMotion(...)
  setLipSync(...)
  setLookTarget(...)
  setPresenceState(...)
  suspend()
  dispose()
```

The renderer consumes a canonical Masanawa Appearance/Avatar asset reference. It does not own Character identity.

### Model-driver lifecycle

AIRI's model drivers separate generation from a target renderer and explicitly own start/replace/stop/dispose lifecycle.

Masanawa should preserve:
- target ownership;
- monotonic/fixed-rate generated pose application;
- filter reset;
- generator replacement without unnecessary target teardown;
- explicit release on stop/dispose;
- lip-sync as a driver/input source rather than Character business state.

### Portable Character Card import

AIRI's Character Card V3 support is useful as an interchange format.

Masanawa may support import/export of:
- biography/persona text;
- presentation metadata;
- avatar assets;
- voice preferences;
- optional client module preferences.

However a Character Card is **input**, not canonical identity truth.

Import pipeline:

```
CCv3/AIRI pack
   -> validate manifest/files
   -> sanitize/normalize
   -> import proposal
   -> map authored identity fields
   -> map appearance/voice assets
   -> map client preferences separately
   -> operator review/versioning
   -> CharacterIdentityVersion
```

Provider IDs, model IDs, local module selection and client runtime configuration must not become immutable Character identity simply because the AIRI card stores them together.

### Plugin capability lifecycle

AIRI's Plugin Host contributes a strong capability model:
- announced;
- ready;
- degraded;
- withdrawn.

Extensions have:
- stable per-run session identity;
- explicit runtime;
- declared permissions;
- provided/consumed Kits;
- capability readiness;
- module ownership/revision.

Masanawa should adopt the capability lifecycle and permission-intersection behavior when designing its plugin host.

### Least-privilege plugin grants

AIRI proves several useful permission invariants:
- requested wildcard scopes can be narrowed to concrete grants;
- effective permissions store the concrete host-approved key, not the broader request;
- disjoint grants remain disjoint;
- runtime-declared permissions are not automatically granted;
- module permissions are capped by the parent extension's permission ceiling.

These should become Masanawa plugin-security invariants.

### Extension session cleanup ownership

AIRI keeps an extension session owned until all independent cleanup owners finish.

Masanawa should preserve:
- loaded state separate from cleanup ownership;
- runtime cleanup and asset cleanup tracked independently;
- successful cleanup side effects not repeated on retry;
- failed cleanup retained as debt;
- the exact extension + session identity required to create owned assets.

### Voice input lifecycle

AIRI's voice-input state handling is a strong client reliability donor.

Adopt:
- bind only after both "enabled" and actual MediaStream exist;
- serialize start/stop/replace;
- old stop completes before new start;
- failed start still receives cleanup;
- startup error propagates so UI state can roll back;
- one VAD owner for a stream path;
- replacement stream creates a fresh recognition/VAD session;
- aborted old session cannot emit transcript callbacks into the replacement session;
- provider cancellation closes upstream work.

This behavior belongs in Masanawa client/presence adapters even when LiveKit becomes the realtime transport.

### Computer-use client integration

AIRI provides useful execution-surface separation:
- deterministic tool/terminal workflows first;
- browser DOM control as a distinct lane;
- raw desktop input as a separate fallback lane;
- explicit approval;
- run-level trace/audit/screenshots;
- browser and native-app execution not conflated.

Masanawa should combine these concepts with OpenClaw/N.E.K.O security:
- permissioned tool capabilities;
- stronger app/resource isolation;
- tenant/user authority;
- current-authority revalidation;
- deterministic evidence and reconciliation.

AIRI's approval+audit-only global coordinate model is not sufficient as Masanawa's final safety boundary.

## Client technology decision

AIRI demonstrates that one shared presentation architecture can span web, desktop and mobile, but Masanawa does **not** adopt AIRI's Vue/Pinia/Electron/Capacitor stack wholesale.

Masanawa's existing foundation remains:
- Next.js/React for web/Ops;
- client contracts in TypeScript;
- mobile framework evaluated from React Native/Expo first because it reuses TypeScript/React contracts;
- desktop shell selected later by explicit ADR (Tauri/Electron comparison);
- renderer packages may use Three.js/Pixi/native engines behind an adapter.

This prevents the digital-life donor from creating a second frontend platform.

## Direct reuse assessment

At the pinned revision, AIRI's highly relevant packages are mostly private workspace packages:
- `@proj-airi/plugin-sdk`;
- `@proj-airi/provider-inference`;
- `@proj-airi/stage-ui-live2d`;
- `@proj-airi/stage-ui-three`;
- `@proj-airi/model-driver-lipsync`;
- `@proj-airi/model-driver-magic-live2d`.

Many renderer packages are also Vue-specific.

Therefore:
- no AIRI package is adopted as a mandatory core dependency now;
- MIT-licensed source/behavior can be adapted with provenance;
- lower-level ecosystem libraries (for example Three/VRM/Live2D render libraries) can be selected independently;
- future direct reuse requires a stable public package and a framework-neutral boundary.

## Explicitly rejected assumptions

Do not adopt:
- "character card = complete canonical Character";
- provider/model selections as identity truth;
- browser local storage/Pinia as durable platform truth;
- desktop renderer state as server/world truth;
- AIRI memory experiments as Masanawa's primary memory architecture;
- AIRI's local WebSocket client bridge as Masanawa realtime transport;
- AIRI computer-use global coordinates + approval as sufficient security;
- Vue/Electron/Capacitor as mandatory Masanawa client frameworks.

## Relationship to other donors

- LiveKit/Pipecat remain candidates for realtime media/turn-taking.
- CyberVerse remains a behavior donor for avatar A/V synchronization and foreground/background UX.
- N.E.K.O remains a cognition/proactivity donor.
- OpenClaw remains Gateway/device-node donor.
- elizaOS remains plugin/runtime comparison donor.
- Masanawa identity remains CWS-derived and server-owned.

## Consequence

Masanawa gets AIRI's strongest property—a character that feels continuously embodied across surfaces—without allowing a client application or avatar format to become the platform's source of truth.
