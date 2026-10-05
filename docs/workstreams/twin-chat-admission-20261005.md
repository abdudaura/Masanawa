# Twin chat admission workstream

Owner/window: current ChatGPT implementation window
Branch: `work/twin-chat-admission-20261005`
Base SHA: `b27554f1f953d96d5e7d44727cd4f8fef170009f`

## Scope

Codify the simplified interaction charging rule:
- public twin text messages are free;
- voice notes and live voice require a valid trial/paid admission;
- UI/client flags can never make text billable or voice free.

## Owned paths

- new `services/gateway/src/twin_chat_admission*.ts`
- focused tests
- this claim file

## Explicitly not owned

- existing ai chat routes/runtime
- live voice token route
- Commerce settlement
- shared Gateway app/main
- mobile chat screen

Status: isolated interaction-admission rule complete; shared chat/live-token integration pending.

Implemented:
- text-message / voice-note / live-voice classification;
- text messages always admitted as free with zero charge and no paid admission;
- attaching a paid admission can never make text billable;
- voice note/live voice require a valid paid/trial admission;
- admission must match authenticated user and target twin;
- admission must be active and unexpired;
- cross-user/cross-twin/expired voice admissions fail closed;
- focused tests for free text and trial/paid voice admission boundaries.

Not yet integrated:
- existing AI chat route/runtime;
- voice-note send path;
- Live voice token minting;
- paid voice quote/admission persistence;
- Commerce settlement;
- Activity events.

Integration invariant:
the chat/live voice runtime must call this admission gate before any billable voice
interaction. Client flags never determine free/paid status.


## Local verification

Local strict TypeScript verification: `twin_chat_admission.ts` compiles cleanly with `tsc --strict --noEmit` in isolation.
