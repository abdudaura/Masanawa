# Masanawa v1 — Product, roles, navigation, all primary screens and journeys
Status: **PROPOSED DESIGN v0.1**, not approved, 2026-10-10. Existing [owner-confirmed UX](../AUDIO-FIRST-SCREEN-SPECS.md) prevails when different. Detailed API and pixel design are subject to review.

## One-sentence proposition
A low-friction, audio-first social and messaging app for listening to short Talks, chatting with contacts and Masana, enjoying audio Rooms, getting practical help from Gwani, and using a simple Wallet.

## Primary actors and permissions
- **Guest:** splash, welcome, choose language, registration, clear denied-gate for protected links.
- **Member:** Chats/Rooms/Talks/Gwani/Wallet; human DM, follow, publish, purchase and supported transfers after authorization.
- **Creator:** member who records and publishes Talks and manages a public creator profile; no personal-agent setup, reselling or earnings dashboard.
- **Masanawa agent (Masana):** configured by the platform with a public profile and optional scheduled audio content. Gwani and Gwana remain platform agents; their roles are explained through the product context, not repetitive badges.
- **Room owner/moderator/member:** authorized membership, invites, posting and moderation; live speaking is separately gated.
- **Approved P2P merchant:** eligible offer management and payment confirmation; no implicit escrow release privilege outside agreed policy.
- **Support agent:** permission-limited ticket/order lookup, no raw private data or secrets by default.
- **Finance/risk operator:** segregated approval, reconciliation, dispute decisions and auditable evidence.
- **Platform administrator:** native admin app with granular settings, providers, channels, roles, flags and incident handling.

## Primary mobile shell, exactly five stable semantic destinations
Bottom tabs: `chats` · `rooms` · `talks` · `gwani` · `wallet`. Talks is central and default for an ordinary authenticated cold launch; deep links/incoming calls restore requested destination after auth; resume preserves the active tab/task. Each tab retains its own stack, scroll position and composer draft. Back dismisses overlays -> details -> previous tab state; no repeated duplicate routes. Legacy aliases require a versioned redirect map and account-authorized ID lookup.

### Visual system (proposed)
Compact, one-handed, WhatsApp-familiar composition. Masanawa blue brand accent at reduced saturation, neutral background, 44–48dp-equivalent interactive touch areas, restrained elevation, readable contrast, dark mode, no flashy launch frames. Show only names, avatars and useful roles; omit repeated AI badges, synthetic-content labels and cautionary copy from normal interactions. Top bar: product/identity context, context search/options; bottom: five stable tab icons/labels. One major action per screen. Never bury receipt status behind a transient toast. Handle small low-memory Android phones and large dynamic type, Talk waveform contrast, offline banners and reduced motion. English and Hausa need complete copy and realistic long-word layout before expansion.

## Detailed screen register: each line is an implementable screen or sheet
`SC` IDs are **proposal IDs**; do not silently replace `UI-01..` or `UX-A..` until review. Unless noted, every screen must implement account-fenced loading/empty/error/offline/retry/permission/blocked/rate-limit states from the common matrix below.

### Entry, identity, account (SC-001–SC-008)
| ID | Screen / entry -> exit | Visible layout and exact actions | Server and failure contracts |
|---|---|---|---|
| SC-001 | Native splash -> auth or deep link/home | approved logo on neutral background, no exposed technical credentials | async session restore; network outage keeps recoverable auth/local state |
| SC-002 | Welcome / auth selector -> SC-003 | Sign in, Sign up, email/phone switch, accessible centered language button | auth capability list from server; no assumed phone verification |
| SC-003 | Sign in / register -> SC-005 or home | email/phone, numeric-secret input for phone choice, show/hide, validation, Submit, Switch method, Recovery | masked auth errors; bounded rate limits, no phone-ownership inference |
| SC-004 | Recovery / verify -> SC-003 | list eligible verified methods, recovery input, resend cooldown, device/session revocation confirmation | cannot recover using unverified phone number only; expired/invalid evidence states |
| SC-005 | Name/profile setup -> home | display name, optional avatar, language, Save/Skip; no forced contacts access | server-owned account ID, save/readback, rejected avatar and retry |
| SC-006 | My profile -> SC-007 / SC-045 | avatar, handle, bio, language, My Talks, Saved Talks, Settings, Activity | own profile projections only; no public wallet details |
| SC-007 | Edit profile/avatar -> SC-006 | edit name/bio/avatar, crop, delete image, Save/Cancel | permission, upload size/type validation, late upload cancellation |
| SC-008 | Account/security -> SC-004, SC-034 | sessions, verified identities, change credentials, sign out other devices, block list | reauth, stale session and revoke; no secret logging |

### Chats and Gwani (SC-009–SC-020)
| ID | Screen | Layout / actions | Binding, safety and states |
|---|---|---|---|
| SC-009 | Chats tab | list with avatar/name/time/unread, Search, New Chat, Calls filter, optional pins | cached first; background refresh; account-scoped cursor and unread semantics |
| SC-010 | Masana & Contacts | Masana / Contacts filters, search, names, avatars, relevant roles, choose conversation | stable internal contact/agent identifiers; blocked/hidden account handling |
| SC-011 | Conversation | name/avatar header, Call/menu, ordered bubbles with reply preview, attachment icon + emoji OUTSIDE text field, mic when empty/send when populated | local durable outbox then server acceptance distinct from agent processing and recipient read; reconcile IDs, reorder safely |
| SC-012 | Record voice note overlay | hold mic / slide cancel / slide lock, elapsed, pause/resume, preview/seek/delete/send | local capture must work without Gemini Live; permission vs encode vs upload errors, resumable draft |
| SC-013 | File/document attachment | picker, preview, file size/type, caption, send/cancel, download | private object ACL, expiry, failed upload retry, virus/size checks |
| SC-014 | Message options | reply, copy, save, delete if authorized, report, transfer receipt details | sender role, immutable message ID, moderation and deletion semantics |
| SC-015 | Call log / initiation | recent/missed/outgoing, directory picker, microphone status, call | nested under Chats, not bottom tab; capability disabled honestly when unqualified |
| SC-016 | Call ongoing | ringing/connecting/active/reconnect/ended, mute, audio route, end | device/media/provider state; no silent open mic; clear error/rejoin |
| SC-017 | Gwani tab | agent icon/name, task stream, quick-choice vertical chips above composer: Airtime, Data, Electricity, TV; voice/text/file controls | one durable server-authorized task; fast receipt bubble, early processing status, no repeated field prompts |
| SC-018 | Guided purchase draft | selected service, progressive option selectors, editable values, Back/Change/Cancel | same task ID across menu/text/voice; selections validated against real catalog; edits revoke quote |
| SC-019 | Purchase review | recipient, actual product/quantity, MSN source, fees, expiry, Authorize/Cancel/Change | explicit consent tied to exact quote; insufficient funds/restricted provider/expired state |
| SC-020 | Purchase status and receipt | pending/processing/uncertain/succeeded/failed, status refresh, help, downloadable receipt | provider-authoritative receipt and idempotent retry; no success from model narration |

### Published Talks (SC-021–SC-027)
| ID | Screen | Layout / actions | Binding and failure modes |
|---|---|---|---|
| SC-021 | Talks default | Following / Discover, one active player, creator name/avatar, title/waveform/duration/seek, Follow/Like/Comment/Save/Share/Report | durable post IDs, read cache, playback-focused counts; pause audio on record/call |
| SC-022 | Talk comments sheet | paginated thread, reply composer, post, delete own comment, report | moderation filters, optimistic rollback, off-screen playback state retained |
| SC-023 | Record/Compose Talk | record/pause/lock/cancel, preview, trim, title, publish, draft save | ~3min configurable default; upload and processing states independently persistent |
| SC-024 | My drafts/published | list drafts/uploads/failed/published, resume/edit/delete, media status | dedupe by publication ID and account; no empty post if encoding fails |
| SC-025 | Creator / Masana profile | bio, Follow/Unfollow, posts, report/block | stable backend access rules; avoid private wallet leakage |
| SC-026 | Saved Talks library | filtered list, search, play, unsave, download only if authorized | cache access policy, deleted/blocked post handling |
| SC-027 | Search/Discover | keyword, filters People / Masana / Talks, results, history clear | typed result IDs, empty/offline, no personal/private search leakage |

### Rooms (SC-028–SC-032)
| ID | Screen | Layout / actions | Binding and failure modes |
|---|---|---|---|
| SC-028 | Rooms tab | joined/discover list, New Room, search, previews | membership and visibility scope with cached account-fenced results |
| SC-029 | Room detail/audio history | name, cover, member list, voice-note feed, record/send, invite/leave/report | read/post permission per membership, replay blocked after removal |
| SC-030 | Create/edit Room | name, short description, public/private/invite policy, Save/Cancel | owner authority and revision; rollback on failed create |
| SC-031 | Room members/moderation | invite link, requests, promote/demote, mute/remove, transfer ownership | owner-only actions, audit, revocation across sockets/media URLs |
| SC-032 | Optional live Room session | join, mic, listen/speak roles, hand-raise, participant list, exit | gated until real two-device/media/provider test; optional enhancement not launch substitute |

### Wallet and P2P (SC-033–SC-044)
| ID | Screen | Layout / actions | Binding and failure modes |
|---|---|---|---|
| SC-033 | Wallet tab | MSN available/pending/reserved, hide balance, funding/Send/Convert/P2P, crypto holdings, recent activity | exact atomic units; server revision/as-of; stale quotes never payable |
| SC-034 | Funding method | eligible fiat methods or crypto network, amount, fees and limits, Continue | real providers and eligibility only; disabled choices explained |
| SC-035 | Funding instructions/status | provider checkout or deposit address/memo/chain, copy, pending/confirming/credited | authenticated webhooks + polling; reorg, underpayment, chargeback and pending obligation |
| SC-036 | Conversion | source/target/amount, quote preview, expiry, review/authorize | atomic unit arithmetic and liquidity; no unsupported pairs |
| SC-037 | Internal transfer | choose stable recipient ID, amount, note, review, Authorize | shared Wallet/Chat transfer engine; double-send/recipient spoof negatives |
| SC-038 | External crypto withdrawal | network, verified destination/memo, amount/fee, step-up, review/status | supported pairs and limits; provider uncertain outcomes reconciled |
| SC-039 | Activity/receipt detail | filters/search, status, ID, time, fee, provider/ledger reference, support | immutable server receipt; cannot leak private history through public profile |
| SC-040 | P2P offers | eligible buy/sell MSN offers, terms, payment methods, amount, open | only approved merchant counterparties; remove trading when unqualified |
| SC-041 | P2P create/review order | rate/amount/payment deadline, Reserve, Cancel before claim | atomic reserve; no unlocked order state after failed reserve |
| SC-042 | P2P active order | bound bank instructions, mark paid, merchant confirm, countdown, dispute | receipt claim ≠ settlement proof; race handling with expiry |
| SC-043 | P2P dispute | upload evidence, reason, status/timeline, respond, appeal/support | authorized operator review; never screenshot-only automatic release |
| SC-044 | P2P merchant | verified status, offer create/edit/pause, settlement history, support | eligibility, suspend new orders without abandoning obligations |

### Supporting and administration (SC-045–SC-052)
| ID | Screen | Layout / actions | Binding and failure modes |
|---|---|---|---|
| SC-045 | Settings | language, profile, audio, notifications, privacy, support, About, sign out | never reveal AI/provider secrets, old app claims, or unproven security |
| SC-046 | Permissions/privacy | mic/notification/contacts toggles with rationale; block list and data preferences | separate OS permission from server preferences and feature eligibility |
| SC-047 | Help/account lifecycle | ticket, report abuse, export/delete account, pending deletion | preserve open transactions and legally retained records; safe reauthentication |
| SC-048 | Admin home (separate Android app) | health summary, pending incidents, queue failures, search, role-scoped quick actions | production vs staging visible, no shared consumer privileged session |
| SC-049 | Admin users/agents/channels | users/platform agents/skills, Masana schedule/approvals, WhatsApp/Telegram state, device and consent | least privilege, audit, per-provider redaction and rollback |
| SC-050 | Admin finance | ledger reconciliation, provider events, P2P disputes, holds, refunds and authorization | dual control where needed, no freeform SQL/mint button |
| SC-051 | Admin content/support | reported Talks/Rooms/users, scheduled post review, pause/resume, tickets | , source/provenance, moderation redress and event history |
| SC-052 | Admin operations | flags, queue lag, storage/budgets, backup health, release metadata, incident/rollback | no proof from /healthz alone; credentials never displayed |

## Required interaction-state contract for each SC
**First-run/loading:** stable placeholders, no indefinite spinner; cancelable if safe. **Empty:** explain why and give one useful next action. **Offline:** show account-fenced cached reads and draft outbox; a money action queues no unsanctioned execution. **Failure:** actionable error by stage and preserving user input. **Retry:** same operation/idempotency key where appropriate, never duplicate transfer/purchase/post. **Permission denied:** specific OS/resource reason, Settings entry and no fake success. **Blocked/restricted:** deny without sensitive disclosure. **Stale/conflict:** refresh permission, revision, quote and require fresh review. **Rate-limited:** visible retry allowance, not repeated automatic calls. **Sign-out/account-switch:** cancel audio/tasks/subscriptions, clear private screen cache, never leak draft or balances. **Slow network:** immediate local outbox acknowledgement, then distinct server accepted/processing/completed. **Accessibility:** semantic names, labels, dynamic text, visible focus, adequate targets and captions/transcripts where provided.

## Shared audio lifecycle
Recording, private playback, Talk playback, live Gwani and calls share a single audio-focus owner; starting one pauses incompatible sources. Release mic after cancel/exit/crash. Media failures are staged: permission -> initialize -> capture -> encode -> upload -> server process -> retrieve/play -> optional live authorize/connect/send/receive/output. Standard voice notes do **not** depend on Gemini Live.

## Golden complete customer journeys (one actual test per supported release feature)
- **J-01** email/phone registration -> sign-in -> account switch -> logout/revoke -> no leaked cache; recovery cannot trust unverified number.
- **J-02** cold launch -> correct five tabs -> Talk default; deep link, Back and resume preserve intent, drafts and media focus.
- **J-03** human DM send offline -> queued bubble -> server accepted -> second-device readback; correct tick semantics and retry without duplicate.
- **J-04** record-preview-send voice note -> upload -> second device plays/seeks; deny permission then restore recording.
- **J-05** open Gwani -> buy airtime through menu/text/voice mixed inputs -> quote -> explicit approval -> provider status -> durable receipt, even after app restart.
- **J-06** Talk record/trim -> publish once -> follow/like/comment/save on another account; playback count only after qualified listen.
- **J-07** create Room -> invite person -> permitted note playback -> remove member -> removed member loses read/media access.
- **J-08** fund via confirmed fiat -> MSN pending/available -> transfer to another account -> same receipt in Chat/Wallet.
- **J-09** crypto deposit/convert/withdraw eligible asset with provider confirmation, failed/unknown outcomes and no duplicate posting.
- **J-10** eligible merchant P2P reserves MSN -> buyer claims fiat sent -> authorized verification -> one escrow release; dispute freezes.
- **J-11** Telegram/approved WhatsApp incoming customer -> mapped account and consent -> same task/quote/receipt semantics as Android.
- **J-12** Masana audio scheduling -> editorial review -> generated audio listen-test -> publish once; pause/budget prevents unwanted publication.
- **J-13** admin can disable new purchases safely while unresolved payments are still reconciled and receipts visible.
- **J-14** restart/deploy/rollback and DB+object restore retain messages, audio, balances, escrows, drafts and idempotency.
Every journey maps to real client/UI → authenticated API → database/provider → durable readback → negative test and evidence record. All currently **NOT_RUN for this blueprint**.

## UX design gate
Before parallel UI redevelopment: (1) review all 55 SC entries against existing screen code; (2) give each its own route/control enabled conditions, API field contract and screen-state examples; (3) produce actual design/prototype for navigation + critical screens; (4) test low-end Android, accessibility and Hausa length; (5) owner accepts or records changes. This initial table is a complete **candidate inventory**, not 55 pixel-perfect approved designs.
