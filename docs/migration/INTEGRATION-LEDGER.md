# Integration Ledger

Every external dependency must enter Masanawa through a canonical capability/provider or channel boundary.

## Current observed inventory

| ID | Provider/system | Source repo | Purpose/capabilities | Side effects | Data sensitivity | Masanawa adapter | Status |
|---|---|---|---|---|---|---|---|
| I-AI-001 | OpenAI APIs | OpenJarvis, N.E.K.O, CyberVerse | LLM/TTS/realtime depending source | model calls | prompt/private context | providers/intelligence+media | discovered |
| I-AI-002 | Google Gemini/GenAI | all except not primary in OpenJarvis | chat/realtime/voice | model calls | prompt/audio/video | providers/intelligence+presence | discovered |
| I-AI-003 | Anthropic | OpenJarvis, N.E.K.O | LLM | model calls | prompt context | providers/intelligence | discovered |
| I-AI-004 | LiteLLM | OpenJarvis, CyberVerse | multi-provider proxy | model calls | prompt context | providers/intelligence | discovered |
| I-AI-005 | Qwen/DashScope | N.E.K.O, CyberVerse | LLM/ASR/TTS/realtime omni | model/media calls | prompt/audio/video | providers/* | discovered |
| I-AI-006 | Ollama | OpenJarvis | local inference | local compute | prompt context local | providers/intelligence | discovered |
| I-AI-007 | vLLM/SGLang/llama.cpp/MLX/etc | OpenJarvis | local/on-device inference | local compute | prompt context local | providers/intelligence | discovered |
| I-PRS-001 | WebRTC/Pion | CyberVerse | realtime browser media | network media | audio/video | services/presence transport | discovered |
| I-PRS-002 | LiveKit ecosystem | CyberVerse | realtime media/session components | network media | audio/video | presence adapter if adopted | discovered |
| I-PRS-003 | TURN | CyberVerse | NAT traversal | network | IP/session metadata | presence transport | discovered |
| I-ASR-001 | Whisper/faster-whisper | CyberVerse/OpenJarvis/N.E.K.O optional | speech recognition | compute/model | voice | provider/asr | discovered |
| I-TTS-001 | OpenAI TTS | CyberVerse | TTS | model call | output text/voice | provider/tts | discovered |
| I-TTS-002 | Qwen TTS | CyberVerse | TTS | model call | output text/voice | provider/tts | discovered |
| I-TTS-003 | Doubao TTS/realtime | CyberVerse | TTS/realtime | model call | audio/text | provider/tts/realtime | discovered |
| I-AVT-001 | FlashHead | CyberVerse | generated human avatar | GPU render | character image/audio | provider/avatar | discovered |
| I-AVT-002 | LiveAct | CyberVerse | generated human avatar | GPU render | character image/audio | provider/avatar | discovered |
| I-RAG-001 | Chroma/LangChain | CyberVerse | RAG/vector knowledge | local/storage | documents/embeddings | knowledge adapter/reference | discovered |
| I-RAG-002 | Milvus | CyberVerse | vector store | external/local DB | embeddings/docs | retrieval provider if needed | discovered |
| I-SRC-001 | OpenClaw | OpenJarvis, N.E.K.O | external skills/agent bridge | external execution | varies | plugin/skill source adapter | discovered |
| I-SRC-002 | Hermes skills | OpenJarvis | skill import | source download/import | code/metadata | skill source adapter | discovered |
| I-SRC-003 | GitHub skill repositories | OpenJarvis | skill import | source download | code/metadata | skill source adapter | discovered |
| I-BRW-001 | Playwright/browser-use | OpenJarvis, N.E.K.O | browser automation | web actions | credentials/page data | tool/browser | discovered |
| I-CUA-001 | OS computer-use stack | N.E.K.O | screen/mouse/keyboard/window automation | device actions | highly sensitive | tool/computer-use | discovered |
| I-DB-001 | Supabase/PostgreSQL | ChatWithStars | canonical operational DB/auth/storage | DB writes | all platform data | canonical database/provider | analysed |
| I-DB-002 | SQLite | N.E.K.O, CyberVerse, OpenJarvis | local journals/tasks/traces | local writes | private/internal | not canonical; migrate concepts | discovered |
| I-PAY-001 | Flutterwave | ChatWithStars | payment/bills/funding/payout-related flows | financial | highly sensitive | commerce provider | analysed |
| I-PAY-002 | VTPass | ChatWithStars legacy | historical bill provider | financial | sensitive | retired/read-only history | analysed |
| I-JEV-001 | TypeSafe/JEV API | ChatWithStars | bounded typed decisions | API calls | bounded decision context | decision provider | discovered |
| I-GPU-001 | Modal | ChatWithStars | GPU/batch compute | compute jobs | media inputs | compute provider | discovered |
| I-GPU-002 | RunPod | ChatWithStars | GPU fallback/dedicated compute | compute jobs | media inputs | compute provider | discovered |
| I-SOC-001 | Telegram | ChatWithStars/OpenJarvis | channel/social messaging | outbound messages | user/channel IDs | channel adapter | discovered |
| I-SOC-002 | Facebook Graph/Pages | ChatWithStars | social publishing/webhooks | public posting | tokens/content | social provider | discovered |
| I-SOC-003 | Discord/Slack/LINE/Viber/etc | OpenJarvis | optional channels | messaging | channel data | reference/future adapters | discovered |
| I-INF-001 | Cloudflare/Vercel | ChatWithStars | web hosting/edge | deployment | config | deployment only, not domain | discovered |
| I-INF-002 | Railway/DigitalOcean | ChatWithStars | stateful compute | deployment | config/secrets | deployment only | discovered |
| I-EMB-001 | local ONNX embeddings | N.E.K.O | memory similarity | local compute | memory text | retrieval provider | analysed |
| I-IPC-001 | ZeroMQ | N.E.K.O | plugin process IPC | local IPC | plugin data | plugin runtime option | discovered |
| I-IPC-002 | gRPC/protobuf | CyberVerse | Go/Python inference boundary | internal RPC | media/control | presence internal contract reference | analysed |
| I-MED-001 | ComfyUI | ChatWithStars | studio image/video/lipsync render workflows | GPU/media jobs | character/media assets | studio render provider | analysed |
| I-MED-002 | Kling/Hailuo/Runway/Veo | ChatWithStars | external video render providers | media jobs | prompts/assets | studio render providers | analysed |
| I-MED-003 | ffmpeg | ChatWithStars | deterministic media probing/fitting/mux/assembly | local media processing | media files | studio media tool | analysed |
| I-SEC-001 | token vault/encryption layer | ChatWithStars automation | social/provider credential protection | credential read/write | secrets | security/vault abstraction | analysed |
| I-PRS-004 | RTP/RTCP transport feedback | CyberVerse | realtime A/V pacing, bitrate and sync feedback | media transport control | session/network metadata | presence transport abstraction | analysed |
| I-WRK-001 | isolated subagent bridge process | CyberVerse | background specialist execution | child-process work/artifacts | task context + selected credentials | worker execution adapter | analysed |
| I-PRS-005 | LiveKit Server | LiveKit | WebRTC rooms/participants/tracks/data/telephony infrastructure | realtime network/media | audio/video/IP/session | services/presence transport | discovered |
| I-PRS-006 | LiveKit Agents | LiveKit | AgentSession/Worker/STT/LLM/TTS/realtime/avatar integrations | model/media/tool calls | prompt/audio/video | services/presence runtime adapter | discovered |
| I-PRS-007 | Pipecat | Pipecat | frame/pipeline realtime multimodal processing | model/media/network | prompt/audio/video | presence pipeline reference/adapter | discovered |
| I-AVT-003 | LiveKit avatar plugin ecosystem | LiveKit Agents | realtime avatar providers | external/GPU media | character image/audio | provider/avatar | discovered |
| I-MEM-001 | Letta APIs/runtime | Letta | persistent stateful-agent memory/server | memory/state operations | private memory | memory donor/provider only if adopted | discovered |
| I-MEM-002 | Mem0 | Mem0 | extraction/retrieval/entity/temporal memory | memory/vector operations | private memory | memory specialist provider/reference | discovered |
| I-GW-001 | OpenClaw channel/device ecosystem | OpenClaw | WhatsApp/Telegram/Slack/Discord/Teams/iMessage/device nodes | messages/device actions | highly sensitive | optional bridge + architecture donor | analysed |
| I-INT-001 | MCP | LiveKit/OpenClaw/MAF/elizaOS ecosystem | external tools/context protocol | external tool calls | varies | gateway/tools interoperability | discovered |
| I-INT-002 | A2A | Microsoft Agent Framework ecosystem | cross-agent protocol | inter-agent calls | bounded task/context | gateway/agent interoperability | discovered |
| I-LOC-001 | elizaOS local inference/device runtime | elizaOS | local text/embedding/speech/vision/image inference | local compute/device | prompt/media local | provider/local compute reference | discovered |
| I-GW-002 | @openclaw/gateway-protocol | OpenClaw | typed WebSocket protocol schemas/validators | control-plane messages | sensitive depending payload | optional OpenClaw bridge adapter only | analysed |
| I-GW-003 | @openclaw/gateway-client | OpenClaw | reference WebSocket client | Gateway RPC/events | sensitive depending payload | optional OpenClaw bridge adapter only | analysed |
| I-DEV-001 | OpenClaw node/device protocol | OpenClaw | pairing, token rotation, capability publication, remote invoke, offline pending work | device actions | highly sensitive | device-node architecture donor | analysed |
| I-OC-001 | @openclaw/ai | OpenClaw | published provider adapters/streaming/tool-call normalization | model calls | prompt/private context | optional provider implementation behind Masanawa adapter | analysed |
| I-OC-002 | @openclaw/gateway-protocol + gateway-client | OpenClaw | optional interoperability with OpenClaw Gateway/nodes/clients | gateway RPC/events | session/device metadata | compatibility adapter only, never canonical protocol | analysed |
| I-AIRI-001 | Character Card V3 / AIRI card packs | AIRI | portable persona/presentation/avatar import-export | imported files/config | potentially sensitive/untrusted | identity import/export adapter | analysed |
| I-AIRI-002 | Live2D/Pixi renderer ecosystem | AIRI | 2D avatar rendering/expression/motion | client rendering | character assets | AvatarRenderer implementation candidate | analysed |
| I-AIRI-003 | Three.js / VRM renderer ecosystem | AIRI | 3D avatar rendering/animation | client rendering | character assets | AvatarRenderer implementation candidate | analysed |
| I-AIRI-004 | AIRI Plugin Host/SDK | AIRI | extension sessions/kits/capabilities/permissions | extension execution | sensitive by capability | plugin architecture donor; no direct core dependency | analysed |
| I-AIRI-005 | AIRI computer-use MCP | AIRI | native desktop/browser DOM/terminal execution | device actions | highly sensitive | computer-use architecture donor | analysed |
| I-AIRI-006 | AIRI provider-inference | AIRI | runtime-neutral text/speech/transcription provider definitions | model/media calls | prompt/audio | secondary provider architecture donor | analysed |
| I-AIRI-007 | Electron/Capacitor shells | AIRI | desktop/mobile packaging and native bridges | local device access | device-sensitive | reference only pending client ADR | analysed |

Auth, retry, idempotency and reconciliation fields still require source-by-source deep extraction.
