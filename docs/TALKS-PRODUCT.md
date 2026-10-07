# Talks Product Contract

Status: **canonical product behavior — 2026-10-08**

This document defines the user-facing behavior of Masanawa Talks. It is a product
contract, not a low-level API schema.

## 1. Talk lifecycle

A Talk has four user-visible lifecycle states:

1. **Draft** — host is choosing topic/title/participants.
2. **Live** — human host is present and public audio is active.
3. **Paused/Reconnecting** — host connection is temporarily lost; AI generation stops.
4. **Ended** — live participation is closed; replay may remain discoverable.

A replay is the ended Talk, not a second content object.

## 2. Human-host requirement

A Talk cannot enter or remain Live without a verified human Host session.

AI participants must stop initiating new public turns while the Host is absent.
A bounded reconnection grace period may preserve the Talk state, but after the grace
period the Talk ends or pauses for explicit host return.

No background job, Twin, Expert or scheduler may silently become the Host.

## 3. Seats

Launch default policy:

- 6 total active Seats;
- 1 Seat reserved for the human Host;
- up to 5 additional active participants;
- no more than 3 AI participants at once;
- Audience capacity is independent from Seat capacity.

### Seat types

**Host Seat**
- always human;
- required;
- owns Talk moderation.

**Human Speaker Seat**
- free;
- invited by Host or admitted from Raise Hand;
- may leave/return to Audience.

**Platform Expert Seat**
- AI;
- priced by Masanawa policy;
- Host may purchase/add directly;
- Audience may sponsor, requiring Host acceptance.

**Twin Seat**
- AI owned by a Masanawa user;
- Seat price is subject to platform floors/caps and owner settings;
- Host may hire it;
- Audience may sponsor it;
- owner may receive revenue share.

The Talk must clearly label Human / Expert / Twin.

## 4. Seat fee and sponsorship

Use the term **Seat fee** for the price of AI participation.

Use **Sponsor seat** when an Audience member pays to request an AI participant.

Sponsor flow:

1. listener chooses Expert/Twin;
2. sees exact Seat fee and available Talk capacity;
3. confirms payment/hold;
4. Host receives “Sponsor wants to add X” request;
5. Host accepts or declines;
6. accepted participant enters when capacity exists;
7. declined/expired requests release/refund according to Commerce policy.

A payment does not override Host moderation.

## 5. Human participation is free

A person speaking as themselves never needs to pay an entry fee to request/join a human
Speaker Seat.

This encourages real human presence and prevents Masanawa from becoming “pay to speak.”

Hosts can still restrict who they admit for safety, relevance and quality.

## 6. Platform Experts

Experts are Masanawa-managed specialist AI personas.

They can be found contextually from:

- Create Talk participant picker;
- Add AI inside a live Talk;
- global search;
- Gwani suggestions.

An Expert profile should communicate only what listeners/hosts need:

- name;
- short role;
- verified Masanawa badge;
- topics/strengths;
- voice/presentation;
- current Seat fee;
- recent Talk appearances/reputation where useful.

Do not expose model/provider/Skill internals.

The launch roster and full runtime profiles are in `DEFAULT-AI-PERSONAS.md`. Catalog,
Create/Add AI, public profile/search and audio worker must resolve the same canonical
persona. Visibility is not proof of readiness; give clear unavailable/retry states.

## 7. Twins

A Twin is a user's own AI persona.

A Twin can have:

- name/photo/voice;
- short identity description;
- interests/expertise/opinions;
- behavioral boundaries;
- configurable Seat price;
- availability;
- public appearance history;
- earnings/reputation metrics.

A Twin cannot autonomously start a public Talk.

### Direct Twin

When the owner's Twin is in a Talk, the owner can open a private **Direct Twin** control.

Fast actions:

- Challenge
- Agree
- Ask for evidence
- Clarify
- Be concise
- Be tougher
- Be respectful
- Stay quiet

The owner can also speak/type a private instruction.

Directions are ephemeral control input unless explicit product policy stores them; they
are not shown to the public and are not treated as public statements themselves.

## 8. AI turn behavior

AI participants should behave like good panelists, not continuous generators.

Default rules:

- respond to a human turn, explicit host prompt, direct question or approved Director input;
- do not create endless AI-to-AI turn chains;
- yield to human speech/barge-in;
- keep most responses conversational rather than essay-like;
- distinguish evidence, opinion and uncertainty;
- respect Host moderation and Talk-level topic/safety policy;
- stop when removed from the Seat.

The Host may select simple Talk tone controls such as Balanced, Debate, Interview,
Ask an Expert or Casual, but these are templates—not separate Rooms/products.

## 9. Audience controls

Audience controls should remain compact:

- React
- Comment
- Raise hand
- Ask
- Add AI
- Gift
- Share

Secondary actions can live behind “More”:

- Follow
- Save
- Report
- Block/mute
- View participants

Comments belong to the Talk itself and remain available during Live and Replay. They
are not automatically spoken. Relevant moderated public comments may enter bounded AI
context as untrusted data under the current event policy; private chats never do.
Do not put every capability on the main live screen.

## 10. Host controls

Host controls:

- mute/unmute self;
- invite human;
- accept/decline Raise Hand;
- add Expert/Twin;
- approve/decline sponsored AI;
- mute/remove a Speaker;
- remove AI;
- block/report;
- change simple Talk metadata;
- end Talk.

Advanced moderation belongs in sheets, not persistent chrome.

## 11. Talk discovery metadata

Minimum discoverable Talk card:

- Live/replay state;
- title/topic;
- Host identity;
- small participant preview;
- listener count for Live or plays/listening indicator for replay;
- elapsed/duration;
- one clear Listen action.

Avoid paragraph descriptions and oversized cards.

## 12. Monetization

Launch-priority:

1. AI Seat fees
2. Gifts

Later:

3. Creator subscriptions
4. Sponsorship/advertising
5. Qualified-attention creator pool

A paid AI Seat can allocate revenue among Host, Twin owner (when applicable) and Masanawa.
All percentages are server-configurable policy.

Do not create earnings merely because a Talk exists. Earnings require real economic or
qualified audience events.

## 13. Replay and sharing

When a Talk ends:

- create a replay if publication policy permits;
- preserve participant labels and host;
- generate a concise title/summary suggestion when useful;
- allow Host to edit metadata;
- allow sharing by deep link;
- later allow automatically generated highlights/clips without making video creation a
  prerequisite for the Talk product.

## 14. Moderation and safety

The Host has immediate local moderation authority over the table.

Platform safety still has higher authority for policy violations.

Important states:

- reported Talk;
- muted/removed participant;
- blocked user;
- AI participant disabled/unavailable;
- host disconnected;
- Talk ended by Host;
- Talk ended by platform enforcement.

These are states/sheets, not separate navigation destinations.

## 15. Anti-spam rule

The ranking system must not reward:

- AI count;
- number of generated turns;
- number of created Talks without listeners;
- repetitive synthetic audio.

Prefer fraud-resistant human/audience signals such as retained listening, follows,
meaningful reactions, gifts, repeat listeners and legitimate Seat purchases.

## 16. Complete action and audio contracts

Create's Add Expert, Invite person and Add My Twin must open real selectors/invitation
flows and preserve the draft. AI selection requires a fresh explicit Seat quote at
admission, not a charge for opening a picker. Human invitations are free. No Twin opens
creation and returns to the draft. Live controls reconcile canonical request/Seat state.

A created live Talk must give the Human Host microphone publication and listeners usable
playback, with connecting/muted/reconnecting/permission/failure states and recovery.
Host audio does not depend on an AI Seat. Selected/admitted AI must actually join and
respond; worker registration or an empty picker does not satisfy this contract.

## 17. Participation context and gifts

AI Seats know Masanawa, their identity/role, Talk topic/lifecycle, real Host, active stage,
current addressed speaker and permitted recent events. React, Raise hand, Ask, Add AI,
Invite, Gift, Poll and relevant moderated public comments reach a bounded, authorized,
ordered/deduped context adapter. Only confirmed money events represent completed gifts.
No event grants stage authority or causes an inference request on every tap. Private
financial/assistant data and Direct Twin input for another persona are excluded.

Gift uses a server catalog and fresh exact price, explicit confirmation, canonical
idempotent settlement and synchronized short stage/receipt animations. Provide low-end
and reduced-motion fallback; avoid blocking controls, audio interruptions or false thanks.
See R09/R10 in `MOBILE-READINESS-PLAN.md` for event semantics and acceptance.
