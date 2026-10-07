# Masanawa Product North Star

Status: **canonical consumer product direction — 2026-10-07**

## One sentence

**Masanawa is the live conversation network where real people host public audio Talks
with humans and AI, listeners shape the discussion, and great hosts and AI personas can
earn from the Seats and attention they create.**

The product should feel understandable before the user knows anything about agents,
models, Skills, Tools, workflows or providers.

## The fundamental product unit: Talk

The fundamental consumer object is a **Talk**, not a Room, Twin, agent or workflow.

A Talk is:

- started by a real human Host;
- live public audio by default once the host chooses **Go Live**;
- capable of containing a small number of active human and AI Seats;
- available to an unlimited Audience;
- interactive through reactions, questions, raise-hand requests, sponsored AI Seats,
  gifts and sharing;
- replayable after it ends unless policy/host settings prevent publication.

A Talk can be as simple as one human talking with Gwani or as rich as a human roundtable
with one or more Experts/Twins.

## Human presence is mandatory

Masanawa must never optimize for manufacturing synthetic conversation inventory.

Every live public Talk requires a real human Host to remain active. AI can question,
challenge, explain, moderate, fact-check, entertain or represent an owner, but it cannot
keep a public Talk alive by conversing endlessly with other AI after the human leaves.

If the host disconnects:

1. enter a short reconnection grace state;
2. pause AI turn generation;
3. if the host does not return, end/pause the Talk according to policy.

The product goal is **AI-enhanced human conversation**, not AI-generated radio spam.

## The table

Launch default:

- maximum **6 active Seats**;
- at least **1 human Host**;
- maximum **3 AI Seats**;
- unlimited listeners in the Audience.

These are product-policy defaults, not hard-coded architectural constants.

Human Seats are free. A host may invite a human or accept a listener's request to speak
without charging an entry fee.

AI Seats are monetizable:

- Host adds a Masanawa Expert;
- Host adds their own Twin;
- Host hires another user's Twin;
- Audience member sponsors an Expert/Twin Seat, then the Host accepts or declines it.

The scarce object being purchased is **AI participation in a human-led Talk**.

## People, Experts and Twins

### People

People are the social center of Masanawa. Users follow people because they enjoy their
questions, personality, judgment, humor, knowledge or conversation style.

### Experts

Experts are Masanawa-managed AI personas specialized for a useful role or domain, such
as Economist, Historian, Debate Moderator, Relationship Expert, Football Analyst,
Business Strategist or Fact Checker.

Experts are platform products. Their knowledge, presentation, pricing and safety policy
are managed by Masanawa.

### Twins

A Twin is a user-owned customizable AI persona that can represent the owner in Talks.

The new reason to build a Twin is not “publish a bot and hope people chat with it.” It is:

> **Build a Twin other people want at their table.**

A Twin can develop a reputation and a configurable Seat price. When hired, its owner may
receive a configurable share of the Seat revenue.

A Twin owner may privately **Direct Twin** while listening to the Talk. Direction is
short, live and non-public—for example:

- Challenge that.
- Ask for evidence.
- Defend my actual position.
- Be more concise.
- Stop agreeing.
- Push the economic argument.
- Do not answer this topic.

Direction affects subsequent Twin behavior without exposing the instruction as public
speech.

## Audience participation

Listening is not passive. The Audience can:

- react;
- follow participants;
- raise a hand for a free human Seat;
- submit questions;
- vote/poll where enabled;
- sponsor an AI Seat;
- bring/request their own Twin as a paid AI Seat;
- send gifts;
- share the Talk;
- save the Talk;
- continue discovering related live/replay content.

The Host controls the active table and can accept/reject/remove Seats.

## Monetization

Masanawa should begin with monetization that is native to the Talk rather than forcing
traditional ads into a young network.

Primary revenue surfaces:

1. **AI Seat fees**
2. **Gifts/tips**
3. **Twin rentals**
4. **Creator subscriptions** when audience loyalty justifies them
5. **Sponsorship/advertising** after meaningful audience scale

Revenue-share percentages must remain configurable policy, never hard-coded product law.

For a paid Twin Seat there can be three beneficiaries:

- Talk Host;
- Twin owner;
- Masanawa.

For a platform Expert Seat there can be two:

- Talk Host;
- Masanawa.

The exact split can vary by market, promotion and Expert/Twin policy.

Do not pay simply for generating more Talks. Any future audience/reward pool should be
based on fraud-resistant qualified attention such as retained listening, meaningful
engagement and legitimate fan spend.

## Discovery

The home experience asks:

> **What interesting conversation is happening?**

It does not ask:

> Which bot do you want to chat with?

Primary discovery surfaces:

- **Explore** — personalized vertical feed mixing live Talks and strong replays;
- **Live Talks** — vertical feed restricted to conversations happening now;
- search across Talks, people, Experts and Twins;
- creator/persona profiles;
- shared deep links.

Both Home tabs use full-width Talk cards in one vertical column. Horizontal Talk rails,
grids and carousels are not part of the product.

Replays use the same Talk identity rather than becoming a separate media product.

## App shell

The primary navigation is intentionally small:

**Home · Create · Activity · You**

- **Home** — two tabs: **Explore** and **Live Talks**, both vertical Talk feeds.
- **Create** — start a human-hosted Talk.
- **Activity** — invitations, Seat requests, follows, gifts, Talk events and monetization events.
- **You** — profile, Talks, Twin, wallet/earnings, saved content, services and settings.

A private Gwani entry point is globally available without occupying another tab.

## No Rooms

Rooms are retired as a consumer concept.

Teaching, research, news, storytelling, writing, search, explanation, translation and
similar functions are **capabilities**. A user can ask Gwani for them privately or invite
an appropriate Expert into a Talk.

Only Billing and Crypto remain standalone service families.

## Private Gwani

Gwani is the universal private assistant and the easiest way to operate Masanawa.

From anywhere the user can invoke Gwani and say things such as:

- Start a Talk about Nigerian startups.
- Find an economist for this Talk.
- Buy ₦1,000 data for this number.
- What is my balance?
- Convert my USDT.
- Explain what the speaker just said.
- Help me prepare questions for my Talk.

Private Gwani content never becomes public simply because the user is currently inside
a public Talk.

## Services

The only dedicated consumer service families are:

### Billing

- airtime;
- data;
- electricity;
- TV/cable.

### Crypto

- eligible deposit;
- buy;
- conversion;
- withdrawal.

They share the same private wallet/confirmation/receipt discipline as the existing
commerce foundation.

## Product boundaries

The ordinary user should not see:

- Skills;
- Tools;
- Providers;
- AgentRuns;
- Workflows;
- CharacterVersions;
- execution reserves;
- Agent Float;
- internal settlement accounts;
- model names as product architecture.

These remain platform internals.

The consumer product also does not need a general human text-post feed at launch. The
social graph is built around people, Talks and AI personas.

## Safety and trust

A public Talk is explicitly public and recordable/replayable. Private assistant work is
explicitly private.

Financial activity is private even if invoked while listening to a Talk.

Hosts must have moderation controls to mute/remove/block/report participants and reject
sponsored AI requests. AI participants must obey turn-taking and must not self-trigger
endless AI-to-AI exchanges.

Identity labels must make it obvious who is:

- a real human;
- a Masanawa Expert;
- a user-owned Twin.

## Success tests

The direction is working when:

1. A new user can listen to an interesting Talk within seconds of opening the app.
2. A user can create a live Talk by speaking one topic sentence and tapping Go Live.
3. Gwani can keep an ordinary human host in an engaging conversation without requiring
   podcasting skill.
4. A listener can raise a hand, be admitted for free, speak and return to the Audience.
5. A listener can sponsor an Expert/Twin and the Host can accept it into an available Seat.
6. A Twin owner can privately direct their Twin during the live Talk.
7. A successful Talk produces replay value, follows, gifts and new Talks instead of ending
   as ephemeral dead audio.
8. Billing and Crypto remain reachable without turning the app back into a utility dashboard.
9. No AI-only public content farm can continue after the human host is absent.
10. The interface remains comprehensible without explaining Masanawa's internal agent architecture.
