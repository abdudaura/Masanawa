# Golden Journeys

> **2026-10-08 whole-platform acceptance extension:** This file's original GJ-01–GJ-17 Talk/service journeys remain valid. The owner's later **five-tab Talks · Chats · Assistant · Wallet · Agents** requirements, one switchable Gwani/Gwana Assistant chat, human private DMs/voice notes/cache, internal crypto transfer, camera-free creator entry and low-literacy full voice/text parity are traced in `OWNER-REQUIREMENTS-TRACEABILITY-20261008.md` and tested across destinations by `WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md` **J01–J11**. Read those before treating the historical 17 journeys as comprehensive; no implementation/device success is implied.


Status: **canonical consumer acceptance journeys — 2026-10-07**

These journeys define the experiences the product must ultimately make reliable.

## GJ-01 — Listen immediately

A signed-in user opens For You, sees an interesting Live Talk, taps once and hears audio
within a short bounded join time. They can follow the Host without understanding agents.

## GJ-02 — Start a Talk in one sentence

The user taps Create, says “I want to discuss whether university is still worth it,”
accepts/edits the suggested title and taps Go Live. Gwani can join as the initial AI
participant if the user chooses.

## GJ-03 — Human joins for free

A listener taps Raise Hand. The Host accepts. The listener becomes a human Speaker without
paying, speaks, then returns to the Audience.

## GJ-04 — Host hires an Expert

The Host taps Add AI, finds an Economist, sees the exact Seat fee, confirms, and the
Expert joins an available AI Seat. The Talk continues with correct turn-taking.

## GJ-05 — Audience sponsors an Expert

A listener selects Add AI -> Fact Checker, confirms the Seat fee, and sends a sponsorship
request. The Host accepts. The Expert joins. If declined/expired, the hold/refund is
resolved deterministically.

## GJ-06 — Hire and direct a Twin

A Host/audience member brings another user's Twin into a paid Seat. The Twin owner receives
the appropriate private notification and can Direct Twin with a short instruction. The
instruction is not publicly exposed, but the Twin's next turn reflects it within policy.

## GJ-07 — Human host disappears

The Host loses connectivity. The Talk enters Reconnecting and AI stops initiating new
public turns. The Host returns within grace and resumes, or the Talk ends cleanly.

## GJ-08 — End and replay

The Host ends the Talk. A summary shows audience/earnings. The Talk becomes a replay with
the same identity and can be shared. A listener later opens the deep link and plays it.

## GJ-09 — Creator earns

A Talk receives gifts and paid AI Seats. Host/Twin-owner/platform settlement follows
configurable policy and appears in Wallet/Earnings without exposing internal ledger
machinery.

## GJ-10 — Build a Twin worth hiring

A user creates/configures a Twin through a short voice-led process, sets allowed Seat
pricing/availability, previews it privately and publishes it. Another user can find its
persona profile and hire it into a Talk.

## GJ-11 — Private Gwani during public listening

While listening to a Talk, the user opens private Gwani and asks for an explanation or
help preparing a question. No private prompt/result is broadcast into the Talk.

## GJ-12 — Buy a bill privately

The user says “Buy ₦1,000 data for 070…” to Gwani. Only missing details are requested.
A server-derived quote is confirmed once, the purchase reconciles correctly, and a
receipt is returned privately.

## GJ-13 — Crypto safely

The user opens Crypto or asks Gwani, chooses an eligible asset/network operation, sees
minimums/fees/expiry, confirms once, and receives a durable status/receipt. An ambiguous
provider outcome remains checking until reconciled instead of double-sending.

## GJ-14 — Moderate a Talk

The Host can mute/remove/block a disruptive human or remove an AI participant quickly.
A listener can report the Talk/persona without leaving the audio experience unnecessarily.

## GJ-15 — Discover through people, not bots

A listener follows a Host after a strong Talk, then sees that creator's future Live Talks
and replays. Persona discovery is contextual; the app home does not become a bot directory.

## GJ-16 — Dynamic language

A user speaks Hausa to Gwani/Expert and receives Hausa; later switches to English and the
AI switches naturally without a hard-coded language profile blocking the change.

## GJ-17 — Failure stays friendly

Network/provider failures never render raw framework exceptions. Retry/reconnect preserves
identity and does not duplicate Talk Seats, gifts, bill purchases or crypto operations.
