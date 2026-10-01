# Source Map — LiveKit

Pinned:
- server `7ef0cd014e950373acd789557099305716eea196`
- Agents TypeScript `df97b867b3b16efbd348584c818cefc5536ef21a`
- Agents Python `d251b89e61fe5f8ba78e0b39b501d91b0856a2d0`

Status: Phase 0A presence adoption pass complete.

Decision: LiveKit Server is selected for production WebRTC/media transport; LiveKit Agents TypeScript is selected as the primary server-side realtime-session donor. See ADR-0006.

## Selected responsibilities

LiveKit Server contributes:
- room/participant/media lifecycle;
- WebRTC reconnect/ICE/TURN/track handling;
- cross-platform client transport;
- telephony integration;
- data/RPC transport;
- production media-server scaling.

LiveKit Agents TypeScript contributes:
- `AgentSession` lifecycle;
- worker/job integration;
- turn detection;
- interruption/barge-in;
- STT/LLM/TTS/realtime-provider composition;
- per-turn activity state;
- metrics and session observability.

LiveKit Agents Python remains:
- a maturity/reference source;
- a provider/plugin parity source;
- an optional Python-specialist adapter where ecosystem needs justify it.

It is not a second canonical runtime.

## Masanawa boundary

LiveKit is infrastructure behind `services/presence`.

It must not own:
- Character identity;
- user-character relationships;
- durable Conversation truth;
- Memory;
- World state;
- Workflow/task truth;
- authorization policy;
- commerce/business state.

A LiveKit room is a transport instance bound to a Masanawa `PresenceSession`/`RuntimeSession`, not the canonical session itself.

## Required adaptation

Masanawa should define its own:
- `PresenceTransport`;
- `PresenceSession`;
- `PresenceProcessor`;
- provider adapter;
- client/avatar bridge.

LiveKit-specific IDs and metadata stay at the adapter edge.

## Turn/interruption findings

The pinned TypeScript Agents implementation exposes:
- `AgentSession` as the top-level live-session orchestrator;
- `AgentActivity` as a per-turn state machine;
- turn-detection and interruption controls;
- reuse/replacement of STT/turn-detector streams;
- playout-aware lifecycle.

Adopt the behavior behind Masanawa contracts, while preserving CyberVerse-derived playback-epoch/generation protection so stale callbacks cannot affect a newer turn.

## Direct reuse posture

Direct use of LiveKit Server is allowed as external transport infrastructure.

A direct dependency on LiveKit Agents TypeScript is allowed in `services/presence` after implementation-time version/license/API verification. Domain packages may not import it.

## Remaining Phase 0 work

Presence ownership is frozen. Further LiveKit source mining moves to Phase 0B coverage/parity rather than reopening the architecture unless contradictory evidence appears.
