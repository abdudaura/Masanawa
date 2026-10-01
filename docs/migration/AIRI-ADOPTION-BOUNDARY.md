# AIRI Adoption Boundary — Phase 0A Deep Pass

Pinned source: `moeru-ai/airi@85d90ab067ac4625875d5808364bd03bf324645e`

Decision: see `docs/adr/0005-airi-digital-life-adoption-boundary.md`.

## Executive finding

AIRI is the strongest current donor in our vault for **digital-life client architecture and multi-form embodiment**.

It is much broader than an avatar widget. The pinned repository includes:
- Web stage;
- Electron desktop "Tamagotchi" stage;
- Pocket Android/iOS/Web client;
- Live2D;
- VRM/Three.js;
- MMD;
- Spine;
- Tachie/static presentation;
- lipsync/motion drivers;
- provider-inference abstraction;
- plugin host/SDK;
- voice-input lifecycle;
- computer-use execution;
- browser integration;
- game integrations;
- character card import/export.

It does not appear to provide a production WebRTC transport architecture at this revision; LiveKit/Pipecat remain stronger candidates for that layer.

## Character bundle boundary

AIRI's product concept of "character" can bundle:
- persona text;
- avatar/display model;
- provider/model selection for modules;
- speech voice;
- vision/consciousness settings;
- prompts and extension settings.

This is convenient for a personal client but too broad for Masanawa domain truth.

Masanawa must split it:

```
AIRI-like bundle
       |
       +--> CharacterIdentityVersion
       +--> AppearanceProfile
       +--> VoiceProfile
       +--> ClientPresentationPreferences
       +--> ProviderPreference (optional/user/client)
       +--> ExtensionConfiguration
```

Provider selection must not rewrite authored identity.

## Character Card V3

AIRI supports Character Card V3 and AIRI card packs with renderer assets.

Positive behaviors:
- explicit manifest;
- required-file validation;
- field whitelist;
- invalid packages rejected;
- runtime module defaults are distinct from explicit card overrides;
- switching from explicit card override back to inherited settings restores real defaults;
- provider change cannot accidentally retain a model belonging to another provider;
- card update/deletion maintains active-profile consistency.

Masanawa should support CCv3/AIRI-pack import as an interoperability path, not make it the canonical schema.

## Avatar/rendering architecture

AIRI has mature renderer-specific packages and model drivers.

Strong concepts:
- renderer packages own visual state;
- model drivers own pose/motion generation lifecycle;
- targets accept generated pose and release ownership;
- generator can be replaced without destroying the target;
- stop/dispose is explicit;
- lip-sync is isolated from identity/state;
- renderer-specific stores and diagnostics do not become character-domain state.

Masanawa should define framework-neutral AvatarRenderer and MotionDriver contracts.

## Plugin host

AIRI's Plugin Host is a serious architecture donor.

Observed concepts:
- extension import plan before installation;
- permissions shown before import;
- runtime targets: Electron / Node / Web;
- Kit provides/uses dependencies;
- local-only / remotely observable / remotely callable exposure;
- stable extension-session IDs;
- capability states: announced / ready / degraded / withdrawn;
- module binding ownership and revisions;
- debug snapshot for sessions/kits/modules/capabilities.

### Permission semantics

AIRI permission tests establish:
- requested scope and granted scope are distinct;
- host can narrow wildcard request to concrete key/action;
- effective grant stores the narrower approval;
- unrelated keys remain denied;
- runtime permission declaration extends requested baseline but does not auto-grant;
- parent extension grant is a ceiling on child module permissions.

These are worth preserving in Masanawa even if elizaOS or N.E.K.O wins the overall Plugin Host skeleton.

### Cleanup semantics

AIRI's Electron extension sessions preserve ownership until both:
- runtime stopped;
- owned static/assets revoked.

Each cleanup owner is tracked independently. A failed cleanup can retry without repeating one that already succeeded.

This is a useful generic PluginSession cleanup pattern.

## Voice-input architecture

AIRI has unusually good client lifecycle handling.

Important invariants:
- saved "microphone enabled" flag does not imply a stream exists;
- start requires an actual MediaStream;
- stop/start operations serialize;
- old stop cannot tear down a newly-started stream;
- failed startup rejection is preserved to the caller;
- partial startup resources are cleaned;
- only one detector owns a given streaming path;
- replacement stream/provider starts a new binding;
- stale transcript callbacks from aborted binding cannot enter a new one.

This should feed both Masanawa Stage clients and the LiveKit/Pipecat comparison.

## Computer-use architecture

AIRI's `computer-use-mcp` separates:
1. desktop/native-app execution;
2. browser DOM execution;
3. autonomous browser-agent delegation;
4. terminal execution;
5. deterministic workflows.

It also keeps:
- approval queue;
- trace;
- audit;
- screenshots/evidence;
- per-run state.

Useful principle: deterministic DOM/tool/terminal execution is preferred before blind coordinate interaction.

Security gap for Masanawa:
- AIRI's primary macOS v1 allows global coordinates;
- safety is largely approval + deny lists + audit;
- this is not sufficient for a hostile multi-user platform.

Use AIRI's execution-lane design with OpenClaw/N.E.K.O/Masanawa authority and sandbox controls.

## Client surfaces

### Web
AIRI shares stage layout, audio, avatar and provider modules through Vue packages.

### Desktop
Electron owns:
- native lifecycle;
- plugin host;
- local speech/vision capabilities;
- computer use;
- Godot renderer bridge;
- desktop overlay.

### Pocket
Capacitor supplies Android/iOS shells plus:
- microphone permission;
- local notifications;
- QR/barcode;
- host WebSocket bridge.

Masanawa should copy the architectural idea—not these frameworks by default.

## Provider inference

`@proj-airi/provider-inference` is explicitly described as runtime-neutral and contains local/cloud inference definitions.

It is still a private workspace package, so it is not selected as a stable direct dependency. Its separation of provider definitions from UI is a useful secondary pattern for `packages/providers`.

OpenJarvis/provider comparisons remain stronger for platform-wide inference routing.

## Direct reuse assessment

High-value AIRI packages are private and/or Vue-specific at the pinned revision.

Result:
- architectural/source adaptation under MIT: yes;
- mandatory package dependency: no;
- renderer-ecosystem libraries can be chosen independently;
- a future AIRI bridge/component is optional.

## Donor ownership result

Selected:
- **Digital-life/embodiment client architecture: AIRI**

Strong secondary behaviors:
- plugin capability/permission lifecycle;
- voice-input client lifecycle;
- computer-use execution lanes;
- provider-inference separation.

Not selected:
- canonical identity;
- memory;
- realtime transport;
- workflow/business state;
- canonical provider configuration.

## Next comparison

AIRI is now sufficiently characterized to enter the realtime-presence comparison:

```
LiveKit Server + Agents
vs
Pipecat
vs
CyberVerse
+
AIRI embodiment/client lifecycle
```

The presence decision should determine:
- transport;
- server agent-session abstraction;
- turn detection/barge-in;
- media pipeline;
- avatar synchronization;
- client session bridge;
- foreground/background task behavior.
