# Channel-aware Agent runtime and Twin routing

Owner/window: current ChatGPT window
Branch: `work/channel-aware-twin-routing-20261007`
Base: `main` @ `47b16c19598448835e09f9616da791a69e46054d`
Started: 2026-10-07

## Scope
Make WhatsApp and Telegram first-class Masanawa conversational surfaces rather than
generic transports.

Acceptance:
- every Agent turn receives explicit surface context;
- model gets channel-specific behavior/capability guidance;
- channel replies do not invent app-only UI;
- users can switch from Gwani/Gwana to a public Twin by conversational request and back;
- switching uses canonical public Twin identity and canonical Character sessions;
- free public Twin text remains free on WhatsApp/Telegram;
- existing billing, crypto, Teaching, Wallet and memory stay in the canonical runtime;
- channel link/session state persists the currently selected Character for continuity;
- tests cover surface context, app-only handoff constraints, Twin switch, return-to-Gwani,
  duplicate/exact-once behavior, and unauthorized/non-public Twin rejection.
