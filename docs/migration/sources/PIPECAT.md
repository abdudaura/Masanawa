# Source Map — Pipecat

Pinned: `6396f9771e4d7870b3d538fda38a4241caf6c642`.

Status: Phase 0A initial map.

Pipecat is a realtime voice/multimodal pipeline framework.

Evaluate:
- frame-based audio/video/control pipeline;
- processor composition and backpressure;
- WebRTC/WebSocket transports;
- VAD/STT/LLM/TTS/realtime service composition;
- multi-agent handoff, parallel fan-out, sidecars/shared bus;
- Pipecat Flows structured conversation/state patterns;
- interruption/latency/metrics behavior;
- client SDK protocols.

Likely role: pipeline/turn-taking donor complementing LiveKit transport. Compare carefully before duplicating realtime abstractions.
