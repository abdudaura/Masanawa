# App Shell Contract

Status: **canonical consumer shell — 2026-10-08**

## Primary navigation

The consumer app has exactly four root destinations:

- **Home**
- **Create**
- **Activity**
- **You**

No fifth root destination should be added without explicit product approval.

## Home

Home contains exactly two primary tabs:

1. **Explore** — personalized discovery of Live Talks and strong replays.
2. **Live Talks** — conversations happening now.

Both tabs use the same discovery rule:

> **one full-width Talk card after another in a vertical scroll.**

Do not use horizontal content rails, horizontal card grids, sideways carousels or a directory-style home. Topic filters may be compact horizontal chips, but the actual Talk content remains a vertical list.

The discovery rhythm should feel closer to TikTok than to a dashboard: the user keeps moving down into the next conversation.

## Create

Create starts a human-hosted public Talk with a spoken or typed topic and optional participants.

## Activity

Unified social/Talk/money events: invitations, Seat requests, follows, gifts, sponsored AI requests, Twin hires and creator-earning events.

## You

Profile, My Talks, My Twin, Saved Talks, Wallet/Earnings, Billing, Crypto and Settings.

Wallet is not a root tab.

## Global private Gwani

A private Gwani affordance is available throughout the ordinary shell without occupying a root tab.

Gwani can operate the app, prepare Talks, find Experts/Twins, perform general AI capabilities and initiate private Billing/Crypto flows.

## Talk route

The Talk screen is immersive and may hide root navigation. One Talk route adapts to listener, Host, human Speaker, Twin Director and replay roles.

A public **Comments** section is part of the Talk experience. It is visible beneath/alongside the live stage without replacing the live audio experience. Comments are not automatically AI speech. Relevant moderated public comments may
enter bounded AI context as untrusted data; private assistant chats never do.

## No Rooms

The shell must not expose Internet Cafe, Study Room, Story Radio, News Room, Research Room, Work Room or Teaching Room. Their useful capabilities survive through Gwani/Experts/Talks.

## Services

Only Bills and Crypto are standalone service families, reached from You/Wallet or private Gwani.

## Visual simplicity

- compact app bars;
- minimal explanatory copy;
- no oversized dashboard grids;
- no horizontal Talk card rails;
- familiar icons plus short labels;
- sheets for secondary actions;
- loading/error/empty are states, not destinations.

## Current visual and integration acceptance

Default surfaces are white/light with vibrant WhatsApp-style green, including sheets,
auth, Talk, wallet/services and system bars; no automatic dark-background fallback.
Preserve the approved Masanawa logo. Localized text/RTL must fit the same compact shell.

Every visible action must work or present an actual eligibility/recovery state. Create's
Add Expert, Invite person and Add My Twin, Talk audience/Host controls and global wallet
actions are release contracts, not decorative rows. Persona catalog/readiness, audio,
event-aware AI, animated gifts, global wallet/languages, deletion and financial recovery
follow `MOBILE-READINESS-PLAN.md` and `DEFAULT-AI-PERSONAS.md`.

Account deletion, language, privacy and support belong in existing Settings. Do not add
root tabs, service families or duplicate screen trees to implement these requirements.

## Suggested routes

- `/home`
- `/talk/create`
- `/talk/:talkId`
- `/activity`
- `/you`
- `/u/:handle`
- `/persona/:publicId`
- `/my-twin`
- `/wallet`
- `/billing`
- `/crypto`
- `/settings`

See `MOBILE-SCREEN-ARCHITECTURE.md` for the full inventory.
