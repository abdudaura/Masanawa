# Integration Ledger

Every external dependency must enter Masanawa through a canonical capability/provider or channel boundary.

## Required fields

| ID | Provider/system | Source repo | Purpose/capabilities | Auth | Side effects | Data sensitivity | Retry/idempotency | Reconciliation | Masanawa adapter | Status |
|---|---|---|---|---|---|---|---|---|---|---|

## Categories to inventory

AI/intelligence:
- OpenAI;
- Gemini;
- Anthropic/compatible endpoints;
- Qwen/DeepSeek/local providers;
- Ollama/vLLM or other local serving.

Media:
- ASR;
- TTS/voice cloning;
- realtime voice;
- image generation;
- video generation;
- lipsync;
- avatar/digital-human inference.

Knowledge/action:
- search;
- browser/computer use;
- files/RAG;
- calendars/email;
- maps/weather/travel.

Channels/social:
- web;
- WhatsApp;
- Telegram;
- Facebook;
- X;
- Instagram/TikTok.

Commerce:
- Flutterwave and any historical provider paths that require explicit retirement/reconciliation.

Infrastructure:
- Supabase/PostgreSQL;
- object storage;
- Railway/DigitalOcean;
- Modal/RunPod;
- Cloudflare/Vercel.

Phase 0 must find provider-specific assumptions hidden in source code, environment variables, migrations and tests.
