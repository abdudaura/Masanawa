# Donor Provider Catalog

Status: Phase 0 inventory.

This catalog records provider families present in donor systems. Presence here does not mean Masanawa must enable every provider at launch. Providers are implementation adapters behind canonical capabilities.

## General intelligence / inference

Observed across donors:
- OpenAI-compatible APIs;
- OpenAI;
- Anthropic/Claude;
- Google Gemini;
- Qwen/DashScope;
- DeepSeek;
- GLM/Zhipu;
- StepFun;
- xAI/Grok;
- Kimi/Moonshot;
- MiniMax;
- Doubao/Volcengine;
- MiMo;
- SiliconFlow;
- OpenRouter and other OpenAI-compatible gateways;
- LiteLLM aggregation;
- NVIDIA NIM;
- Atlas/other compatible endpoints.

Local/on-device serving patterns observed in OpenJarvis:
- Ollama;
- vLLM;
- SGLang;
- llama.cpp/Gemma.cpp;
- MLX;
- LM Studio-compatible endpoints;
- Apple Foundation Models;
- Nexa/Lemonade/Exo-style local runtimes.

Disposition: B/reference provider adapters. Masanawa launches only providers selected by product/quality/cost requirements. ProviderRouter preserves explicit-selection and policy-governed fallback semantics.

## Realtime/omni voice intelligence

Observed:
- Gemini Live;
- OpenAI Realtime;
- Qwen Omni/realtime;
- Doubao realtime;
- Grok Voice;
- GLM Realtime;
- Step realtime;
- compatible/custom realtime endpoints.

Disposition: B provider adapters under `services/presence` / `packages/providers`. No realtime provider owns canonical conversation or memory state.

## ASR

Observed:
- Whisper/faster-whisper;
- Qwen ASR;
- provider-integrated realtime transcription.

Disposition: B adapters. Realtime models that understand audio directly may bypass separate ASR per session policy.

## TTS / voice cloning

Observed:
- OpenAI TTS;
- Qwen TTS;
- Doubao TTS/voice cloning;
- MiniMax voice cloning;
- CosyVoice references;
- ElevenLabs configuration references;
- MiMo TTS;
- native realtime provider voices.

Disposition: B adapters. Character voice is a provider-independent VoiceReference plus version/provenance/rights policy.

## Avatar / digital human

Observed:
- Live2D;
- VRM;
- MMD;
- PNGTuber/desktop pet;
- SoulX FlashHead;
- SoulX LiveAct;
- Baidu Xiling;
- Xunfei Digital Human;
- Vidu digital-human/video paths.

Disposition: B adapters. Local model code/weights are independently licensed/deployed; CyberVerse bundled GPL/model code is not copied.

## Image/video/studio

Observed in ChatWithStars:
- ComfyUI;
- Kling;
- Hailuo;
- Runway;
- Veo;
- deterministic ffmpeg/media tooling;
- GPU workers via Modal/RunPod.

Disposition: B Studio provider adapters. Exact providers are replaceable and chosen per quality/cost/license.

## Search/RAG/knowledge

Observed:
- web search tools;
- local document retrieval;
- Chroma/LangChain patterns;
- Milvus;
- FAISS/ColBERT/BM25 references;
- local embeddings/ONNX;
- OpenAI/Qwen embeddings.

Disposition: B retrieval adapters. PostgreSQL/document storage remains source truth; indexes are derived.

## Browser/computer use

Observed:
- Playwright;
- browser-use;
- pyautogui/screen/window stacks;
- external agent bridges such as OpenClaw.

Disposition: B Tool adapters with explicit capability/permission/sandbox policy.

## Messaging/social channels

Observed:
- Web;
- WhatsApp;
- Telegram;
- Facebook Pages/Graph;
- Discord;
- Slack;
- LINE;
- Viber;
- Messenger;
- Reddit;
- Mastodon;
- XMPP;
- Rocket.Chat;
- Zulip;
- X/Twitter;
- Twitch;
- Nostr;
- Twilio/Gmail integrations.

Disposition:
- Web/WhatsApp/Telegram: A/B first-party targets inherited from ChatWithStars.
- Facebook/social publishing: A/B product target.
- others: B/C adapter backlog until a concrete product requirement selects them.

## Commerce

Observed:
- Flutterwave active production path in ChatWithStars;
- VTPass historical/retired path.

Disposition: Flutterwave/reference provider adapter initially; provider-neutral commerce contracts. VTPass is C historical and must not silently return as fallback.

## Infrastructure/compute

Observed:
- PostgreSQL/Supabase;
- Railway;
- DigitalOcean;
- Cloudflare;
- Vercel;
- Modal;
- RunPod;
- local desktop/device compute.

Disposition: infrastructure adapters/deployment choices. Domain packages do not depend on vendor deployment identity.

## Marketplace/distribution

Observed:
- GitHub skill sources;
- Hermes skills;
- OpenClaw skills;
- agentskills.io;
- Steam Workshop/Steamworks;
- plugin marketplaces.

Disposition: B extension/source adapters. Imported artifacts enter trust/provenance/certification pipeline.
