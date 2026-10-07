# Talk Activity mobile implementation — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-activity-mobile-20261007`
Base: `3e1e6be3b19b36c15ed3e9d8caf395481c3ce0eb`

## Scope

Replace the old Twin-era root Activity screen with the new Talk-network Activity experience.

Owned paths:
- `apps/mobile/lib/src/screens/activity/*`
- new mobile activity models/transport/provider files;
- shell wiring needed only to open Talk targets from Activity;
- focused mobile tests;
- this workstream handoff.

Not owned:
- Gateway persistence/routes;
- push delivery;
- Commerce ledger;
- shared migrations;
- production deployment.

## Product rules

Activity is one chronological stream with compact filters:
- All
- Talks
- Money
- Social

It may include:
- Talk invitations;
- Raise Hand/Seat outcomes;
- sponsored AI Seat requests/results;
- follows;
- gifts;
- Twin hires;
- creator earnings;
- replay milestones;
- platform notices.

Do not rebuild separate notification/creator dashboards.

Status: active.


## Implementation checkpoint

Implemented:
- new Talk Activity projection with explicit event kinds;
- one chronological Activity screen;
- compact **All · Talks · Money · Social** filters;
- Talk invitations / Seat outcomes / sponsored AI / follows / gifts / Twin hire /
  earnings / replay / platform event presentation;
- amount labels for money events without exposing ledger internals;
- unread and requires-action presentation;
- Talk-target events open the related Talk from the root shell;
- raw transport failures remain hidden behind a friendly state;
- Activity remains lazy: no Activity request is started until the root tab is visited;
- old Twin performance cards and private chat-history list are removed from root Activity;
- focused screen/model/shell tests.

## Mobile-facing backend contract

This lane expects:

`GET /activity?filter=all|talks|money|social&limit=60`

Response is an array of:

- `id`
- `kind`: one of
  `talk_invitation`,
  `raise_hand_accepted`,
  `raise_hand_declined`,
  `ai_seat_sponsored`,
  `ai_seat_accepted`,
  `ai_seat_declined`,
  `follow`,
  `gift`,
  `twin_hired`,
  `earning`,
  `replay_milestone`,
  or platform/future-safe values;
- `title`
- `detail`
- `createdAt`
- optional `talkId`
- optional `profilePublicId`
- optional `personaId`
- optional `transactionId`
- optional safe display `amountLabel`
- optional `requiresAction`
- optional `actionLabel`
- optional `unread`.

A 404 currently fails soft to an empty Activity state while the backend projection lands.
The server remains authoritative for event visibility, Tenant/user isolation, unread state,
financial truth, Talk admission and any actionable mutation.

Status: mobile Activity slice implemented; backend projection remains independent work.
