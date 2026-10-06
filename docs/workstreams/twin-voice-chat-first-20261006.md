# Twin voice/chat-first mobile reclaim — 2026-10-06

Status: ACTIVE

Owner: this workstream
Branch: `work/twin-voice-chat-first-20261006`

Scope:
- replace the legacy clone form with physical Twin setup (gender, age, photo) followed by Gwani-led voice interview;
- remove language selection/presentation from Twin creation and My Twin; language follows the user's current language dynamically;
- make Wallet a conversational, voice-preferred surface and expose existing billing/crypto entry points rather than a finance dashboard;
- add canonical bundled profile artwork for Gwani and Gwana and use it as a fallback when the server has no avatar URL;
- update platform-agent bootstrap guidance so language is never constrained to a fixed list.

Boundaries:
- no production deployment or secrets;
- no migration edits;
- no Commerce settlement changes;
- no NOWPayments provider/account qualification changes;
- no shared Gateway route composition changes.

Acceptance:
- Flutter source is analyzer/test-ready;
- existing server contracts remain backward-compatible;
- crypto is surfaced whenever the existing crypto callback/runtime is available; provider eligibility remains server-owned.

## Progress — 2026-10-06

Implemented on this branch:
- physical-only Twin setup: gender, age and required photo;
- Gwani voice/chat interview handoff with no language selector;
- global runtime instruction to follow the language of each current user turn;
- interview summary -> canonical personal Twin creation;
- durable public Twin profile plus full referral URL returned at creation;
- bounded durable Twin avatar storage and public profile-image endpoint;
- Gwani/Gwana bundled Hausa portrait fallbacks across chat/list/settings surfaces;
- playable voice attachment for the Twin-ready/referral explanation;
- chat-first Wallet surface with voice entry and billing/crypto conversational actions.

Scope note: durable profile migrations 0004/0005 were added because a real referral link and durable setup photo cannot be implemented safely as transient client state. 0004 is preserved from the existing production-integration implementation; 0005 adds only bounded Twin image custody. No existing deployed migration was rewritten.

Crypto reconciliation: current main does not contain the NOWPayments runtime. PR #136 carries it but is 646 commits ahead / 1 behind main, so wholesale merge is unsafe. This branch does not claim provider runtime deployment merely from showing the conversational Crypto entry point.
