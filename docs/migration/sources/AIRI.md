# Source Map — AIRI

Pinned revision: `85d90ab067ac4625875d5808364bd03bf324645e`.

Status: Phase 0A deep pass complete for digital-life clients, embodiment, Character Card, plugin capability lifecycle, voice-input lifecycle and computer-use execution surfaces.

Decision: `docs/adr/0005-airi-digital-life-adoption-boundary.md`.

## Executive result

AIRI is selected as Masanawa's primary architectural donor for **digital-life client and embodiment architecture**.

It is not selected as the owner of:
- canonical Character identity;
- memory;
- world state;
- business workflow;
- realtime WebRTC transport;
- canonical provider configuration.

## Repository shape

The pinned repository contains roughly 5.7k files and includes:
- Web stage;
- Electron desktop stage/tamagotchi;
- Pocket Android/iOS/Web client;
- server/API;
- plugin SDK/host/protocol;
- provider-inference packages;
- computer-use MCP service;
- Live2D/VRM/MMD/Spine/Tachie presentation;
- lipsync/motion drivers;
- game integrations;
- extensive client/provider tests.

AIRI is therefore a digital-life client platform, not merely an avatar component.

## Character Card boundary

AIRI supports Character Card V3 plus AIRI-specific extensions and display assets.

Useful behaviors:
- package/manifest validation;
- required file checks;
- explicit field handling;
- renderer assets can travel with a character package;
- imported card overrides can inherit global module defaults;
- switching away from explicit overrides restores real defaults rather than carrying state from the prior card;
- changing provider cannot silently retain an incompatible previous model;
- active-card deletion falls back to a known default.

Masanawa adaptation:

```
portable card/package
      -> validation
      -> import proposal
      -> identity fields
      -> appearance/avatar assets
      -> voice profile/preferences
      -> client presentation preferences
      -> optional provider preferences
      -> operator/version review
      -> canonical CharacterIdentityVersion + presentation records
```

Provider/model IDs and client module settings do not become immutable Character identity.

## Stage and embodiment

AIRI demonstrates one character "stage" across:
- web;
- desktop;
- mobile/pocket.

Masanawa should preserve this product concept through a shared client contract while allowing framework-specific shells.

Render forms observed:
- Live2D;
- VRM/Three.js;
- MMD;
- Spine;
- Tachie/static;
- Godot/native VRM experiments.

Masanawa needs one renderer-neutral `AvatarRenderer`/presentation contract.

## Model-driver lifecycle

The Live2D motion driver demonstrates useful separation:
- generated pose source;
- target renderer;
- start/replace/stop/dispose;
- explicit target release;
- filter lifecycle;
- monotonic/fixed-rate frame processing;
- generator replacement without target teardown.

Masanawa should keep visual motion/lipsync as presentation state, never domain Character state.

## Plugin Host

AIRI's Plugin Host is a strong secondary plugin donor.

Observed:
- extension import plan;
- declared runtimes (web/node/electron);
- permissions;
- Kit dependencies and exposure;
- stable extension-session identity;
- capability lifecycle: announced / ready / degraded / withdrawn;
- module ownership/revision;
- debug snapshots.

Permission invariants:
- requested scope and granted scope remain separate;
- broad wildcard request may be narrowed to concrete host-approved keys/actions;
- the effective grant stores the narrower concrete approval;
- unrelated capabilities stay denied;
- runtime declaration does not imply grant;
- child module permissions cannot exceed parent extension permission ceiling.

## Extension cleanup

AIRI separates "loaded projection" from retained cleanup ownership.

A session remains owned until all cleanup owners release it:
- runtime shutdown;
- asset revocation.

Completed cleanup is not repeated when another cleanup owner fails. Reload cannot take ownership while cleanup debt remains.

Asset ownership validates both extension ID and exact session ID.

This is a strong generic plugin lifecycle invariant.

## Voice-input lifecycle

AIRI has mature client-side microphone lifecycle handling:
- "enabled" is separate from actual MediaStream availability;
- bind only after a real stream exists;
- serialize start/stop/replacement;
- old stop finishes before a replacement starts;
- failed start still receives cleanup;
- startup errors propagate so UI can roll back;
- one VAD owner per stream mode;
- replacement stream creates a new binding;
- cancelled old session cannot deliver stale transcripts into the new binding;
- cancellation propagates upstream.

These behaviors should feed Masanawa clients regardless of the LiveKit/Pipecat transport choice.

## Computer use

`services/computer-use-mcp` separates:
- desktop/native app actions;
- browser DOM actions;
- autonomous browser-agent delegation;
- terminal actions;
- deterministic reusable workflows.

Strong behaviors:
- deterministic tools/DOM/terminal preferred before raw coordinate interaction;
- explicit approval;
- run trace/audit/screenshots;
- dry-run mode;
- denied sensitive applications;
- browser and desktop treated as different execution surfaces.

Masanawa must strengthen the safety boundary with tenant/user authority, sandbox/resource policy and OpenClaw/N.E.K.O security patterns. AIRI's global-coordinate + approval/audit boundary is not sufficient by itself.

## Provider inference

AIRI has a runtime-neutral provider-inference package and broad speech/local-provider integrations. It is useful as a secondary provider architecture reference.

OpenJarvis remains a stronger candidate for platform-wide provider routing and health/discovery.

## Direct reuse assessment

Relevant AIRI packages are predominantly private workspace packages and several renderer packages are Vue-specific.

Examples:
- `@proj-airi/plugin-sdk` — private;
- `@proj-airi/provider-inference` — private;
- `@proj-airi/stage-ui-live2d` — private/Vue;
- `@proj-airi/stage-ui-three` — private/Vue;
- `@proj-airi/model-driver-lipsync` — private;
- `@proj-airi/model-driver-magic-live2d` — private.

Masanawa therefore does not adopt AIRI as a mandatory package dependency.

Use:
- MIT-attributed behavior/source adaptation;
- independent lower-level renderer libraries where appropriate;
- optional compatibility/import support for AIRI/CCv3 character packages.

## Client-framework boundary

AIRI uses Vue + Electron + Capacitor and shares significant Vue-specific presentation code.

Masanawa keeps:
- React/Next.js baseline for web;
- TypeScript client contracts;
- React Native/Expo as the first mobile evaluation;
- desktop shell selected later via explicit Tauri/Electron ADR;
- avatar rendering behind a framework-neutral adapter.

## Memory/realtime limitations

AIRI's memory work is fragmented/experimental relative to N.E.K.O/Letta/Mem0 and is not selected as the memory skeleton.

The pinned tree has no clear production WebRTC subsystem. AIRI is therefore an embodiment/client contributor to the upcoming presence comparison, not the transport donor.

## Remaining AIRI follow-up

AIRI is sufficiently analysed for its digital-life ownership decision.

Revisit only during:
- LiveKit/Pipecat/CyberVerse presence comparison;
- elizaOS/N.E.K.O/OpenClaw plugin comparison;
- OpenClaw/elizaOS device/computer-use comparison;
- future desktop/mobile client technology ADR.
