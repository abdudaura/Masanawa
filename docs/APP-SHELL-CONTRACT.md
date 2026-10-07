# App Shell Contract

Status: **canonical consumer shell — 2026-10-07**

## Primary navigation

The consumer app has five primary destinations:

- **For You**
- **Live**
- **Create**
- **Activity**
- **You**

No sixth primary destination should be added without explicit product approval.

Create is a prominent center action that opens the Talk composer. It does not need to
behave like a normal persistent tab.

## Surface responsibilities

### For You
Personalized discovery of Live Talks and strong replays.

### Live
Intentional browsing of conversations happening now, with compact topic/following filters.

### Create
Start a human-hosted public Talk with a spoken or typed topic and optional participants.

### Activity
Unified social/Talk/money events: invitations, Seat requests, follows, gifts, sponsored
AI requests, Twin hires and creator-earning events.

### You
Profile, My Talks, My Twin, Saved, Wallet/Earnings, Services and Settings.

## Global private Gwani

A private Gwani affordance is available throughout the ordinary shell.

It opens as a sheet and can expand when a longer private conversation is needed.

Gwani can:
- operate the app;
- prepare/start Talks;
- find Experts/Twins;
- perform non-financial AI capabilities;
- initiate private Billing/Crypto flows.

The current public Talk must remain audible/returnable when a lightweight private Gwani
sheet is used, unless device/audio constraints require pausing playback.

## Talk route

The Talk screen is immersive and may temporarily hide the ordinary bottom navigation.

One Talk route adapts to:
- listener;
- Host;
- human Speaker;
- Twin Director;
- replay listener.

Do not create separate Host Room / Audience Room / Speaker Room products.

## No Rooms

The shell must not expose:
- Internet Cafe;
- Study Room;
- Story Radio;
- News Room;
- Research Room;
- Work Room;
- Teaching Room.

Their useful capabilities survive through Gwani/Experts/Talks.

## Services

A Services entry may exist under You and Wallet, but it contains only:
- Bills
- Crypto

## Visual simplicity

Shell rules:
- compact app bars;
- minimal explanatory copy;
- no oversized feature cards;
- use familiar icons plus short labels;
- avoid nested dashboard grids;
- prefer lists/chips/sheets;
- show only the primary action for the current context;
- empty/error/loading are states of a screen, not separate destinations.

## Suggested routes

- `/for-you`
- `/live`
- `/talk/create`
- `/talk/:talkId`
- `/activity`
- `/you`
- `/u/:handle`
- `/persona/:publicId`
- `/twin`
- `/wallet`
- `/services`
- `/services/bills`
- `/services/crypto`
- `/settings`

See `MOBILE-SCREEN-ARCHITECTURE.md` for the full inventory.
