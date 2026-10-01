# AIRI Client State Authority Map

Pinned source: moeru-ai/airi@85d90ab067ac4625875d5808364bd03bf324645e

Status: COMPLETE FOR PHASE 0B

AIRI is the primary digital-life/embodiment client donor, but its client state is presentation/runtime state only.

| AIRI state family | Example evidence | Masanawa owner | Treatment |
|---|---|---|---|
| Character card/config/local character UI | stage pages, character cards, core-character/ccc imports | packages/identity | import/projection only; canonical Character/version stays server-side |
| Pinia/localStorage settings | stage-shared versioned local storage, stage UI stores | client preferences/config | local preference cache only |
| Chat/session messages | core-agent/session/context stores | agents/gateway/conversation | runtime projection; not durable identity/memory truth |
| Plugin enabled intent and sessions | plugin-sdk host/session services | packages/plugins | retain activation/session mechanics; canonical plugin manifest/install policy remains platform-owned |
| Plugin grants | permission service | plugins/security | revisioned effective runtime grant; host policy remains authoritative |
| Provider definitions/API keys | provider-inference and settings UI | packages/providers + security | definitions can be client-discovered; credentials use scoped vault refs in production |
| Renderer/model state | Live2D/VRM/MMD/Spine/model-driver packages | clients/embodiment | runtime/render state only; Character appearance refs remain identity-owned |
| Voice-input state | stage UI bindings and tamagotchi lifecycle | presence/client | ephemeral revisioned binding; transcript becomes canonical only through normal PerceptionEvent admission |
| Screen/ambient/gamepad/device state | stage-shared/input/device packages | perception/client | permission-scoped perception only |
| Computer-use runtime/session | tamagotchi computer-use + computer-use-mcp | tools/perception/security | host/device lease and tool execution evidence; no client-owned task/workflow truth |
| Native WebSocket bridge state | Stage Pocket Android/iOS bridge | mobile client/gateway | transport handle only |
| Server runtime/local channel state | server-runtime/server-sdk | gateway/service adapters | no canonical platform truth |
| Memory pgvector package | packages/memory-pgvector | packages/memory projection | optional derived index only; ADR-0007 canonical records win |
| Widget/image provider state | widget providers | plugins/providers | optional provider/plugin projection |
| Gamelet/tamagotchi state | plugin SDK kits, engine/game scenarios | optional extensions/world projection | extension state only unless explicitly admitted into packages/world |

## Rules

- Client/local state may improve UX/offline continuity but cannot silently mutate server-side canonical truth.
- Importers emit validated proposals; they do not overwrite current Character versions.
- Plugin permission snapshots are bounded by current platform policy and may be invalidated/reduced at runtime.
- Renderer failure cannot destroy Character/session identity.
- Native/mobile bridges cannot establish canonical user identity merely because a socket is connected.
- Local pgvector/embeddings remain rebuildable projections.
