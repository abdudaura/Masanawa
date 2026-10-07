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
