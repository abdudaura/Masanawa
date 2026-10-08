# Human Chats: WhatsApp-grade fundamentals, distinctly Masanawa outcomes

## Corrected Contacts prerequisites — owner clarification 2026-10-08

WhatsApp-like human Chats must expose a **real Contacts directory** under Chats→New message, distinct from chat recents and AI Expert/Twin catalogs: accepted Masanawa people, favorites/search, pending/declined requests, exact handle lookup, contact visibility/safety, approved person profile and real one-tap C02 conversation. The C01 #468 existing but unmerged `HumanContactsScreen` is a recoverable base, **not a fully shipped Contacts screen**. Optional phone address-book can be displayed locally and used for invitations only with user/OS permission; no automatic bulk cloud upload, no naive hash matching and no conflation of phone numbers with verified account IDs. Full [contact UI/privacy/API/K13–K20](CONTACTS-AND-ADDRESS-BOOK-EXPERIENCE-20261008.md), [new U21–U24](ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md), and [all required F14–F17 C01–C05 source recovery](UNFINISHED-SCOPE-RECONCILIATION-20261008.md). Never put a fake Message button in a local-only contact row.


**Owner-approved quality expansion, 2026-10-08 — implementation and device proof pending.** This supplements `COMMUNICATIONS-EXTENSION-PLAN.md` C01–C05/C08, `APP-SHELL-CONTRACT.md`, `OWNER-REQUIREMENTS-TRACEABILITY-20261008.md` M01–M11, and `WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md` J03/J04/J10/J11. It does **not** approve groups, direct audio/video calls, E2EE marketing, silent AI analysis of private DMs or phonebook import. Keep Humans vs AI personas, Agent Assistant and Talk comments distinguishable.

## 1. Principles and invariants

1. **Two actual humans must be able to message independently of AI.** No login to model account, invisible AI conversation, or agent token is needed to compose, send, receive, search or reopen a human DM. C01 authenticates contact consent; C02 persists server history; C03 delivers realtime and catches up; C04 owns bounded media; C05 owns indexed protected local cache. The rest is polish on **those** source APIs, not a parallel messaging backend.
2. **Fast and honest:** sending pending is *not* delivered, queued on phone is *not* accepted by server, receipt visibility depends on user privacy settings and actual remote acknowledgement. No fabricated "online now", read status, delivery checkmark or network presence from guessed client timestamps.
3. **Private by default:** contact admission/block, chat membership, edited/deleted/revoked message visibility, media/thumbnail search results, offline cache, notification and deep link access checks at every boundary. Local cache and search index must be encrypted/protected per account, purged per retention policy and never mounted as a second account's context.
4. **Compact phone UX:** maintain familiar lightweight WhatsApp-style layout (chat list, thread, composer, long press actions) without reproducing trademarks. Touch keyboard/safe area, attachments/mic vs send arrow, multi-line edit, voice preview, safe media open. No root extra tabs; chat list is human-only.
5. **AI is explicit and separate:** a selected human message may start a private agent task with a bounded chosen payload and disclosure. The assistant is not admitted as a third member to every human conversation. Never auto-transcribe every incoming voice note or silently read all DMs.
6. **Low-end connectivity and language:** optimized for inexpensive Android handsets, Nigeria and global users, Hausa/English code switching, Unicode/emoji, RTL/large text, screen readers, network disconnects and scarce battery/data; capture measurements.
7. **No financial cross-wire:** Transfer in a DM is a clearly distinct intentional action opening an authenticated Wallet quote and explicit approval. Sending ordinary text/voice never spends funds.

## 2. User-facing quality checklist with state semantics

### Inboxes, discovery and navigation
- Authorized handle-based human search and optional explicit user-consented phonebook matching as a **separate future owner decision**; never enumerate arbitrary phone numbers or expose contact lists by default. Consent request Pending/Accept/Decline/Revoke/Block states are clear. A declined request must not send anyway.
- Chat list shows actual person avatar/display name/handle and private preview per preference; timestamp and badge derived from authenticated account; archived, pinned and unread are **per-account user preferences**, not server message truth. Empty-state provides useful contact discovery, not fictitious sample thread.
- Sort recent activity deterministically using server acknowledged timestamps/event cursor with pending local draft placement; avoid stale list reordering causing keyboard interaction to miss target. Do not display a public Expert as a human sender.
- Tap profile to inspect real person identity and privacy controls, mute/report/block; Back returns scroll position/draft and avoids accidental account switch. Notification deep link `/messages/:id` resolves only after authentication and current membership/read permission.

### Message composer and delivery
- One compact message field; composer toggles clear **mic versus send** based on content; Emoji and attach picker outside typing field where possible; safe-area/IME adjustments; multiline keyboard Send behavior; draft local persist per-account conversation. Typing indicators only when authorized and bounded/ephemeral (do not log text).
- Stable **clientRequestId** persisted before send; optimistic local `draft/queued/sending`, then `server_accepted`, optionally `delivered`/`read` based on receiver-side verified state and policy. Exactly one server message on concurrent double tap, process death or network retry. Unknown results keep retry-with-status lookup, never silently mint new request IDs.
- Reply/quote preview pinned to stable authorized original message ID and revision; if original is deleted/revoked, show bounded tombstone/Unavailable, not content from stale cache. Edit/delete-after-send only if server policy/capabilities permit and audited revision/tombstone rules exist. Do not invent E2EE features by naming UI buttons.
- Optional copy/forward/star/bookmark/pin, multi-select, swipe-to-reply, search-in-conversation and search-all-human-chats; each needs correct current membership and recipient review. Forwarded voice/file must be reauthorized as distinct access/share grant, not copy a stale signed media URL.
- Per-chat drafts and unread "mark unread" are UI/account state, not remote read-receipt forgery. Read/delivered indicators must respect opt-out settings and not expose private presence inadvertently.

### Voice notes, images and files
- Hold or tap record deliberately; mic permission prompt, pause/stop and review before send; duration/size bound, waveform only if actual recording, playback speed if qualified and clear audio focus. Private DM recorder cannot accidentally turn on Talk/Gemini track; release mic on process/background/permission revoke and clarify interrupted note.
- Streaming/bounded authenticated upload, content/MIME sniff, file type/virus scanning where required, hash, small encrypted thumbnail, at-rest protection and signed time-limited read with reauthorization upon refresh; blocked/revoked person cannot use old URL. No base64 blob inserted into text history. Upload retry is idempotent with orphan cleanup and actual failed state.
- Image/document preview/download only with authenticated user permission and content restrictions; accessible filename/type/size metadata; no forced large downloads on low data, no auto-play speech on opening a muted chat. Distinguish preview of unscanned file from safe download.

### Notifications and quick response
- Per-chat mute, mentions/urgency only where eligible, OS notification consent and safe lock-screen previews default. Delivery via FCM/APNs must map to authenticated user/account/device and never include sensitive sender/media/balance details on locked screen by default. Open to correct conversation only after JWT refresh and membership recheck; reject stale link from blocked/deleted/signed-out account.
- Incoming message while active thread open updates once, preserves scroll anchor and draft; background message increments real unread once; read receipts advance after visible/authorized reading as policy allows. Public Talk gifts/AI assistant notifications remain distinct from person messages.

### Offline and device migration
- Local-first encrypted/indexed last conversations from account-specific store; warm list target p95 under 1s, cached thread target under 500ms on a named low-memory Android; metrics include fast-usable frame not just empty skeleton paint.
- Delta cursors and outbox reconciliation fetch only missing messages, ordered consistently across race/replay, tombstones, counter/read state; cursor expiration does *full authorized server resnapshot*, not silent loss.
- Older history is server-authoritative paginated, target page size 30–50 adjusted from observed bytes/memory; lazy attachment and avatar fetching; bounded LRU disk quotas; no full history download at startup.
- On new permitted device, auth and authorized history sync restore normal chats without an obligatory manual backup flow; do not promise end-to-end encrypted device backup until separately implemented. Logout, account switch, blocked contact and account deletion clear or invalidate private local caches/search indexes/deep links.

## 3. Human + AI contextual bridge, opt-in every time

**Activation:** long press exact authorized message(s) → "Ask Assistant" / "Translate" / "Help me reply" / "Prepare a Talk" / "Create a task" (only if the action is available). Include explicit message selection (bounded IDs), source account, conversation membership and chosen text/voice/image amount; preview the disclosure (e.g., "Send selected message to Gwani privately?"), Cancel, and adjustable redaction of names/phone/payment numbers. The private Assistant receives a **scoped task context reference**, not raw unrestricted conversation access; Gateway re-reads and reauthorizes the specified items at time of use. No DM content is stored as durable AI memory without a separate user approval. Remote snippets are prompt-injection-untrusted.

**Processing:** user picks translation language or lets speech locale choose; show original vs translated, uncertain names/digits and corrections. Voice note transcription is a separate voluntary action with retention/processor consent, bounded audio length/size; no automatic full-call recording. Assistant prepares a reply/draft/lesson/event/Talk invitation/document; it may propose Wallet quote only for a verified exact recipient and must send user through the canonical approval process. No message, Talk or money automatically sends.

**Review/result:** user can edit output, Copy, Share/download if file actually exists, use **Send to this human** with explicit reviewed recipient + idempotency; or return to original message without losing draft/scroll, or discard. Persona switch Gwani↔Gwana does not change content disclosure or pre-approve. If user blocked/revoked before action, abort/recheck—not send stale draft.

**Persistent global control:** easy "Disable AI suggestions" across all Chats or selected conversation, user-visible processing disclosure and privacy controls. No background indexing or blanket model prompt on all messages. Authorization for a human DM never grants a Twin or Talk Expert a read right.

## 4. Search and organization

- Search across **current authorized human messages** only; backend title/text index and opt-in local cache index scoped by tenant/user+conversation membership, erase/tombstone/blocked member revocations honored; never expose a result by guessable message ID. Paged bounded exact/normalized matches, highlight without breaking grapheme clusters (Hausa/Arabic/emoji), time/contact filter, jump to loaded message and restore back navigation. Query rate limit and no cross-account timing leak.
- Pins, stars/bookmarks, archived and priority/unread can start as protected per-account preferences, but if cross-device behavior promised they require versioned server sync and conflict policy. No invented sync before implemented. Bound pinned count and avoid clock-only ordering for concurrent devices.
- Silence/notification focus: per-chat mute hours/always, optionally "notify mentions" only when supported; no urgent override by AI. Block/report/mute privacy contract overrides convenience controls.

## 5. Future security architecture decisions (NOT automatic implementation)

**Human-to-human E2EE:** needs explicit owner sign-off on protocol (audited ratchet/key agreement), multi-device key provisioning/verification, lost-device/recovery, group/call compatibility, backups, abuse/report mechanisms, attachments encryption and opt-in AI disclosure boundary. **Encrypted server disk/S3 and TLS are NOT E2EE.** Do not market E2EE until independent security review and two-device proof. Building future key-version fields/extension slots is acceptable; exposing "encrypted" marketing as E2EE is not.

**Groups, peer audio/video calls, full phonebook sync, status broadcast, universal payments:** not inferred approved from "WhatsApp-style". Product owner chooses separate requirements, role/privacy/security model, migrations, UX and milestones; none should delay 1:1 excellence or agent usefulness. Do not add dormant buttons suggesting availability.

## 6. Acceptance matrix and adversarial checks

| Area | Required executed test |
| --- | --- |
| A→B message | Two authenticated humans exchange text, server accepted/delivered/read only when true; same durable history across Android devices and app restart |
| Retry | Airplane→queue→reconnect, duplicate taps, killed app after server commit, stale cursor and provider timeout → exactly one authoritative message |
| Consent and block | Request/decline/accept/revoke, blocked sender cannot deliver/read/upload/search or obtain old signed media; non-member cannot enumerate |
| Composer | Long typed Hausa/emoji/RTL, split keyboard/IME, draft persists, mic denial leaves text usable, no accidental public mic |
| Media | Voice note review/send/replay, wrong MIME, oversized, upload timeout/orphan cleanup, signed download expiry, revoked media |
| Search/actions | Cross-chat search/pins/reply/forward/edit/tombstone under account permission; no stale cache leak or duplicate delivery |
| AI privacy | No unsolicited tool invocation on incoming DM; selected message disclosure only; other DM messages excluded; malicious prompt injection fails |
| Translation/voice | Hausa-English or mixed speech with uncertain digits names; original preserved; transcription opt-in; user must explicitly approve send |
| Notifications | Foreground/background/killed/lock-screen, multiple devices, stale link after block/account switch, FCM/APNs deep link accuracy |
| Performance | Named cheap Android, 1k chats/100k historical messages, p50/p95 warm/cold/list/thread, RAM/db size/network bytes/CPU, data saver |
| Financial isolation | DM send arrow never executes money; contextual Transfer opens existing authenticated wallet quote and fresh approval |
| Failover | AI down, Gateway partially unavailable, lost push, voice permission revoked and user signed out — honest states and no private leak |

Each lane must record actual commands, commit SHA and device/provider evidence. Mock fixtures help unit performance but cannot certify real DM delivery, E2EE, media or FCM. Tests and benchmark scenarios are maintained in `20-WINDOW-INTEGRATION-AND-ACCEPTANCE-20261008.md`.

## 7. Ownership

- C01–C05 own foundational contact/DM/media/offline transport; **resume existing PRs and do not duplicate their schemas**.
- U10 owns isolated composer/reply/forward/drafts polish against C02/C05 typed interfaces; U11 owns isolated authenticated message search/index/pins and revocation-aware access; U12 owns additional qualified media UX/accessibility on C04 without editing C04's active handlers; U13 owns notification preferences/privacy and client routing using R14/C03 composition boundaries; U08 owns the opt-in selected-message AI bridge **only**.
- U19 covers accessibility/performance onboarding across isolated measurement and locale tests; U20 final integrated evidence/release instrumentation. One final shared shell/router owner R17/C08 remains mandatory.
- No lane separately implements a new chat backend, generic WebSocket, unapproved contact sync, separate Transfer ledger or broad AI ingester.

**Status:** contract and tests specified; existing draft PRs may contain pieces, but no full production human-chat parity is claimed.
