# Whole-app source audit — 2026-10-09

Status: SOURCE_REVIEWED / IMPLEMENTATION_PARTIAL / RUNTIME_NOT_RUN. This supplements, rather than closes, the [completeness audit](AUDIO-FIRST-COMPLETENESS-AUDIT-20261009.md).
Source baseline: `44d75253cd9196db395662187a10aaaf39cc31c1`. All 49 Dart files under `apps/mobile/lib/src/screens/` were fetched and their surface controls scanned; critical Settings, router, profile and backend lifecycles received deeper review. Fetching/scanning is not exhaustive line-by-line security verification. Non-screen modules, pending branches and the unavailable owner's local APK require further examination. Draft #497 Settings/profile were compared separately. No handset, live database, storage account or provider was exercised.

## Concrete source findings

| ID / priority | Evidence at baseline | Effect | Closure / owner |
| --- | --- | --- | --- |
| SA01 / P1 | Settings “Clear all chats” directly calls AI provider clearAll without a confirmation; same action remains in #497 | Label suggests all conversations; destructive scope is ambiguous | Confirm named scope, distinguish local cache from server history and private/AI threads, preserve financial receipts; AF14/AF06 |
| SA02 / P2 | Settings About says “Live Talks, AI Experts, Twins and services”; version and footer are hardcoded 1.0.0 | Old positioning and unreliable support diagnostics | Current wording and installed version/build from platform metadata; AF14 |
| SA03 / P2 | Settings profile header is not an edit action; main shows initials, draft #497 reads public avatar and has upload/crop profile work | Existing improvements could be accidentally rebuilt or lost | Recover draft first; tappable account header, verified save/readback and image failure fallback; AF14 |
| SA04 / P1 | Settings main lacks account-security, sessions, block-list, storage/data/audio and recovery destinations; #497 adds LanguagePickerButton | Security/privacy/audio controls have no coherent home | Account/Settings contract and real endpoints, retain language work; AF14 with AF08/AF05 |
| SA05 / P2 | Settings support choice displays “Gemini” voice internals; radio selections have per-item saving flags | Provider detail leaks into ordinary preferences; concurrent writes need review | Compact persona picker, one pending mutation, authoritative readback and account fencing; AF14 |
| SA06 / P1 | Notification preference is persisted by MobilePushService; Settings has a single async toggle | Persistence exists, but pending/error/device-vs-account semantics need qualification | Honest OS permission vs app preference, failed registration rollback/retry, token rotation/logout; AF14/AF00 |
| SA07 / P1 | Router constructs MyTalksScreen without its optional onOpenDraft callback | Draft tile path may be inert | Connect typed audio draft route, resume local/server upload safely; AF09 supplies hook, AF00 composes |
| SA08 / P1 | Main router/chat list still reflects AI-centric old shell and old aliases; wallet uses a direct MaterialPageRoute in chat list | New navigation contract is only documented; Back/deep-link inconsistencies remain | Exact five semantic tabs, consistent wallet origin/return, independent stacks; AF00/AF06 |
| SA09 / P1 | You hub includes My Talks, My Twin, Saved Talks, Wallet & earnings, Bills, Crypto and Settings; search uses live Talk/Expert/Twin results | Duplicate finance/service paths and stale discovery taxonomy | Small profile/library hub; Wallet and Gwani destinations reuse canonical screens; typed public search; AF14/AF09/AF07 |
| SA10 / P0 | Real deletion routes/dialog and identity lifecycle exist; lifecycle explicitly delegates settlement/processor cleanup to integration worker | Request/phase change is not proof of complete erasure or reconciled funds | Recover deletion worker drafts, trace obligations and media cleanup before completion; AF14/AF15/AF01 |
| SA11 / P0 | Gateway package start runs migrate before main; presence startup script delegates to that start; migration runner checks checksums with advisory transaction lock | Older backend audit's startup assertion is stale; actual deploy execution remains unverified | Preserve migration foundations; rehearse fresh/upgrade DB and verify deployed command; AF00/AF15 |
| SA12 / P1 | Railway gateway healthcheck is /healthz; readiness has schema/version checks; worker default DB readiness uses foundation roots | Process health alone does not certify each feature schema/job | Probe actual readiness and job-owned schema coverage; do not mark healthy==ready; AF15/AF00 |
| SA13 / P0 | Inspected worker main composes database readiness and managed HTTP lifecycle, not all proposed financial/publication/deletion jobs | Planned scheduled automation is not established by this entrypoint | Inventory actual jobs in drafts/other processes, connect persistent leases/outbox and restart evidence; AF15 plus job feature owner |
| SA14 / P0 | Avatar and replay S3 adapters exist | Existence of signed object methods does not qualify chat/room audio access, retention or restore | End-to-end object lifecycle, current authorization before URL issue, restore DB+objects; AF15/AF05/AF09/AF10 |

P0 gates affect money, privacy or durable operation; P1 closes essential journeys; P2 improves clarity. These are planning priorities, not claims that every existing implementation is broken.

## Every supporting surface has an owner

The [screen inventory](WHOLE-APP-SCREEN-INVENTORY-20261009.json) enumerates all 49 baseline screen files, including sheets/components; no file is marked E2E verified.

| Surface / controls | Preserve and refine | Binding and acceptance | Owner |
| --- | --- | --- | --- |
| Splash, phone/email entry, name/OTP legacy routes | Neutral launch, numeric-password phone choice, working email; secure legacy links | Real session, recovery, revoked/expired credentials; no claimed phone ownership | AF08/AF00 |
| Chats list and private AI composer | Pin/archive/rename and existing text; human vs Masana identity, recorder/attachments and transfer cards | Durable history/outbox, account switching, blocked recipients, unseen count and two-device audio | AF06/AF04; shared AI screen AF00 |
| Directory, Explore, search | Public Masana/people/audio-post discovery; clear AI badge | Typed result IDs; no private message or wallet search leakage; all callbacks connected | AF07/AF09 |
| Activity/invitations | Existing acceptance and filter flows | Typed comment/follow/room/contact/call events, read state, idempotent accept, stale/forbidden destinations | AF14; event producers respective lanes, push AF00 |
| Own profile, public human/persona profiles | Draft avatar/crop, bio/handle, honest follow/contact actions | Stable user vs character ID, save/readback, blocked visibility, image failures and signed access | AF14/AF07/AF12 |
| My Talks, saved library, drafts | Published-post libraries and resumable drafts | Save/remove/fetch, processing/failed upload, delete confirmation and missing-resource handling | AF09 |
| Create/live Talk, polls/questions/seats/host sheets | Legacy resources remain typed; reuse live controls only for qualified Rooms | No old stage as default public feed; roles, consent, moderation and retired-link compatibility | AF10/AF00; post composer AF09 |
| Gifts, send-credit, receipts | Retain obligations/history; no silent Cr→MSN relabel | Adopted economic mapping and canonical ledger/receipt; incompatible purchase actions hidden with reason | AF01/AF03 |
| Billing and crypto forms | Preserve real transports; Gwani menu and Wallet entry reuse them | Catalog/fees/quotes/consent, uncertain provider recovery, exact asset/network validation | AF04/AF03/AF01 |
| My Twin, clone/share, owner-access/session flows | Optional paid/owned persona features require explicit retain/adapt/retire disposition | Do not erase owner sessions or prices; distinguish human paid session from AI; reconcile old credit obligations | AF00 with AF01/AF07/AF12 |
| Settings and You | Detailed contract below; no new bottom tab | No inert rows, scope-correct deletion/cache controls, support diagnostics | AF14 |

Before dispatch, each owner maps each visible control to route/API/repository/permission/state/tests. Use loading, empty, offline, denied, saving, uncertain, failed/retry and success states where applicable; distinguish unavailable capabilities from placeholders. Test large text, keyboard, screen reader, RTL/languages, reduced motion, dark mode, slow networks, back gestures and logout/account changes across sheets as well as full pages.

## Settings design and implementation contract

Use an editable avatar/name/handle header followed by concise grouped rows, with secondary pages/sheets for depth. Match the app's existing spacing/color/type tokens; no crowded dashboard. Settings is reached through a consistent profile/avatar action from the shell and Chats, with correct return origin. No Settings bottom tab.

| Group | Essential controls | Source of truth / required behavior |
| --- | --- | --- |
| Account & security | Profile/photo, linked phone/email and verification state, change numeric password, recovery, device/session list and revoke | Auth/profile server authority; recent reauthentication for sensitive edits; never mutate account identity only locally. AF08 owns credential mechanics; AF14 consumes them |
| Privacy & safety | Contact discovery/request policy, blocked users, report/support path | Server-enforced permissions affect search, contacts, messages, calls and media. Blocking is not deletion or a reversal of settled transfers |
| Notifications | Messages, Rooms, Talks/creators and calls preferences; private preview option | Server/account preferences plus per-device OS permission/token. OS-disabled state gives guidance, failed save does not falsely show success |
| Audio & data | Autoplay opt-in/preference, Wi-Fi download policy, cache size/clear, recording permission guidance | Device preferences and bounded cache. Clearing cache must not discard unsent notes/drafts or receipts; shared audio focus remains AF05. Do not offer quality/transcript options before supported |
| Language | Centered icon-only picker entry where required; localized current choice within settings | Retain #497 picker; saved locale, accessible label and RTL; label change does not alter credential or money parsing |
| Gwani / support persona | Compact default-persona selector preserving Gwana and real server choice | Do not confuse Gwani destination with persona identity. No provider-model IDs in consumer text |
| Help & about | Actual support destination, privacy/terms, installed version/build and safe diagnostic copy | No dead links or hardcoded release metadata; redact tokens, conversation contents, account/payment secrets |
| Account lifecycle | Sign out, request data export where supported, delete account/status | Confirmation/reauth; export is authenticated, private, expiring and honest about retained records. Deletion waits for financial obligations and cleanup. Unsupported export needs real capability decision, not fake download |

Preference contract: classify each field as account/server, device/local or OS-owned. Account values are authenticated, versioned and returned authoritatively; local values use an account namespace when private and survive app restart as intended. Writes have pending/error/readback handling and stale-response account fencing. Defaults must be stated and migrated, not inferred from a false switch. Logout revokes/unregisters as intended and closes realtime/audio, then clears account caches/outboxes safely; retain only explicitly device-wide settings.

Acceptances SA-A01..08: edit/avatar readback; preferences restart/second device/failed-save; session revoke and linked-credential safety; blocked-user cross-feature denial; OS notifications plus token rotation; safe scoped clear with drafts preserved; deletion with open escrow/withdrawal/failed cleanup; correct installed metadata and reachable support. AF13 records NOT_RUN until executed.

## Cross-cutting work that screens alone miss

Private media access and deletion, conversation pagination and reconnect cursors, account-fenced offline drafts, notification token ownership and payload privacy, moderation/report resolution, support and incident escalation, worker/admin RBAC, request IDs and typed errors, rate limits/quotas, metrics with redacted payloads, durable receipts and financial reconciliation all need contracts and qualification. See [backend/storage plan](BACKEND-STORAGE-OPERATIONS-20261009.md).

No completeness guarantee: this audit identifies concrete overlooked work and an explicit next inspection map. Re-run against recovered local source, integrated drafts and deployed configuration before claiming readiness.
