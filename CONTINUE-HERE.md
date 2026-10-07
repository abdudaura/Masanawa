# Continue Here

## Canonical product reset — 2026-10-07

Masanawa is now a **human-hosted live AI conversation network**.

The ordinary-user product is no longer Twin-first, Room-first, or a directory of AI agents.
The fundamental public object is a **Talk**: a real human host starts a live public audio
conversation and may bring human speakers, Masanawa Experts, or user-owned Twins into a
small number of active Seats while an unlimited audience listens and participates.

Read these first for any consumer-product work:

- `docs/PRODUCT-NORTH-STAR.md`
- `docs/TALKS-PRODUCT.md`
- `docs/MOBILE-SCREEN-ARCHITECTURE.md`
- `docs/CONSUMER-SERVICES.md`
- `docs/APP-SHELL-CONTRACT.md`
- `docs/MULTI-WINDOW-WORK.md`

### Non-negotiable consumer rules

- Every public live Talk has at least one **real human host actively present**.
- AI-only autonomous public Talks are forbidden. If the human host leaves beyond the
  reconnection grace period, the Talk pauses/ends rather than becoming synthetic filler.
- Human participation is free. Hosts decide who receives human speaker Seats.
- AI participation uses paid **AI Seats**. The host can add an Expert/Twin, or an audience
  member can sponsor an AI Seat subject to host acceptance and capacity.
- Launch default is **6 active Seats maximum**, with at most **3 AI Seats**. Policy may
  tune these limits later, but scarcity and human presence are deliberate product rules.
- Platform **Experts** are Masanawa-managed specialist AI personas.
- A user's **Twin** is an owned, customizable AI persona that can be hired into Talks.
  Twins are not autonomous content farms and are no longer the app's top-level identity.
- A Twin owner can privately **Direct Twin** during a Talk with short instructions such
  as challenge, ask for evidence, defend a position, be concise, or emphasize a point.
- There are no consumer **Rooms**. Teaching, research, news, storytelling, search,
  writing and similar AI abilities are capabilities consumed inside Talks or through
  the private Gwani assistant.
- The only standalone consumer service families are **Billing** and **Crypto**.
- Financial actions are always private, confirmed and server-authorized. They never leak
  into the public Talk transcript/audio simply because the user invokes Gwani.
- Private assistant conversations and public Talks are explicitly separate modes.
- The primary mobile shell is **Home · Create · Activity · You**. Home contains two tabs: **Explore** and **Live Talks**.
- A private Gwani entry point is globally reachable without creating another top-level tab.
- Simplicity is a product requirement: prefer one adaptive screen plus sheets/states over
  several nearly identical screens.

### Product language

Use these user-facing terms consistently:

- **Talk** — public live/replayable conversation
- **Host** — real human who starts and remains responsible for the Talk
- **Seat** — active speaking participant position
- **Audience** — listeners who are not currently speaking
- **Expert** — Masanawa-managed specialist AI
- **Twin** — user-owned customizable AI persona
- **Seat fee** — price to place an AI persona in a Talk
- **Sponsor seat** — audience member pays for an AI persona and asks the host to admit it
- **Direct Twin** — private live instructions from the Twin owner to their Twin

Do not reintroduce Clone, Agent Float, CharacterVersion, Skill graphs, Workflow internals,
provider internals, or execution reserves as ordinary-user concepts.

## Services

Only these families receive dedicated consumer flows:

1. **Billing** — airtime, data, electricity and TV/cable fulfillment through Flutterwave
   where live account/provider qualification supports the exact operation.
2. **Crypto** — eligible deposits, buys, conversions and withdrawals through NOWPayments,
   with asset/network/operation eligibility checked dynamically and expensive Ethereum
   mainnet ERC-20 routes excluded by policy.

Everything else is an AI capability, not a service section.

## Technical continuity

This product reset does **not** discard the validated identity, memory, runtime, Skill,
Tool, Provider, channel, commerce, security, ledger, recovery or audit foundations.
Those remain internal platform architecture and should be reused behind the simpler
consumer model.

WhatsApp and Telegram remain important channels for private Masanawa assistance and
account-linked experiences, but the public Talk network is designed primarily around the
Masanawa app where live audience/Seat controls can be represented correctly.

## Canonical branch and parallel-work rules

`main` is the only canonical product branch for local pulls/builds. Work branches are
temporary implementation lanes and must merge back to `main`.

Read `docs/MULTI-WINDOW-WORK.md` before editing. A workstream claim expires after
5 minutes without repository-visible work. Preserve useful work from stale branches, but
stale ownership itself is not a blocker.

Dated files under `docs/workstreams/` are implementation history. They do not override
the current product documents listed above.

## Immediate product sequence

1. Keep documentation consistent with this reset.
2. Keep Home discovery single-column and vertical: **never horizontal Talk rails, grids or carousels**.
3. Implement the approved **Home · Create · Activity · You** shell and Talk experience incrementally.
4. Build durable Talk persistence/live-audio behind the mobile contracts without deleting reusable
   Billing, Crypto, Twin identity, voice, channel or agent-runtime foundations.
