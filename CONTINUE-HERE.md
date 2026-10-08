# Continue Here

## Current improvement sequence — 2026-10-08

The Talk product direction remains locked. The user's latest mobile acceptance exposed
unavailable audio/personas and inactive participant actions; the current work is to
complete integration, not redesign the shell or restart merged foundations.

Read the canonical documents below, then **docs/MOBILE-READINESS-PLAN.md** and
**docs/DEFAULT-AI-PERSONAS.md**. Their 2026-10-08 requirements supersede older dark-theme,
Nigeria-only wallet, limited-language and blanket no-AI-event-context assumptions.
Dated workstream reports record implementation history, not full release acceptance.

First implement a WhatsApp-style white default with vibrant green (R01), then resolve
live audio/persona readiness and participant wiring (R02–R04). Billing recovery/global
wallet and qualified Billing/Crypto (R05–R08) are equal core priorities. Finish AI event
awareness, animated gifts, localization, deletion, replay/push and release gates (R09–R16).
The ledger contains exact evidence, dependencies and acceptance; tasks remain open.

Wallet, Billing and Crypto now follow `docs/VOICE-FIRST-INTERACTIONS.md`: a private
voice-first conversation with interactive cards, complete text/tap alternatives and
one durable server-authorized task. Conventional forms are optional editing mode.
Low-literacy users must complete supported journeys without reading or typing.


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
- `docs/MOBILE-READINESS-PLAN.md`
- `docs/DEFAULT-AI-PERSONAS.md`
- `docs/VOICE-FIRST-INTERACTIONS.md`

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


- Default visual experience is white/light with vibrant WhatsApp-style green; no automatic
  OS-dark fallback. Keep the approved Masanawa logo and compact familiar controls.
- Masanawa is global: language, user locale, country and currency are separate concerns.
  Service availability is exact provider/account/market qualification, not a blanket promise.
- Every visible action is connected or explains an actual capability restriction; no inert
  Add Expert, Invite person, Add My Twin, wallet or transaction controls.
- AI personas receive authorized Talk/stage/event context and never private financial data.
- Account deletion is a durable in-app and external request workflow, not merely logout.

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

`main` is the **only** canonical product branch for local pulls, APK builds, deployment
qualification and product continuation. Work branches are temporary implementation lanes:
they are never a second source of truth and completed work must merge back to `main`.

For a normal local update, use `git checkout main` followed by `git pull origin main`.
Do not pull, merge or build from old `work/*`, `ci/*`, `phase*`, `docs/*` or archived
branches unless a current active workstream explicitly requires repository recovery.

Open PRs from product directions that predate the 2026-10-07 Talk reset are archival and
must be closed rather than treated as pending product work. Historical branches may remain
only to preserve recoverable commits; their existence does not make them canonical.

Read `docs/MULTI-WINDOW-WORK.md` before editing. A workstream claim expires after
5 minutes without repository-visible work. Preserve useful work from stale branches, but
stale ownership itself is not a blocker.

Dated files under `docs/workstreams/` are implementation history. They do not override
the current product documents listed above.

## Immediate product sequence

Follow R01–R16 in `docs/MOBILE-READINESS-PLAN.md`. Preserve the implemented shell,
vertical discovery, Talk persistence, audio/AI dispatch, social/safety, commerce and
provider foundations. A merged feature or registered worker is not end-to-end acceptance.
Claim one non-overlapping task and record implemented/tested/deployed/device states separately.
The next concrete implementation is R01 shared light theme; R02 must diagnose the user's
actual Audio unavailable failure, and R03 must qualify an available default persona.
