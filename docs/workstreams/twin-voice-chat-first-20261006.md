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
