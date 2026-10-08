# Mobile AI Experience

Status: **canonical AI interaction model, updated for approved 2026-10-08 five-tab target**

## Two explicit modes

Masanawa must make a strong distinction between:

### Public Talk
Audio intended for an audience. Human Host required. Human and AI participants occupy
limited Seats.

### Private assistant
A user's **single switchable Gwani/Gwana conversation** in the **center Assistant tab** for platform operation, personal questions,
services and general AI capability.

Content never crosses from private to public without a deliberate user action.

## Gwani and Gwana: one central Assistant chat

Gwani is the default private Masanawa assistant. Gwana is selectable **inside the same private Assistant chat interface**, retaining authorized conversation history, drafts and pending task IDs. Replies must disclose and attribute the active persona; switching cannot duplicate payment approval or leak a human DM or public Talk. Users can speak, type or tap without mandatory voice, and each persona shares only explicit permission-scoped operator tools.

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

Gwana is an **approved selectable operator persona within the single center Assistant chat**, not a separate app root or competing chat screen. The full 17-persona Masanawa Expert roster and user-owned Twins remain discoverable in the dedicated **Agents** tab for private persona interactions and separately authorized public Talk Seats. No permanent agent cards on the public Talks feed.

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
inside the **same switchable private Gwani/Gwana Assistant conversation** when needed.

Do not give them primary navigation or Rooms.

## Failure behavior

Never expose raw Dio/provider/socket exceptions.

Use concise states:
- “Connection lost. Reconnecting…”
- “That Expert is unavailable right now.”
- “Your Talk ended because the Host disconnected.”
- “We couldn't confirm that payment yet. Checking status.”

Retain operation/session identity so Retry does not duplicate consequential actions.

## Final navigation placement and release boundary

Approved five-tab mobile target: **Talks · Chats · Assistant · Wallet · Agents**, with Assistant centered. Talks is public human-hosted audio; Chats human DMs only; Assistant is one private Gwani/Gwana operator conversation; Wallet is finance; Agents are Experts/Twins. This is a design contract, **not evidence that the current APK or real services implement it**. Source/navigation ownership and qualified acceptance are in `APP-SHELL-CONTRACT.md`, `END-TO-END-UX-ARCHITECTURE.md`, R17 and C08.
