# Admin WhatsApp linked-device control workstream

Owner/window: current ChatGPT window
Branch: `work/admin-whatsapp-linked-control-20261007`
Base: `main` @ `eeb128e270219bded246a2d68d4e00474c86fa86`
Started: 2026-10-07

## Scope

Reclaim the stale Admin mobile control plane from PR #129 without reviving obsolete
product/runtime assumptions, then add the operational UI needed for the new linked-device
Gwani WhatsApp channel.

Owned paths:
- `apps/admin_mobile/**`
- linked-device Admin mobile client/UI tests/docs directly required by this workstream

Shared dependencies:
- current main Gateway admin routes:
  - `GET /admin/channels/whatsapp/status`
  - `GET /admin/channels/whatsapp/qr`
  - `POST /admin/channels/whatsapp/reset`

## Acceptance

- Admin app can display WhatsApp connected/offline/QR state.
- QR data URL can be rendered for admin scanning.
- Admin can request a fresh session/reset from the app.
- No WhatsApp credentials or linked auth state are embedded in the APK.
- Existing canonical Gateway/Gwani runtime remains the only Agent/service authority.
- Useful stale Admin mobile code is preserved; unrelated stale runtime work is not merged.
