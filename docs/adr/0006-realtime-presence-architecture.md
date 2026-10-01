# ADR-0006: Realtime Presence Architecture

Status: accepted
Date: 2026-10-01

## Decision

Masanawa implements realtime presence independently behind `services/presence`.

CyberVerse is the behavioral architecture donor for WebRTC/media epochs/AV sync/full-duplex/avatar session patterns, but its GPLv3 core is not copied.

ChatWithStars contributes operational call readiness/recovery/relink/race behavior.
N.E.K.O contributes permissioned perception and optional speaker identity.

Durable identity, memory, conversation and task truth remain outside the presence transport.

Voice-only operation is first-class; avatar rendering is optional.

Realtime output/control is generation/epoch tagged so stale events cannot mutate the active turn.
