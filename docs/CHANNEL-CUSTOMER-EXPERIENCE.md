# WhatsApp and Telegram customer experience

Status: canonical channel behavior, 2026-10-07.

WhatsApp and Telegram are first-class Masanawa conversational surfaces. They use the
same canonical User, Character, Relationship, Memory, Skills, Commerce, Wallet and
Agent runtime as the Masanawa mobile app. They are not separate bot brains.

## Surface awareness

Every admitted Agent turn carries one explicit surface:

- `mobile`
- `whatsapp`
- `telegram`

Channel turns also carry whether the active Character is a platform/support Agent or a
public AI Twin. Production inference receives this as system context.

WhatsApp/Telegram Characters must:

- know they are not inside the Masanawa mobile app;
- never invent app tabs, sheets, cards or buttons;
- keep answers compact and conversational;
- ask one question at a time where possible;
- follow the user's current language dynamically;
- accept voice notes/media without asking the user to retype understood information;
- use short numbered choices when selection is useful;
- hand off to the app only when the current runtime truly cannot complete an action.

## Chat-capable services

The channel runtime can currently complete or continue these through the canonical
Agent path when the corresponding provider/runtime is configured:

- normal Gwani/Gwana conversation;
- Billing flows;
- Wallet/funding guidance used by Billing;
- Crypto capabilities, balances, deposits, conversion/withdrawal quote-confirm flows
  and provider invoice handoff;
- Core Teaching with durable learner progress;
- Memory/context-backed conversation;
- free public Twin text conversation;
- Character switching between Gwani/Gwana and public Twins.

The model must never claim completion without runtime evidence.

## Public Twin chat

A customer may send a public Twin link, an `@publicId`, or a clear request such as
`talk to Aisha's Twin`.

Routing is deterministic, outside model inference:

1. exact public IDs/share links are resolved through the canonical Twin directory;
2. names use authorized public-directory search;
3. hidden/blocked/non-discoverable Twins cannot resolve;
4. ambiguous names produce a short choice list rather than guessing;
5. the previous CharacterSession is closed when possible;
6. the channel link is updated to the selected Character with a fresh session;
7. following messages go directly to that Twin through the normal Agent runtime.

The switch message explicitly identifies the Character as an **AI Twin**, states that
the real owner is not present, and states that ordinary text chat is free.

Customers can say `back to Gwani`, `talk to Gwana`, or `back to my assistant`.
The same canonical User identity remains in force; only the active Character changes.

## Features that are not implicitly channel-complete

Until a concrete conversational action is wired and returns runtime evidence, the Agent
must not claim that the following are completed inside WhatsApp/Telegram:

- paid realtime Twin voice;
- real-owner access/session lifecycle;
- Twin creation or profile customization;
- visual Explore browsing;
- gifts or user-to-user Credit transfer;
- other app-only configuration or visual control surfaces.

The Agent may explain the feature and provide the smallest app handoff when needed.
Adding any of these later should extend the canonical runtime/tooling, not create
WhatsApp- or Telegram-specific business logic.

## Continuity

WhatsApp and Telegram resolve to canonical Masanawa Users. Teaching progress, durable
service state, Wallet/Commerce authority and Character/Relationship context therefore
remain canonical across surfaces. Channel transport state contains only the external
channel link and active CharacterSession reference; it does not own duplicate Memory,
Wallet or Agent state.
