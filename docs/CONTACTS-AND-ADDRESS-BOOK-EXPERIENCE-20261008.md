# Contacts and people discovery — fully specified human-messaging experience

**Owner-approved product expansion, 2026-10-08; implementation and handset proof remain OPEN.** This explicitly resolves a missing specification in the first U01–U20 plan. The product needs a familiar **Contacts directory** reachable from Chats, not a sixth tab. Existing **C01 draft PR #468** already contains `HumanContactsScreen` (exact @handle lookup, incoming/outgoing requests, acceptance, revocation and discoverability settings) and Gateway `/messages/contacts/*` endpoints; these must be **reused and enhanced**, not independently rewritten. It is not yet integrated/verified as a complete WhatsApp-style contacts experience and it does **not** currently implement Android/iOS phonebook discovery. The contacts directory is **humans only**, never Expert/Twin identities.

## A. Information architecture and exact navigation

```text
Chats bottom tab (/messages)
  ├─ Recent chats (durable C02/C03/C05) + unread/search + privacy-safe previews
  ├─ New message button (+ / compose) → Contacts (new nested route /messages/contacts)
  │    ├─ Search people (existing Masanawa contacts + accepted @handle lookup)
  │    ├─ Favorites (opt-in per-account)
  │    ├─ Existing Masanawa contacts (accepted, messaging eligible)
  │    ├─ Contact requests: Incoming / Sent / declined/revoked (policy)
  │    ├─ Add by @handle (C01 exact lookup)
  │    ├─ Phone contacts (OPTIONAL separate local device permission)
  │    └─ Invite friends by system share sheet / link (no ghost in-app DM)
  ├─ Human person profile → Message → same C02 canonical conversation
  ├─ People discover/profile from Talks → Message → contact request if required
  └─ Existing conversation → person profile / mute / block / report / remove
```

- **Never** insert Contacts as sixth root tab. New message opens a *nested human Contacts view* and not the AI-character directory; `/messages/:conversationId` is a human thread. Preserve old `/chats` AI history aliases according to APP-SHELL-CONTRACT; no silently remapped AI threads.
- Contact screen has a **one-tap search**, a visible "Add by @handle", and real list with avatar (R18 profile image), display name, @handle (if permitted), messaging/request state and compact status. Tapping an accepted contact opens a C02 authorized human conversation, or starts one via actual authenticated API. Pending request opens request status; denied/unregistered/blocked contact never gets a fake chat entry.
- Display accepted contacts independently of message history: someone without existing chat remains in Contacts; someone previously messaged but later revoked/blocked appears in historical thread only as permitted by current privacy policy, with safe non-send state. The Chats root shows recent conversations while Contacts lists people.
- Sections are accessible, searchable, paginated and stable: Favorites (bounded user-owned metadata), All Masanawa contacts, Incoming requests, Outgoing requests, optional phone contacts and invitations. No giant unvirtualized list; locale-aware display names and correct grapheme search including Hausa, accented names and Arabic/emoji. Swipe or contextual actions never accidentally delete/transfer.

## B. Concrete states and product UX

| Human identity/current relationship | What is displayed | Main action | Allowed follow-up |
| --- | --- | --- | --- |
| Accepted C01 contact, available account | Avatar, safe public name/@handle; favorite if user chose | **Message** | Resolve or open actual C02 conversation; ensure membership/consent at moment of send |
| Previously messaged person | Normal recent thread if authorized | **Open chat** | Preserve draft, unread, typing/voice and last position; don't recreate duplicate thread |
| Discovered public person (not yet approved) | Public profile fields only | **Request to chat** (when recipient requires approval) | Pending state with Cancel; no send until C01 accepts |
| Incoming request | Minimal sender info, privacy/report context | **Accept / Decline / Block / Report** | Revision-checked transactional C01 mutation with fresh readback |
| Outgoing pending | @handle, request time, truthful pending | **Cancel request** | Server revocation; no fabricated delivered/read |
| Anyone-contact policy | Public identity and server-provided exact messaging eligibility | **Message** if allowed by C01/C02 | Must re-check send-time policy/block/limit; no assumed broad inbox |
| Blocked/revoked/restricted | Safe restricted explanation; no sensitive metadata | **Manage block** if owner has authority | Re-check old cached signed media, search and deep links; no bypass |
| Not on Masanawa, from opted-in device phonebook | Device-local name and number (local only) | **Invite** using OS share sheet | User chooses link/SMS app; show no fake Masanawa chat or online status |
| Unregistered/hidden @handle | Generic privacy-safe unavailable | **Try different handle / Invite** | Never reveal whether hidden, blocked, deleted or never existed |
| Offline/invalid auth | Protected cached accepted directory if policy allows, stale indicator | **View saved contacts**; Retry when online | Never create unsent approved new contact state or send money offline |

**Discovery:** visible search never relies on arbitrary enumeration of phone numbers or user IDs. Exact @handle is available via existing C01 privacy-preserving lookup. Future searchable name suggestions must have a separate explicit anti-enumeration/rate/privacy contract; default to exact handle and locally known accepted contacts. UI must not show a discoverable flag for another person unless server is authorized to disclose it.

**Contact avatar/profile:** reuse actual R18 avatar and profile persistence, placeholders/initials for missing images, refreshed after profile update/restart. Never download private avatar from guessed object key. Match current nickname vs account display name without silently substituting one for recipient identity.

**Messages:** every `Message` operation must use the same C02/C01 authenticated membership service and versioned C03 sync. A local contact's mobile number is *not* a verified Masanawa userId, and must never become crypto recipient ID or DM member without canonical resolution.

## C. Device phonebook — separate voluntary consent and minimal disclosure

**Owner decision clarified:** Masanawa SHALL have a **Contacts screen with a usable in-app Masanawa directory** even if device contact permission is denied. It MAY provide an **optional device-phonebook view and "invite friends" path**, explicitly labeled "Find phone contacts" and off by default. This request **does not authorize mandatory bulk upload, covert syncing or unsecured server-side phone matching**. User must deliberately opt in. Initial implementation may deliver a fully functional **on-device-only phonebook list + share invitations** while a privacy-safe phone-number matching protocol remains gated for security review.

- On Android, request the OS contact permission only after explicit in-product explanation and user tap; use the least privilege available. iOS separately requires its platform-specific Contacts permission and privacy reason. New native packages/permissions/manifest/plist need signed Play/App Store build: Shorebird cannot add them through a Dart patch. Preserve debug-denied, permanently denied and settings recovery; never trap users behind the permission.
- Read only necessary fields: locally visible display name, normalized phone entries, optional small photo if OS supplies, stable local record ID (only for on-device cache). Do **not** ingest notes, addresses, birthdays, family information or unrelated labels.
- Normalize numbers with proper country-aware E.164 logic **only when enough locale/user-supplied region evidence exists**; preserve un-normalizable numbers as local-only without guess. Support duplicates, multiple SIMs, country codes, renamed contacts, OS permission revocation and contact deletion/change observers; user may choose which number to invite.
- Maintain a **protected on-device-only temporary index** per account session (or no persistence by default); no raw contacts in log, analytics, crash, AI context or Gateway without a separate owner-approved security design and explicit data-sharing consent. Hide sensitive entries on logged-out device/account switch.
- **Server matching is NOT automatically authorized.** Plain unsalted number hashes are vulnerable to phone-number enumeration; don't assume SHA-256 upload makes the address book private. If later introduced, require a reviewed privacy-preserving protocol (e.g. appropriately designed private-set intersection/OPRF or bounded rate-limited consented discovery with clear notice), verified account phone numbers, abuse limits, expiry, controls for being discoverable, allow/deny list, user deletion of any uploaded material and tests against account enumeration. No blanket raw number upload, unconsented background continuous sync or phonebook ingestion by the AI.
- Opt-in status persistent as explicit preference; user may revoke and clear local stored matches/photos. Permission loss while on screen gracefully collapses phone section and leaves Masanawa accepted contacts/search fully usable. Respect OS limited contact access where offered, not treat it as whole-book permission.
- Opt-in phonebook **presence does not mean friend is registered** unless backend returns a current, authorized, verified match under a separately qualified protocol. In v1 all non-matched entries display **Invite**, never **Message**. If match contract later approved, distinguish verified Masanawa account from local phone number with exact mapping and re-check C01 eligibility before opening DM.

## D. Invitations, sharing and contact requests

- System share intent with **owner-approved universal HTTPS deep link** to signup / public profile / eligible public Talk (do not expose account internal UUID or private DM token). Signed short-lived invite/referral code only if actually implemented server-side; allow plain public landing link initially. The user chooses WhatsApp/Telegram/SMS or another OS share target. Do not auto-send messages to the address book.
- Invitee opens a safe web fallback when Masanawa not installed; app store link only when real store release exists; installed app deep-link returns through login/OTP if needed and preserves privacy. New user cannot claim someone else's invite/contact identity by URL guess.
- After sign-up, invitation **may** lead to a suggested pending consent/contact request, never auto-accept, auto-follow, load the inviter's private chat, read friend list or send money. Rate-limit and anti-spam; no paid referral rewards unless real program/economic policy is approved.
- A public Person profile's "Message" follows C01 privacy policy; rejection/decline/report and revoked request must be visible and suppress repeated spam. Abuse prevention and account delete propagation use R12/R15 policy.
- In-app contact sharing can show safe public person profile link only with that person's discoverability consent; never publish private telephone numbers/DM contents without direct owner permission.

## E. Backend/state contracts (reuse C01; proposed additions)

- C01 draft already has `HumanContact`, `HumanContactStatus`, `HumanContactPolicy`, `HumanContactsTransport`, `humanContactsProvider` and API `/messages/contacts/*`. **U21 must use these types/route semantics** and first inspect #468 current HEAD, not copy its tables. R17/C08 owner mounts final nested Contacts destination and one-tap C02 open. Add optional presentation metadata carefully with backwards-compatible DTO migration and R18 source; do not append insecure arbitrary phone queries.
- U21 may own `apps/mobile/lib/src/contact_hub/**`, tests and isolated screen/controller adapters; no shared router edit or rename of `HumanContactsScreen` in #468 without owner coordination. Accepted contact list should be server-backed with keyset pagination and predictable sorting/filtering rather than the current unbounded repeated refresh; if C01 route lacks pagination/labels, propose safe versioned extension through **C01 owner**.
- U22 owns `apps/mobile/lib/src/device_contacts/**` and optional platform adapters under **new isolated package directory** only; any `pubspec.yaml`, AndroidManifest, iOS Info.plist/Podfile or app permission changes require named **native release integrator** and explicit privacy/store review. No unreviewed native dependency.
- U23 owns `apps/mobile/lib/src/contact_invites/**` and `services/gateway/src/contact_invites/**` if real invite token necessary; authenticated/public route, expiry, throttling, consent and restore. No fake registration state.
- C01 remains sole identity/consent schema owner, C02 sole human conversation/message owner, C03/C05 delivery/cache owners, U24 optional messaging requests/safety UX owner and R17/C08 single final route composition owner. U11 handles authorized message *search* only, not contact inventory; do not conflate them.

### Proposed presentation DTO (illustrative, not a new trusted API)

```ts
type ContactHubRow =
  | { kind: "masanawa"; userId: string; displayName: string;
      publicHandle: string | null; avatarUrl?: string; relation:
      "accepted" | "incoming" | "outgoing" | "blocked" | "restricted";
      canMessage: boolean; updatedAt: string; revision: string; }
  | { kind: "device-only"; localRecordId: string; displayName: string;
      phoneLabel: string; inviteOnly: true; };
```

The canonical server response is defined only by the C01/C02 owners. **Client-provided `canMessage` is not authority**; Gateway always validates membership/restrictions at actual message send and at notification/media access. Device-only number never entered into canonical C02 participant userId, even when a matching nickname appears.

## F. Integration and security testing: mandatory contacts journeys

**K13 — New user with no granted Contacts permission:** Chats → New message → Contacts shows in-app search, contact requests, empty/favorites and optional Invite. Exact @handle discovery and request/accept A↔B on server; accepted person opens a real C02 thread. No forced OS permission or phantom users.

**K14 — Phonebook permission/on-device list:** opt in after rationale, display locally named numbers with country-aware search, invite via system share, revoke permission, signed-out/account switch wipe, local-only contents absent from Gateway/AI/analytics. Android and iOS native build/permission declaration evidence required before calling phonebook qualified.

**K15 — Existing relationship across devices:** A/B accepted contact survives restart/new authorized phone, avatar/name refresh R18, favorites/status presentation correct, blocked/revoked entry cannot open a new send, wrong account protected; no duplicate conversation after tapping Message twice.

**K16 — Requests and abuse:** A requests B, B sees incoming, decline/accept, A cancels concurrently, stale revision fails; C blocked from lookup/message; opted-out hidden @handle produces generic safe response, spam/rate-limited, reporting works; no enumeration via existence timing or search results.

**K17 — Invitation/referred signup:** invite a device-only friend with chosen app; link handles installed/not installed, stale/refused/expired and OTP sign-in, preserves no private DM contents, prevents account spoof/replay/automatic contact acceptance.

**K18 — Data, language and accessibility:** 10k contact fixtures with duplicates/Unicode/RTL and names from Hausa, regional number formats, low-data/offline/reconnect; paginated/virtualized list p95 measured on cheap Android, keyboard/large fonts and screenreader focus; imported device-only metadata not copied to server.

**K19 — Cross-surface identity and paid action:** Person found in Talks/accepted Contacts can open human chat; AI 'invite Musa' proposal re-resolves exact permitted C01 user and reviews before sending; contextual Wallet transfer requires verified userId, server quote and fresh financial approval and never uses device phone number as recipient automatically.

**K20 — Privacy lifecycle:** delete account, unfriend/block, rename, opt-out discoverability, revoke Contacts OS permission; invalidated cache/search/avatar/media URL/push tokens and no stale unauthorized linked content after refresh or account switch. Legal financial audit retention remains handled separately.

**Every K13–K20 requires real authenticated A/B (and unauthorized C where relevant), C01/C02 DB constraints, Flutter widget + device tests, bounded network/error handling and exact execution evidence.** CI #457, active R/C drafts and physical device tests remain blockers until run. K13–K20 are **additional evidence overlays**, not independent R/C completion.

## G. Status and release criteria

As of this audit, `main` has **no merged `contact*` Flutter feature or phonebook plugin** in the inspected recursive source tree. C01's exact-handle contacts management exists in **draft PR #468**, including a Flutter `HumanContactsScreen` that is intentionally not yet mounted to final Chats root. It is source progress, not release availability. Other C02–C05, R17/C08 integration drafts must be reconciled and actual live server/handset tests executed. Never advertise phonebook matching or "contacts already imported" before OS permission plus qualified server/device results. For v1 **accepted Masanawa contacts directory + explicit consent/requests + exact handle + invite-only optional local phonebook is the minimum release target**.
