# Mobile WhatsApp-style redesign and runtime repair

Owner/window: current ChatGPT window
Branch: `work/mobile-whatsapp-redesign-runtime-repair-20261007`
Base: `main` @ `e4498b91510ff9951de7efe56b2847551648172d`
Started: 2026-10-07

## Acceptance from physical APK feedback

- Full WhatsApp-green visual identity, not Agent Blue.
- Chat visually and behaviorally feels WhatsApp-like: green header/actions, warm chat background,
  compact bubbles/composer, minimal chrome.
- Home contains no conversation-history list; conversation history belongs under Activity.
- Gwani/Gwana home controls are roughly half the previous visual footprint.
- Home must fail soft; raw Dio/transport exceptions are never user-facing and retry actually reloads.
- Explore is compact and useful, without decorative section titles/descriptions or a large spin card.
- Text and live voice must target the same canonical current Gateway and expose friendly actionable failures.
- Production Railway Gateway must be redeployed from canonical main, not a stale historical branch.


## Implemented

- Replaced Agent Blue with WhatsApp green: #25D366 / #075E54 / #128C7E and WhatsApp-like dark surfaces.
- Global light app bars are dark WhatsApp green with white chrome; bottom navigation uses compact green selected state.
- Rebuilt Home as a compact list surface with Gwani/Gwana controls roughly half the previous footprint.
- Removed all conversation-history continuations from Home state/rendering.
- Home now fails soft to cached canonical Agent directory + local room projection if /home is unavailable.
- Raw Dio/transport errors are never rendered on Home; Retry invalidates and reloads the provider.
- Moved local conversation history into Activity while preserving Twin activity and owner-request actions.
- Rebuilt Explore as a compact searchable public-Twin list; removed spin rail, giant selected card, redundant headings/descriptions.
- Chat header is WhatsApp green; removed wallet clutter from the header; outgoing bubbles use WhatsApp green bubble tone; composer is more compact.
- Extended stale CharacterSession retry to 404/409 and canonical session failure codes.
- Fixed Gemini Live setup: input/output audio transcription fields now sit at Bidi setup level, matching the constrained Live token.
- Updated mobile widget acceptance tests so the old rejected Home/Explore copy and layout cannot silently return.

## Production root cause found

Railway project `empowering-education`, service `masanawa-gateway`, is currently sourced from stale branch
`work/production-apk-integration-20261005` and live commit `76945ae3097ff04084a97266d22b3a7d93102bce`.
The APK defaults to that Railway service, so current-main mobile/server contracts were talking to an old Gateway.
After this lane merges, the existing Railway service must be reattached to canonical `main` and its live deployment
verified before text/voice qualification is considered meaningful.
