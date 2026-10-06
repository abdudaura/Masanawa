# Masanawa mobile — chat-first screen map

Status: product UX contract
Date: 2026-10-06

## Global rule

Masanawa is **WhatsApp-style conversation plus Masanawa services**. It is not a collection of mini-apps.

- Chat is the default execution surface.
- Service-specific UI should be small conversational helpers: suggestions, chips, confirmation cards, receipts and generated work results.
- Do not introduce dropdown-heavy flows, rigid forms or parallel service navigation when the agent can ask for the missing information naturally.
- Voice and text must be equally valid entry methods.
- Language is dynamic from the user's current speaking/writing pattern; do not expose a hard-coded language preference.
- Preserve the established Home/Rooms presentation unless a separate product instruction explicitly changes it.

## Home / Rooms

Purpose: entry and orientation, not a dashboard redesign.

- Preserve the known-good Home/Rooms visual structure.
- Rooms are presentation/entry contexts over canonical skills and runtime.
- Tapping a service Room should normally enter the relevant conversation context.
- Do not reorder, rename, compress or restyle unrelated Rooms as a side effect of work on Chat or Internet Cafe.

## Chat

Reference: WhatsApp density and familiarity.

Composer:
- one rounded input surface;
- emoji control at the left;
- flexible text field in the center;
- one attachment control at the right of the field;
- microphone/send action outside the field on the far right;
- no dedicated camera button competing for composer width;
- attachment opens Camera, Gallery, Document and Video choices;
- no nested/double TextField border.

Messages:
- text and voice use the same durable conversation/session lifecycle;
- failed/stale sessions should recover transparently once before surfacing failure;
- service results, receipts and generated files remain inline.

## Internet Cafe

Internet Cafe is a **chat mode**, not a billing app.

Initial state:
- short prompt: “What would you like to do?”
- horizontal, reselectable category suggestions: Data, Airtime, Electricity, TV;
- user may ignore all suggestions and simply type or speak.

After a category is tapped:
- send the category as ordinary conversational intent;
- keep all category choices visible;
- show the selected category only as lightweight context;
- explicitly make changing the category easy;
- agent asks only for missing required details;
- when one message already contains all required details, do not ask again;
- wallet/balance/funding prompts and the final purchase result remain in the conversation.

Never add service dropdown trees to this chat.

## Explore

Explore is discovery, not a directory.

Primary experience:
- prominent current Twin match;
- rotating/cycled Twin rail;
- “Spin for another Twin” interaction;
- direct “Chat now” action;
- favorite/heart control;
- high-energy matching feel inspired by live/random matching products without copying their social mechanics.

Secondary:
- search is available behind a search action;
- do not show configured language labels because language is dynamic.

Future persistence:
- favorites should be backed by the canonical account once the backend contract is added; local-only UI state is temporary.

## My Twin

- empty state leads to creation.
- creation asks only physical basics (gender, age, image), then opens Gwani.
- Gwani conducts the short voice-first behavioral interview.
- no language picker.
- normal Twin management should prefer “talk to/teach my Twin” over form-heavy configuration.
- integrate the approved Twin-creation runtime without replacing the redesigned chat composer wholesale.

## Activity

- chronological, simple, actionable.
- owner requests and work needing attention should be obvious.
- open the relevant conversation/task rather than duplicating full workflows inside Activity.

## Wallet

- Wallet may show balances and history.
- operations should be conversational whenever possible.
- funding, transfer, billing and crypto should lead into agent-assisted chat flows rather than separate mini-app UX.
- show confirmations and receipts inline in chat.

## Settings

- only durable account/app controls.
- no service launcher grid.
- do not expose internal runtime/provider terminology.

## Story Radio / News / other Rooms

- retain their focused consumption views where needed.
- entry, discovery and follow-up can still be conversational.
- do not force every content playback screen into chat, but do keep chat available for actions/questions.

## Change-isolation rule

A task scoped to one screen must not redesign another screen unless the product instruction explicitly says so. Theme/token changes must be reviewed separately because they affect every screen.
