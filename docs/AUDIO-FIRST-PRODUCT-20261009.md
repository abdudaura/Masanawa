# Audio-first Masanawa — current decisions

Status: owner product decisions captured 2026-10-09; implementation unverified. Scope: existing Flutter Android app and canonical Gateway, storage, provider and ledger foundations. No platform rewrite.

## Confirmed direction

- Talks are user-published audio posts with scrolling playback, likes, comments, play counts and following. Live sessions are not the Talks feed object.
- Rooms are persistent audio-focused groups. Reuse qualified live infrastructure for optional group sessions, preserving privacy and moderation.
- New chat opens **Masana & Contacts**, nested in Chats. Platform Masana are AI; people are contacts. Existing owned personas are not relabelled as people or deleted without reconciliation.
- Bottom navigation is exactly **Chats · Rooms · Talks · Gwani · Wallet**; **Talks is centred and the default tab**. The former Assistant navigation label becomes **Gwani**. Its default vertical floating billing menu progressively filters the next options above the chat composer. Free-form text/voice can bypass menus and complete the same supported purchase.
- Email and phone signup/login are offered. Phone uses a user-set numeric password, not mandatory SMS OTP; it does not prove number ownership.
- The language selector is a centred icon without visible text; it retains accessibility semantics. Native and Flutter launch screens use a neutral background without blue flashes.
- Chat recording, playback and navigation require actual repair and device qualification; preserve working text and local improvements.
- MSN is the platform asset. Fiat buys MSN; no spendable fiat wallet/direct platform fiat redemption. Supported crypto can be held, internally sent, deposited, withdrawn where qualified and converted with MSN.
- P2P is inside Wallet, themed and minimal, trading **MSN only** against counterparty fiat. Seller MSN is escrowed; crypto holders convert to MSN first to use P2P.
- Chat supports private MSN/crypto transfers through the canonical wallet service with a small optional explanatory sheet.
- Masana publish scheduled Gemini-generated audio crafted in character. Users follow them. Each persona needs distinct expertise, style, editorial quality and clearly disclosed AI identity.

## Reversible design defaults, not new owner confirmations

| Decision | Integration default | Boundary |
| --- | --- | --- |
| Post duration | Three minutes, server-configurable | No unlimited recording; tune after feedback. |
| P2P launch | Approved merchants, fixed offers, a small qualified payment-method set | No exchange-style order book, leverage or crypto P2P. |
| MSN representation | Internal exact-amount ledger asset | Reconcile #576 denomination/backing; do not imply an on-chain token. |
| Discovery | Following and Discover, simple ranking | No attention-optimizing recommendation project before reliable posting/playback. |

MSN precision/backing/rate/liquidity/fees, transaction authorization and real provider support are financial activation prerequisites, not arbitrary defaults a coding window may invent.

## Core now, differentiated, later, excluded

Core: audio reliability, connected chat/directory/auth/navigation, MSN funding/conversion/transfers/receipts, escrow/disputes, Gwani purchase parity, audio publishing/following and Room membership/history. Deliberate differentiation: approachable service menus + conversation, persona-based disclosed creator posts, transfers within private chat.

Later: optional verified live Room sessions and other existing advanced persona features after foundations qualify; retain source and classify rather than delete. Existing calls must be reconciled and qualified, inside Chats.

Exclude from this round: endless public Talks, a bottom Contacts/Agents tab, spendable fiat wallet, direct platform fiat cashout, crypto P2P sales, copied Binance complexity, automatic escrow release from screenshots, synthetic personas pretending to be real people, unsupported universal crypto claims.

## Evidence and constraints

Owner-reported local fixes/APK are not available here. Historical source inspection applies only to its named SHA. Scheduled scripts and sample concepts are planning artifacts until generated, inspected and published in a qualified test environment.

Keep Flutter, existing services and provider adapters. Compare incremental options only where a missing capability demands it, using current official cost/support evidence before paid commitments. Do not purchase a new payment/media provider from this plan.

## Research references checked 2026-10-09

- Telegram group voice patterns: https://telegram.org/blog/voice-chats and https://telegram.org/faq
- SoundCloud audio engagement/play-count patterns: https://help.soundcloud.com/hc/en-us/articles/115003564988-Insights-Overview-page
- Gemini speech styles and delivery: https://ai.google.dev/gemini-api/docs/speech-generation — generated emotional performance and language quality require listening tests.
- Android recording requirements: https://developer.android.com/media/platform/mediarecorder
- Authentication protections: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
- CBN banking framework reference: https://www.cbn.gov.ng/out/2024/fprd/guidelines%20on%20operations%20of%20bank%20accounts%20for%20virtual%20asset%20providers.pdf — relevant qualification reference, not a claim that Masanawa is licensed/approved.

## Confirmed launch and naming policy

Ordinary authenticated cold start/home opening selects Talks, index 2 of the named tab list. Signed-out users complete auth first, then land on Talks. An explicit notification/deep link targets its intended resource after authentication; an active call/order/task is not discarded to force a feed screen. Background resume preserves the active task and tab rather than behaving as a new home launch. Gwani is the consumer screen/tab name; keep existing assistant API/type/path names as compatible internal contracts. This label change does not delete Gwana or silently change agent identities/voice settings.

Completeness is not absolute: use [the audit](AUDIO-FIRST-COMPLETENESS-AUDIT-20261009.md). Unspecified financial activation and unexecuted device/provider proof remain blockers for their affected capabilities.
