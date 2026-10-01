# Source Map — LiveKit

Pinned:
- server `7ef0cd014e950373acd789557099305716eea196`
- Agents TypeScript `df97b867b3b16efbd348584c818cefc5536ef21a`
- Agents Python `d251b89e61fe5f8ba78e0b39b501d91b0856a2d0`

Status: Phase 0A initial map.

LiveKit server is the leading candidate for production WebRTC/media transport. LiveKit Agents is a server-side realtime-agent framework.

Evaluate:
- room/participant/media lifecycle;
- WebRTC reconnect/ICE/TURN/track handling;
- Agent/AgentSession/Worker/job dispatch;
- semantic end-of-turn detection and interruption;
- STT/LLM/TTS/Realtime provider plugins;
- avatar plugins;
- RPC/data APIs between agent and clients;
- telephony and cross-platform clients;
- MCP/tool integration;
- production metrics/recovery/worker scaling.

Masanawa likely uses these transport/session ideas behind `services/presence`; LiveKit must not own character identity, durable memory or workflow truth.
