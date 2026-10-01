# Source Map — LiveKit

Pinned:
- server `7ef0cd014e950373acd789557099305716eea196`
- Agents TypeScript `df97b867b3b16efbd348584c818cefc5536ef21a`
- Agents Python `d251b89e61fe5f8ba78e0b39b501d91b0856a2d0`

Status: Phase 0A presence deep pass complete.

Decision: `docs/adr/0006-realtime-presence-architecture.md`.

## Executive result

LiveKit Server is selected as Masanawa's primary realtime media transport. LiveKit Agents TypeScript is selected as the primary server-side realtime session/worker substrate inside `services/presence`.

LiveKit does **not** own canonical Character identity, durable memory, Masanawa Tasks/Workflows, authorization policy, provider policy or recording consent.

## LiveKit Server

The pinned server is a distributed WebRTC SFU with:
- rooms/participants/tracks/data;
- UDP/TCP/TURN;
- JWT room permissions;
- selective subscription;
- simulcast/SVC;
- E2EE support;
- SIP/telephony ecosystem;
- webhooks;
- multi-region/self-hosted deployment;
- broad web/mobile/desktop/embedded SDK ecosystem.

Masanawa should use this infrastructure rather than implement its own SFU/TURN/media-router stack.

Room, participant and track IDs are external presence identifiers, not canonical platform-user/Character IDs.

## LiveKit Agents TypeScript

`@livekit/agents` is a public Apache-2.0 package and aligns with Masanawa's TypeScript core.

Observed `AgentSession` capabilities include:
- Room input/output;
- VAD;
- STT;
- LLM and realtime/duplex models;
- TTS;
- streaming/semantic endpoint detection;
- adaptive interruption and overlapping speech;
- preemptive generation;
- AEC warmup;
- transcription timeout;
- tool execution;
- usage/metrics/OpenTelemetry;
- activity/agent handoff;
- AvatarSession;
- granular recording/redaction;
- worker/job execution.

Masanawa wraps this machinery behind its own `PresenceSession` and `TurnPolicy` contracts.

## Turn handling

Observed turn modes:
- STT;
- VAD;
- realtime model;
- manual;
- streaming semantic detector.

Detector-aware endpointing defaults are explicit. Agent/activity-specific overrides can supersede session defaults and runtime endpointing changes survive activity handoff.

Masanawa should compile its own framework-neutral TurnPolicy into these settings.

## Interruption

Regression behavior worth preserving:
- minimum interruption duration/words can filter noise/backchannels;
- overlapping speech is observable separately;
- AEC warmup can suppress false interruption;
- interruption before first audio playout must not wedge the current speech handle and silence all future turns;
- TTS and audio-forwarding stalls are bounded;
- false interruption/correction remains distinct from durable task cancellation.

## Activity handoff/resource ownership

LiveKit activity handoff can transfer reusable resources such as STT pipelines.

Ownership rules:
- resources not successfully transferred are cleaned if next activity fails;
- once the next activity accepts ownership, the old activity must not clean them;
- reusing the same activity avoids needless detach/restart;
- runtime turn-policy overrides survive the transition.

This is a PresenceActivityHandoff optimization, not Masanawa CharacterHandoff.

## Worker/job boundary

LiveKit AgentServer manages:
- worker connection/health;
- process pool;
- job assignment;
- load;
- shared inference process;
- shutdown/drain.

A LiveKit Job means "run this realtime worker/session." It is not a Masanawa durable user Task. A Masanawa Task can survive many presence jobs/reconnects.

## AvatarSession

LiveKit's remote avatar abstraction is selected for generated/cloud avatar participants.

Useful lifecycle:
- avatar can publish as a room participant;
- start should precede AgentSession when it replaces audio output;
- wait for participant + video publication;
- bounded join timeout;
- avatar playback metrics;
- job shutdown owns cleanup;
- participant already absent is successful/idempotent cleanup;
- other remote-removal failure does not prevent local lifecycle release;
- an ambiguous provisioning attempt can roll back local start state without blindly removing a possibly valid remote participant.

This complements AIRI local rendering.

## Recording/privacy

LiveKit supports granular recording for audio, traces, logs, transcript and redaction.

Masanawa owns the policy. Recording settings must compile from tenant policy, user consent, channel and sensitivity; framework defaults cannot override that policy.

## Direct reuse

Selected:
- LiveKit Server as transport infrastructure;
- `@livekit/agents` inside `services/presence`;
- official LiveKit client SDKs appropriate to each Masanawa client.

Domain packages must not import LiveKit types.

## Remaining follow-up

Revisit only for implementation-level contract mapping, provider selection and load/recovery tests. The structural donor decision is complete.
