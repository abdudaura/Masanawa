# Phase 0B Forensic Coverage — AIRI

Pinned revision: moeru-ai/airi@85d90ab067ac4625875d5808364bd03bf324645e

Status: COVERED AT PINNED REVISION

AIRI is the selected digital-life/embodiment client donor. It contributes client/runtime contracts, not canonical Character, Memory, World, Workflow or Provider truth.

## Descendant capability matrix

| Family | Implementation/test evidence | State treatment | A/B/C | Canonical Masanawa destination | Acceptance/parity gate |
|---|---|---|---|---|---|
| Shared Stage/client shell | apps/stage-web, stage-pocket, stage-tamagotchi; packages/stage-shared, stage-ui/layouts/pages | presentation/runtime projection | B/C | clients/stage | same Character/session can render across web/desktop/mobile without client becoming identity authority |
| Desktop client lifecycle | apps/stage-tamagotchi Electron main/renderer services + lifecycle tests | local app/window/config state | B/C | clients/desktop | client restart/window lifecycle preserves only permitted local preferences; canonical state rehydrates from platform |
| Mobile client/native bridge | apps/stage-pocket Android/iOS bridges + bridge tests | NativeBridgeSession only | B | clients/mobile + gateway | close-before-open fails connection; closed mapping removed; native transport does not establish identity |
| Web client | apps/stage-web + browser tests | browser-local preferences/projections | C/B | clients/web | useful UI behavior only; no local store becomes canonical |
| Character-card interoperability | packages/ccc, core-character, stage character UI | import/projection | B | packages/identity import | imported card/package validated and mapped to versioned Character proposal; never overwrite current version silently |
| Core agent/message rendering | packages/core-agent contracts/runtime/messages/tests | runtime context only | B/C | packages/agents/context compiler | client agent helpers may shape rendering/context but Character/session/workflow authority remains server-side |
| Plugin activation planning | packages/plugin-sdk activation-plan + tests | D-PLG-030 proposal | A/B | packages/plugins | deterministic side-effect-free plan; duplicate/missing/incompatible providers/dependencies/cycles block before lifecycle mutation |
| Plugin permissions | plugin-sdk permission service/tests | D-PLG-031 revisioned grant | A | plugins/security | effective permission is exact request∩grant; wildcard narrowed; child module cannot exceed parent ceiling |
| Plugin session/resource cleanup | extension-sessions/resources/services tests | runtime session/resource ownership | A/B | packages/plugins | extension-owned resources released with session; independent runtime/asset debt cannot leak after stop/reload |
| Plugin protocol/kits | plugin-protocol, plugin-sdk-tamagotchi | typed extension contract | B | plugins/contracts | plugins register canonical capabilities/resources only; no parallel domain abstractions |
| Concrete plugins | plugins/airi-plugin-* | plugin-local/runtime state | C/B | optional plugins | each independently selected/certified; examples do not become core |
| Inference provider registry | packages/provider-inference registry/runtime matrix/validators/tests | provider definitions/config | B | packages/providers | explicit deterministic provider definitions; no module import side-effect registry; concrete providers governed by ADR-0010 |
| Concrete inference providers | provider-inference cloud/local provider tree | provider-specific state/credentials | C/B | provider adapters only if selected | independent activation/certification; broad donor provider list not adopted wholesale |
| Voice-input lifecycle | tamagotchi voice-input lifecycle + stage-ui binding/session/transcription/VAD tests | D-RTC-040 | A | presence + clients | start/stop/replace serialized, stale queued request suppressed, failed start cleaned and propagated |
| Audio/hearing pipeline | stage-ui audio composables, pipelines-audio, stage-shared hearing channel | ephemeral media/transcript state | B | presence/client | transcript revisions correlate by source/utterance and enter platform only through normal perception admission |
| Renderer-neutral embodiment | stage-ui Live2D/Three/MMD/Spine/Tachie packages | renderer/runtime state | B | clients/embodiment | renderers consume canonical appearance refs and can be swapped without identity change |
| Model-driver lifecycle | model-driver-magic-live2d, mediapipe, lipsync + tests | D-AVT-030 renderer lease | A/B | clients/embodiment | replace generator without releasing target; stop/dispose releases exactly once and clears generated/filter state |
| Lip-sync/motion | model-driver-lipsync/magic/mediapipe | derived motion state | B | embodiment/presence | derived animation never mutates Character identity; audio/viseme pipeline replaceable |
| Game/input/device integrations | gamepad/DualSense/Godot/tamagotchi engine | device/runtime state | C/B | perception/extensions | explicit permission/admission before device input affects context/world |
| Computer-use runtime | tamagotchi computer-use runtime/tests | D-CUA-030 lease | A/B | tools/perception/security | bounded command grammar, host routing/storage authority, realpath-constrained artifacts, serialized queue, safe disposal |
| Computer-use MCP service | services/computer-use-mcp + extensive tests/contracts | device/browser/desktop session state | B/C | tools/perception adapters | deterministic/browser-DOM/desktop lanes remain separate; provider/service is optional implementation |
| Screen capture/ambient perception | electron-screen-capture, ambient-light sampling | client sensor projection | B/C | perception/client | explicit permission; derived visual environment not identity/world truth |
| Integrations/bots | integrations/minecraft, telegram, satori, twitter, vscode, discord | adapter/channel state | C/B | gateway/plugins/providers | optional independently selected adapters; OpenClaw remains Gateway architecture donor |
| Widgets/image providers | tamagotchi widget providers | provider/plugin state | C/B | plugins/providers | optional provider adapters under ADR-0010 |
| Server runtime/API | server/** + server-runtime/server-sdk | service/session/config state | C/B | gateway/services/providers | useful adapter/API behavior only; no alternate backend authority |
| Memory pgvector | packages/memory-pgvector | derived vector projection | C/B | packages/memory projection | ADR-0007 canonical records remain source of truth; index rebuildable |
| Stage/server auth | ui-server-auth, PKCE/auth helpers | auth session/client state | B/C | security/auth clients | client auth flow cannot substitute canonical account/tenant authorization |
| Engines/Godot tamagotchi | engines/stage-tamagotchi-godot | game/render process state | C/B | clients/embodiment/extensions | optional renderer/game engine only |
| Tests/scenarios/docs | package/app/browser/native test suites, scenario packages, docs | evidence/fixtures | evidence | parity/reference | tests remain behavior evidence; examples/assets need provenance review |

## Integration disposition

airi-integration-disposition-manifest.json explicitly covers 483 concrete provider/integration/plugin adapter files. Structural provider registry and validation behavior is retained; concrete services remain C/B reference candidates unless separately selected and certified.

## File accounting

airi-file-family-manifest.json accounts for all 5,697 pinned files with zero unresolved paths.

## Client authority boundary

AIRI-CLIENT-AUTHORITY.md maps client/local/plugin/provider/renderer/mobile/memory-index state to canonical Masanawa owners and prevents client state becoming a second platform truth.

## License/provenance

AIRI root source is MIT at the pinned revision. Third-party models/assets/provider SDKs/native dependencies still require path/upstream provenance if directly reused. The integration manifest does not imply adoption rights or provider selection.

## Merge decision

Adopt:
- Stage concept and cross-surface digital-life lifecycle;
- renderer-neutral embodiment/model-driver ownership;
- deterministic extension activation planning;
- least-privilege permission intersection and parent ceiling;
- extension resource/session cleanup;
- serialized voice-input binding lifecycle;
- bounded host-owned computer-use routing/artifact semantics;
- mobile/native bridge lifecycle patterns.

Redesign behind Masanawa contracts:
- provider registry -> ADR-0010 packages/providers;
- agent/message helpers -> packages/agents/context compiler;
- plugin runtime -> packages/plugins;
- mobile/web/desktop bridges -> client adapters;
- local vector state -> packages/memory projections.

Do not adopt as canonical:
- AIRI Character/client stores;
- local/browser memory truth;
- provider configuration as Character identity;
- AIRI server/runtime as backend kernel;
- bot/integration ecosystem wholesale;
- Electron/Vue/Capacitor/Godot as mandatory frameworks.

## Closure

There are no unresolved AIRI file families at the pinned revision. Any future direct dependency on a concrete AIRI provider/integration/native asset reopens path-specific provenance and provider certification.
