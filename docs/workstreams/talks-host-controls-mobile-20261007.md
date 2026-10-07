# Talk Host controls mobile implementation — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-host-controls-mobile-20261007`
Base: `18af70f2a363d8207db612fa40883c1158297feb`

## Scope

Replace listener-only controls on Host Talk view with compact Host moderation controls.

Owned:
- mobile Host control models/transport/provider;
- Host Requests / Manage sheets;
- End Talk confirmation;
- Talk screen Host action-bar wiring;
- focused mobile tests;
- this handoff.

Not owned:
- live audio/media transport (#344/#345);
- Talk persistence migrations (#337);
- AI Seat payment/holds;
- backend Host moderation implementation;
- production deployment.

## Product rules

Host controls are compact:
- Requests
- Add AI
- Manage
- End

Human Speaker requests are free.
Sponsored AI requests never bypass Host approval.
Host may accept/decline requests and mute/remove active non-Host participants.
The Host itself cannot be removed through the moderation sheet.
End Talk is explicit and destructive.

Status: active.
