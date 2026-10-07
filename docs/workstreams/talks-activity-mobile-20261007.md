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
