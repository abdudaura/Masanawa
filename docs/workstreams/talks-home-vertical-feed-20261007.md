# Talks Home vertical feed implementation — 2026-10-07

Owner/window: current ChatGPT implementation window
Branch: `work/talks-home-vertical-feed-20261007`
Base: `6a944c310deb881cdbc9e987e4c4119d7f9d4289`

## Product direction

Implement the first real mobile slice of the human-hosted Talk product.

Locked UX:
- bottom shell uses **Home · Create · Activity · You**;
- Home contains exactly two primary tabs: **Explore** and **Live Talks**;
- both tabs use a **single-column vertical feed** of full-width Talk cards;
- no horizontal content rails/grids/carousels;
- discovery should feel like a compact audio-first TikTok rhythm: one strong card after another;
- Talk cards prioritize topic/title, host/participants, live/replay state, listener count and Listen action;
- Live Talk experience includes a public comment section;
- existing reusable Billing/Crypto/Twin/runtime foundations must not be deleted.

## Owned paths

This lane owns:
- consumer mobile shell/navigation files needed for Home/Create/Activity/You;
- Home/Explore/Live Talks feed widgets/screens;
- new Talk presentation models/widgets that are isolated to the consumer mobile app;
- focused widget tests for this slice;
- canonical product docs needed to reflect the Home-tab refinement.

It does not own production deployment, shared Commerce/provider code, migrations or channel runtime.

## Status

Claimed and active. Inspecting current mobile source before edits.


## Implementation checkpoint

Implemented on this branch:
- Talk discovery/domain models in Flutter;
- authenticated Gateway transport contract for `GET /talks?feed=explore|live`;
- Talk detail contract `GET /talks/:id`;
- Talk create contract `POST /talks`;
- comment contract `POST /talks/:id/comments`;
- Home with **Explore / Live Talks** tabs;
- both Home tabs use only one-column vertical Talk cards;
- Talk listener/replay presentation foundation;
- public Comments section + composer;
- Create Talk screen;
- new root shell **Home · Create · Activity · You**;
- You hub with Wallet/Bills/Crypto moved out of root navigation;
- canonical docs updated to the four-tab shell and comments;
- focused widget tests for vertical discovery, root shell and comments.

## Backend dependency / handoff

This lane deliberately does not own shared Gateway persistence/migrations.
The mobile contract now expects:
- `GET /talks?feed=explore|live` -> array of Talk feed items;
- `POST /talks` with `{ topic, title? }` -> created live Talk;
- `GET /talks/:id` -> `{ talk, comments }`;
- `POST /talks/:id/comments` with `{ body }` -> created comment.

A separate backend lane should implement these using the authenticated platform session,
human-host requirement, durable Talk/comment storage, and live/replay policy.

## Current verification status

Implementation is committed and ready for CI/review. No production deployment from this lane.
