# U26 — linked assistant channels: active five-minute claim

- **Claimed:** 2026-10-08 18:04 Africa/Lagos (17:04 UTC); renew by subsequent branch commits.
- **Owner:** this GPT-6 U26 window; **branch:** `work/u26-safe-linked-assistant-channels-20261008-gpt6`; **base main:** `5e758673ae91082520b21b3153da53791ae2cbf3`.
- **Exclusive paths:** `apps/mobile/lib/src/channel_linking/**`, `services/gateway/src/channel_linking/**`, this handoff file.
- **Read-only dependencies:** existing customer-channel bridge, WhatsApp/Telegram webhook/session adapters and customer auth. No root router, canonical gateway composer, shared migrations, finance, Firebase, existing R15 or native files.
- **Status:** CLAIMED, not implemented, not tested; no merge/deployment. Only isolated contract/model/API modules and Flutter screen, with explicit composition handoff after source inspection.
- **Collisions:** U23, U28, U29, U30 and C/R drafts are owned elsewhere; do not modify their files.
