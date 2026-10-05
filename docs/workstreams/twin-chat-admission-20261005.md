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

Status: implementation started 2026-10-05.
