# Twin conversation identity UI workstream

Owner/window: current ChatGPT implementation window
Branch: `work/twin-conversation-identity-20261005`
Base SHA: `b27554f1f953d96d5e7d44727cd4f8fef170009f`
Task: TWIN-024 UI primitive

## Scope

Add a reusable conversation identity banner as a new file only.

## Owned paths

- new `apps/mobile/lib/src/screens/chat/components/twin_identity_banner.dart`
- focused widget test
- this claim file

## Product rule

The customer must always be able to distinguish:
- the owner's AI twin;
- the real human owner when they actually join.

No AI output may be visually presented as if the human personally authored it.

Status: isolated identity UI primitive complete; shared chat integration pending.

Implemented:
- AI Twin presence state;
- real Human Owner presence state;
- explicit explanatory copy in each state;
- visually distinct AI/Owner badge;
- widget tests for both identities.

Not yet integrated:
- ai_chat header/composer surface;
- real owner session presence events;
- owner join/leave runtime;
- shared router/chat integration.

Invariant:
AI-generated messages must never be presented as if the human owner personally authored
them; switching to Owner state requires actual verified human presence.
