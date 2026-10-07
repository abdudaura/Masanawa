# Mobile AI Experience

Status: **current consumer AI interaction model — 2026-10-07**

## Two explicit modes

Masanawa must make a strong distinction between:

### Public Talk
Audio intended for an audience. Human Host required. Human and AI participants occupy
limited Seats.

### Private assistant
A user's private conversation with Gwani for platform operation, personal questions,
services and general AI capability.

Content never crosses from private to public without a deliberate user action.

## Gwani

Gwani is the default private Masanawa assistant.

Gwani should be reachable globally and should understand natural requests rather than
forcing users to navigate feature taxonomies.

Examples:
- “Start a Talk about why young people avoid marriage.”
- “Bring an economist.”
- “Help me challenge what that speaker said.”
- “Buy ₦500 airtime for this number.”
- “Show my crypto.”
- “Explain this in Hausa.”
- “Prepare five questions for my guest.”

Gwani can use internal Skills/Tools/Providers, but the user should not see those terms.

## Gwana and other platform personas

Gwana may remain an available Masanawa persona/Expert, and administrators may configure
platform personas. They should appear naturally through persona search/Add AI rather than
forcing permanent large Home cards.

## Language

AI language is dynamic.

Respond in the language/style the user is currently using unless the user explicitly asks
for a different language. Do not hard-code a permanent “agent language preference” that
prevents natural switching.

## Public AI participants

AI participation is always clearly labeled:
- Masanawa Expert
- User Twin

They follow Talk turn-taking rules and must not self-generate endless AI-to-AI dialogue.

## Live voice

Live public Talk audio and private realtime assistant audio are separate sessions even if
both use the same underlying provider/runtime.

Requirements:
- fast join;
- barge-in/interrupt;
- audible native Android playback;
- speaker/earpiece/Bluetooth routing as supported;
- reconnection;
- clear speaking/listening state;
- host absence pauses AI public turn generation.

For the public product, the most important transcript is the durable/replayable Talk
record/metadata. Do not clutter the live screen by transcribing every human utterance as
chat bubbles.

## Private financial actions

Billing/Crypto flows launched from Gwani are private and confirmation-based.

The assistant may read a quote back privately, but it must never announce wallet balance,
recipient details, addresses or transaction data to the public Talk unless the user
explicitly speaks/shares them.

## Files and advanced work

Files, search, research, teaching, translation, writing and other capabilities can return
inside the private Gwani conversation when needed.

Do not give them primary navigation or Rooms.

## Failure behavior

Never expose raw Dio/provider/socket exceptions.

Use concise states:
- “Connection lost. Reconnecting…”
- “That Expert is unavailable right now.”
- “Your Talk ended because the Host disconnected.”
- “We couldn't confirm that payment yet. Checking status.”

Retain operation/session identity so Retry does not duplicate consequential actions.
