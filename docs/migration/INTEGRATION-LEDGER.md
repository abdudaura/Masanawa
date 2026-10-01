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
| I-PRS-005 | LiveKit Server | LiveKit | WebRTC rooms/participants/tracks/data/telephony infrastructure | realtime network/media | audio/video/IP/session | selected services/presence transport | analysed |
| I-PRS-006 | LiveKit Agents TypeScript | LiveKit | AgentSession/Worker/STT/LLM/TTS/realtime/avatar integrations | model/media/tool calls | prompt/audio/video | selected services/presence session runtime | analysed |
| I-PRS-007 | Pipecat | Pipecat | frame/pipeline realtime multimodal processing | model/media/network | prompt/audio/video | secondary architecture / optional specialized worker | analysed |
| I-AVT-003 | LiveKit avatar plugin ecosystem | LiveKit Agents | realtime remote/generated avatar providers | external/GPU media | character image/audio | selected remote AvatarSession provider boundary | analysed |
| I-MEM-001 | Letta Code memory/runtime | Letta Code | working blocks, revisioned memory filesystem, recall/conflict semantics | memory/state operations | private memory | architecture/reference; optional compatibility adapter only | analysed |
| I-MEM-002 | Mem0 OSS/components | Mem0 | extraction, hybrid semantic/BM25/entity retrieval, expiration/validity behavior and evaluation | memory/vector operations | private memory | specialist component/provider behind packages/memory; never authority | analysed; richer temporal projection remains Masanawa-owned |
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
| I-PRS-008 | Official LiveKit client SDKs | LiveKit | browser/mobile/desktop room/media clients | realtime network/media | audio/video/device permissions | client PresenceTransport adapters | analysed |
| I-PRS-009 | LiveKit SIP/telephony ecosystem | LiveKit | phone call ingress/egress into realtime rooms | telephony side effects | phone/audio/call metadata | future telephony presence adapter | analysed |

Auth, retry, idempotency and reconciliation fields still require source-by-source deep extraction.

| I-MEM-003 | PostgreSQL/pgvector memory projections | Masanawa | canonical memory records + initial vector/search projections | DB/index writes | private/shared memory by scope | packages/memory persistence/retrieval | selected architecture; implementation deferred until Phase 0 closes |
| I-MEM-004 | Mem0 vector-store adapter ecosystem | Mem0 | rebuildable vector/search projections across pgvector, Qdrant, Pinecone, Redis, Milvus, Chroma, Elasticsearch, OpenSearch, MongoDB, Supabase and other supported stores | projection/index writes and queries | embeddings + scoped memory projections | packages/memory/retrieval/providers | analysed; never canonical truth; adapter failure may degrade recall but cannot alter scope or canonical records |
| I-MEM-005 | Mem0 embedder and reranker ecosystem | Mem0 | embeddings plus optional reranking (Cohere/HuggingFace/LLM/sentence-transformer/ZeroEntropy and related providers) | model/provider calls or local compute | private memory text, query text, embeddings and retrieval candidates | packages/providers + packages/memory/retrieval/providers | analysed; reranker failure falls back without mutating candidates and still honors top-k |
| I-MEM-006 | Mem0 self-hosted API/auth/ops server | Mem0 | optional REST compatibility, JWT/API-key auth, configuration, request logs, entity/admin dashboard | API/auth/config/log/database writes | credentials, identity/scope IDs, private memory metadata | adapters/memory-compat + apps/ops/security | analysed/reference-only; never canonical Masanawa auth or memory authority |
| I-MEM-007 | Mem0 agent/framework plugin ecosystem | Mem0 | Claude/Codex/Cursor/Kimi/Antigravity/Hermes/Strands/n8n and related memory hooks, MCP/plugin adapters and flush/spool workers | plugin hooks, MCP/API calls, local spool/flush | session identifiers and private memory/context snippets | plugins/memory-adapter | analysed/reference-unless-selected; adapter receives canonical authorized scope and cannot invent/widen it |

| I-AGT-001 | donor agent runtimes (OpenJarvis/elizaOS/MAF) | comparison donors | execution/strategy/component/workflow reference | model/tool calls | private context | architecture/reference only; no canonical runtime dependency | selected boundary |
| I-SKL-001 | Agent Skills / MCP skill sources | OpenJarvis/MAF/OpenClaw | import/progressive disclosure/interoperability | source/resource reads | untrusted code/content | packages/skills source adapters with quarantine/certification | selected boundary |
| I-WFL-001 | Microsoft Agent Framework | Microsoft AF | workflow/checkpoint/HITL semantics | workflow/model/tool calls | private/business state | architecture/reference; reimplement TS/PostgreSQL | selected boundary |
| I-PLG-001 | elizaOS plugin ecosystem | elizaOS | component/plugin interoperability reference | extension-defined | varies/high | optional import/compatibility adapters only | selected boundary |

### Phase 0B ChatWithStars integration additions

| ID | Provider/system | Source repo | Purpose/capabilities | Side effects | Data sensitivity | Masanawa adapter | Status |
|---|---|---|---|---|---|---|---|
| I-PAY-003 | NOWPayments | ChatWithStars | crypto payment/funding webhook path | financial/crypto | payment refs, wallet/account metadata | commerce provider adapter | discovered |
| I-TEL-001 | Telnyx | ChatWithStars legacy web | number search/purchase, callbacks, WebRTC token/webhooks | telephony purchase/call | phone/audio/call metadata | future telephony provider only if independently selected | discovered |
| I-SOC-004 | YouTube Data/ingestion | ChatWithStars automation | social/video discovery and historical backfill | external reads, scheduling | channel/video metadata | social ingestion provider | analysed |
| I-SOC-005 | TikTok | ChatWithStars automation | publishing/provider integration | public posting | tokens/content | social provider adapter | discovered |
| I-AUTH-001 | Google OAuth | ChatWithStars admin | connected-account authorization | OAuth grants | user/provider tokens | auth/integration adapter | discovered |
| I-WA-001 | WhatsApp Web runtime | ChatWithStars calls/runtime | message/call transport on linked account | messaging/calls/device session | highly sensitive | gateway/channel/presence adapter; not domain authority | analysed |


### Phase 0B AI Town integration additions

| ID | Provider/system | Source repo | Purpose/capabilities | Side effects | Data sensitivity | Masanawa adapter | Status |
|---|---|---|---|---|---|---|---|
| I-AIT-001 | Convex | AI Town | database, transactions, scheduler, functions, vector search, object storage | DB/jobs/storage/network | world, message, memory and media state | reference only; semantics reimplemented on canonical platform services | analysed; must not become hidden runtime authority |
| I-AIT-002 | OpenAI-compatible HTTP LLM APIs | AI Town | chat + embeddings with retry/stream handling | model calls | prompts, memories, conversation data | packages/providers | analysed; provider failure cannot partially mutate world truth |
| I-AIT-003 | Ollama | AI Town | local chat + embeddings/model pull | local compute/network | prompts/memories local | packages/providers/local | analysed; readiness/model pull are provider state only |
| I-AIT-004 | Replicate MusicGen | AI Town | asynchronous background-music generation | media generation/webhook/storage | prompts/provider IDs/media | studio/provider adapter if ever selected | analysed; donor webhook lacks signature verification/correlation, so signed callback + durable request + dedupe/reconcile are mandatory |
| I-AIT-005 | Clerk | AI Town | optional/commented authentication | auth/OAuth | identity/session | none as architecture | retired/reference; canonical Masanawa auth only |


### Phase 0B elizaOS integration additions

| ID | Provider/system | Source repo | Purpose/capabilities | Side effects | Data sensitivity | Masanawa adapter | Status |
|---|---|---|---|---|---|---|---|
| I-ELZ-001 | elizaOS host plugin packages | elizaOS | plugin discovery/resolution/staging | filesystem/package loading | executable code/config | plugin host/quarantine/certification | analysed; kernel must not install packages |
| I-ELZ-002 | PostgreSQL/PGlite plugin SQL | elizaOS | runtime persistence, migrations, RLS | DB writes/migrations | identity/memory/task/etc | reference mechanics only; canonical PostgreSQL remains Masanawa-owned | analysed |
| I-ELZ-003 | eliza model plugin ecosystem | elizaOS | text/embedding/media/local/cloud inference | model calls/local compute | prompt/media/private context | packages/providers | analysed; policy-constrained fallback only |
| I-ELZ-004 | eliza connector ecosystem | elizaOS | inbound/outbound channel adapters | messaging/external actions | channel IDs/content | gateway/channel adapters | partial; connector metadata boundary analysed, delivery semantics still pending |
| I-ELZ-005 | eliza cloud runtime proxy | elizaOS | remote sandbox chat/status execution | remote RPC | prompt/session/runtime metadata | optional compute/runtime adapter only | analysed; cannot own identity/memory/workflow truth |
| I-ELZ-006 | native platform bridges | elizaOS | location/phone/device capabilities | device reads/actions | highly sensitive | device-node/perception/tools adapters | partial; authority broker analysed, native action families still pending |


| I-ELZ-007 | Discord connector | elizaOS | inbound/outbound messaging | external messages | message content, account/room/user IDs | gateway/channel adapter | analysed for durable inbound idempotency/provenance; outbound ambiguity still pending |
| I-ELZ-008 | Telegram connector | elizaOS | inbound/outbound messaging/forum topics | external messages | message/account/chat IDs | gateway/channel adapter | partial; service lifecycle located, delivery ambiguity still pending |
| I-ELZ-009 | OpenAI-compatible provider plugin | elizaOS | text/embedding/media capabilities | model/media calls | prompt/media/private context | packages/providers | analysed; capability registration and fallback constraints recorded |
| I-ELZ-010 | local inference router | elizaOS | on-device inference with optional cloud fallback | local/cloud compute | private prompts/media | packages/providers/local | analysed; explicit recoverable-failure classification and TTS fail-closed |


| I-ELZ-011 | Browser workspace/native Chromium/Stagehand targets | elizaOS | browser/computer use | web navigation/forms/clicks/uploads | credentials/page/device data | packages/tools browser adapters | analysed; no post-dispatch replay, domain policy and confirmation requirements recorded |
| I-ELZ-012 | connector credential vault | elizaOS | OAuth/provider secret persistence | encrypted secret read/write/reveal | highly sensitive | packages/security vault | analysed; durable restart test and fail-closed key behavior recorded |
| I-ELZ-013 | cloud environment secret cache | elizaOS | reduce process.env secret exposure | in-process secret read/clear | highly sensitive | host defense-in-depth only | analysed; non-durable, never canonical |


### Phase 0B Microsoft Agent Framework integration additions

| ID | Provider/system | Source repo | Purpose/capabilities | Side effects | Data sensitivity | Masanawa adapter | Status |
|---|---|---|---|---|---|---|---|
| I-MAF-001 | Microsoft Agent Framework workflow runtime | Microsoft Agent Framework | graph/checkpoint/HITL/orchestration semantics | workflow/tool/model execution | private/business | architecture donor only; reimplement packages/workflows in TS/Postgres | analysed |
| I-MAF-002 | A2A | Microsoft Agent Framework | remote agent/workflow protocol | remote calls/messages | prompts/session/task IDs | protocol adapter | analysed; adapter cannot own auth/HITL/workflow truth |
| I-MAF-003 | MCP | Microsoft Agent Framework | tools/resources/agent/workflow exposure | external tool calls | tool args/session/provider data | tools/protocol adapter | analysed; auth/session/server lifecycle app-owned |
| I-MAF-004 | OpenAI/Anthropic/Bedrock/Gemini/Mistral/Ollama/Foundry/Copilot providers | Microsoft Agent Framework | model/chat/agent integrations | model calls/remote state | private prompts/media | packages/providers | analysed; retry/fallback remains Masanawa policy |
| I-MAF-005 | Azure Cosmos workflow checkpoint store | Microsoft Agent Framework | durable workflow checkpoints | database reads/writes | private/business workflow state | workflow persistence reference | analysed; donor store not canonical |
| I-MAF-006 | Foundry hosted checkpoint/state store | Microsoft Agent Framework | hosted workflow/session durability | remote state reads/writes | private/business workflow state | deployment/workflow adapter reference | analysed; optimistic concurrency/branch retention retained |
| I-MAF-007 | Postgres/SQL Server/Redis/Mongo/Qdrant/DuckDB/Azure search stores | Microsoft Agent Framework | data/vector/search/session integrations | database/index operations | memory/search/session data | provider/index adapters | analysed; never alternate domain authority |
| I-MAF-008 | Mem0/Valkey/Cosmos memory adapters | Microsoft Agent Framework | memory provider integrations | external memory reads/writes | private memory | packages/memory provider adapters only | analysed; canonical memory remains packages/memory |
| I-MAF-009 | Hyperlight/Monty/LocalCodeAct/Shell | Microsoft Agent Framework | code/shell execution | arbitrary compute/filesystem/process | highly sensitive | packages/tools sandbox adapters | analysed; canonical authorization/approval required |
| I-MAF-010 | OpenTelemetry exporters | Microsoft Agent Framework | traces/metrics/logs | telemetry export | operational; optionally private content | packages/telemetry | analysed; sensitive content disabled by default |


### Phase 0B OpenClaw integration additions

| ID | Provider/system | Source repo | Purpose/capabilities | Side effects | Data sensitivity | Masanawa adapter | Status |
|---|---|---|---|---|---|---|---|
| I-OCL-001 | OpenClaw Gateway | OpenClaw | channel/session/tool/device control plane | messaging/device/tool execution | highly sensitive | optional trusted-boundary bridge + architecture donor | analysed; never public tenant auth boundary |
| I-OCL-002 | channel durable ingress framework | OpenClaw | append/ack/replay/restart recovery | transport ack + message dispatch | private content/IDs | gateway channel adapter framework | analysed |
| I-OCL-003 | OpenClaw device/node protocol | OpenClaw | pairing/token rotation/node invocation | device commands/credential writes | highly sensitive | device-node adapter | analysed |
| I-OCL-004 | OpenClaw operator approval store | OpenClaw | durable exec/operator approvals | authorization mutation/consume | highly sensitive | packages/security/workflows | analysed |
| I-OCL-005 | OpenClaw managed skill library | OpenClaw | skill revisioning/sharing/session pinning | executable content publication | executable/content | packages/skills | analysed |


| I-OCL-006 | OpenClaw provider plugin runtime | OpenClaw | model/auth/catalog/transport hooks | model calls, OAuth/credential refresh | prompts/secrets/provider state | packages/providers | analysed |
| I-OCL-007 | OpenClaw memory-core/memory-host | OpenClaw | provenance, recall, dreaming, compaction | memory reads/writes | private memory | packages/memory behavior donor only | analysed; donor files/SQLite rejected as authority |
| I-OCL-008 | OpenClaw cron/heartbeat | OpenClaw | schedules/proactive wakes | model/tool/message execution | task/session data | packages/workflows trigger/scheduler adapters | analysed; not canonical workflow engine |
| I-OCL-009 | OpenClaw guarded HTTP/SSRF layer | OpenClaw | secure network fetch | outbound network | URLs/network metadata | packages/security HTTP policy | analysed |
| I-OCL-010 | OpenClaw diagnostics/OTel/telemetry | OpenClaw | support/tracing/usage telemetry | telemetry/export | operational; optional private content | packages/telemetry | analysed; content opt-in |
