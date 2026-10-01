# CyberVerse Clean-Room Acceptance Specification

Pinned evidence source: Lynpoint/CyberVerse@13a6a95b47e5e6f0809683458767746ad54d7d7f
License boundary: GPLv3
Implementation rule: independent Masanawa implementation only.

This document intentionally restates observable behavior at a contract level. It does not reproduce CyberVerse code or protobuf schemas.

## Presence and media

### Playback generations
- Every assistant playback generation has a monotonically scoped epoch/generation identifier.
- Media feedback, audio-delay correction and stale idle/speech segments are accepted only for the active generation.
- Feedback from an earlier generation is ignored.
- Starting a new generation clears generation-specific correction buffers and RTP gap clocks.

Acceptance tests:
1. apply synchronization feedback for epoch N;
2. advance to epoch N+1;
3. submit further feedback tagged N;
4. verify N+1 media state is unchanged.

### RTP gap handling
- Normal scheduling jitter does not advance media clock as an idle discontinuity.
- A real inter-segment idle gap does.
- Gap state persists inside one playback generation and resets across generations.

### Bounded A/V correction
- Audio/video synchronization correction is bounded and incremental.
- Audio delay carries buffered tail within the same generation.
- Correction state resets on generation change.
- Buffer overflow removes oldest data rather than growing without bound.

### Audio-only degradation
If avatar/video generation is disabled or unavailable:
- assistant audio remains deliverable;
- no avatar generation call is required;
- text/transcript/session history can still complete;
- session returns to listening/ready state.

Avatar failure therefore cannot collapse voice presence.

### Idle/silent avatar behavior
- Idle media can be superseded by speech from a newer generation.
- Newly created idle media after current speech remains valid.
- Cached idle media is keyed by renderer-relevant dimensions/profile.
- A cache for a different output resolution is not treated as a hit.

### Media-path reset
A media-output path reset:
- clears output transport tracks and synchronization state;
- does not unnecessarily close still-valid inbound user-audio/input channels;
- allows session identity/runtime state to survive transport repair.

## Background task behavior

### Task lifecycle
Canonical Masanawa equivalent supports:
queued -> running -> waiting_user -> completed | failed | cancelled.

CyberVerse names are evidence only; packages/workflows owns the final state machine.

### Ordered task events
- task events receive strictly increasing sequence numbers;
- reconnect can request events after sequence K;
- returned events preserve task order.

### Terminal immutability
After completed/failed/cancelled:
- no later state event can mutate the task;
- no late artifact may be added;
- terminal evidence remains stable.

### Artifact safety
- externally supplied task/artifact identifiers are never used as unchecked filesystem paths;
- traversal/path separators are rejected before persistence;
- workflow artifact identity is independent from physical object-store key.

### Foreground/background split
- long work can be accepted quickly while realtime conversation continues;
- background work runs under role/tool/skill/package/environment bounds;
- progress is visible through canonical workflow events;
- completion is reinjected/delivered through Character/runtime channels rather than making the worker a new Character identity.

## Avatar/provider behavior

### Warmup
- renderer/provider warmup is explicit and timeout-bounded;
- warmup failure degrades capability without corrupting PresenceSession;
- warmup readiness does not imply Character/session ownership.

### Provider separation
ASR, LLM, TTS, realtime voice and avatar generation are independent provider capabilities.
Masanawa maps these to packages/providers operation definitions rather than one monolithic digital-human provider.

## RAG / knowledge projection

- document source ID and provenance are retained through chunking/indexing;
- reindexing one source replaces that source's previous derived chunks;
- vector indexes are rebuildable projections, never canonical knowledge truth;
- backend-specific score semantics normalize to one higher-is-better relevance contract before policy filtering;
- source deletion failure must not silently claim a successful replacement;
- per-character directories/collections from CyberVerse are not adopted as Masanawa's authorization model.

## WebSocket/client behavior

- WebSocket admission/origin checks belong to Masanawa Gateway/security policy.
- Client stores are projections only.
- reconnect does not redefine canonical session, task, Character or conversation truth.

## Recording

Recording is independently policy-controlled.
A live session can enable or disable audio/video/transcript/log/trace recording according to Masanawa privacy policy; transport framework defaults never decide retention.

## Clean-room test construction

Masanawa tests derived from this specification must:
- use independently named fixtures and data models;
- assert observable outcomes, not donor internal function names;
- avoid copying donor source or protobuf field layouts;
- cite this forensic specification and ledger IDs as provenance;
- run against Masanawa PresenceSession/WorkflowTask/Provider contracts.

## Non-adopted boundaries

The following are specifically not adopted:
- CyberVerse Go server architecture;
- CyberVerse Python inference service topology;
- CyberVerse Vue stores/components;
- CyberVerse SQLite task/character stores;
- CyberVerse protobuf schemas/generated code;
- CyberVerse per-character vector-store authorization model;
- CyberVerse embedded model forks;
- PersonaAgent/subagent object identity as Character identity.

