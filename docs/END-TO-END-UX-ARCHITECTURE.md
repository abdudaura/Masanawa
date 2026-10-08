# Masanawa: Unified End-to-End Mobile Experience Architecture

Status: **complete target architecture recommendation / awaiting explicit owner sign-off on the navigation change**, 2026-10-08. This document is a design integration contract for R01–R19 and C01–C08, **not a claim that any feature is implemented, verified, or approved for release**.

Canonical source of existing approvals: `CONTINUE-HERE.md`, `PRODUCT-NORTH-STAR.md`, `TALKS-PRODUCT.md`, `MOBILE-SCREEN-ARCHITECTURE.md`, `APP-SHELL-CONTRACT.md`, `MOBILE-READINESS-PLAN.md`, `COMMUNICATIONS-EXTENSION-PLAN.md`, `VOICE-FIRST-INTERACTIONS.md`, `CONSUMER-SERVICES.md`, and `DEFAULT-AI-PERSONAS.md`. Discussion: #462/#463; CI execution remains blocked under #457. **Until the owner approves the revised target, existing approved Home · Agents · Wallet · Talk remains authoritative and no code lane should unilaterally rename or relocate it.** Once approved, implement toward this *single final architecture*, not a temporary shell followed by a second redesign.

## 1. Final information architecture: one considered choice

**Recommended permanent four destinations: Home · Chats · Wallet · Assistant.**

| Destination | Singular job | Default content / primary action | What does not belong there |
| --- | --- | --- | --- |
| **Home** | Discover and host **public human-led Talks** | Explore / Live Talks as existing vertical full-width feeds; **Start public Talk** creation action | Private DM thread, crypto payment, agent directory replacing the feed |
| **Chats** | Communicate with **people**, find/continue AI conversations | Recent **People** DMs by default, easy search and **New message**; immediately visible **Masanawa Agents** and **Twins** sections; clearly typed Person/AI conversations | Public audience comments or an ambiguous Send-money composer arrow |
| **Wallet** | See and control money/services | Separate fiat, Credits, creator earnings, crypto by asset/network; **Crypto** then data/airtime/electricity/TV; precise contextual actions, history and receipts | Duplicate provider ledger or mandatory AI wait before reading balance |
| **Assistant** | Ask **Gwani or Gwana** to help or take authorized cross-app action | Private voice-first workspace, **Type instead**, deliberate mic; show contextual tasks/results | Public Talk room or automatically active microphone |

**Why rename bottom `Talk` to `Assistant`?** Public human-hosted `Talk` is the primary Masanawa content object. The earlier bottom `Talk` is *private AI assistance*, not public Talk. Labeling the destination `Assistant` removes this semantic conflict, while public buttons continue saying `Start Talk`, `Join Talk`, `Listen`, and the assistant can still present `Talk to Gwani` within the screen. This is a **recommendation that changes the previously approved label** and must be explicitly decided at the design gate. If the owner keeps the bottom label `Talk`, all other placements remain identical and every screen/deep link must explicitly say **Private assistant**; do not let independent windows choose their own names.

**No fifth root tab**, no Rooms or Skills/Workflow browser, no utility dashboard, no replacement of public Talks with generic status posts. White/light + lively WhatsApp-like green, approved logo, header Activity bell/profile avatar, consistent typography, short controls, and screen-reader/localization support remain mandatory. This changes *placement*, not product authority, economics, or existing backend object identity.

## 2. Screen composition and tap locations (freeze before dependent UI work)

### Home: one public-Talk destination
- Top app bar: small Masanawa identity, **Search**, **Activity** bell and **Profile** avatar; content tabs **Explore** and **Live Talks**. Search covers Talks, People, Masanawa Agents and Twins with visible result-type filters.
- The sole Home FAB is **Start Talk**. It opens the existing composer to choose a title, optional participants and authorized settings; **Go Live** remains a separate explicit action. A human Host must be present; free human Seats and paid Expert/Twin Seats retain their exact controls.
- Talk cards: tap to listen/replay; contextual Follow Host, Message Host, Share and Join, where real permission/service is available. Separate **Request a speaking Seat** from **Message the person**; a DM does not bypass the Host.
- Public Talk screen: one adaptive Host/Speaker/Audience/replay route, role-specific controls. Gift, sponsor, Direct Twin, Ask, Raise Hand, report and audio controls remain visible as applicable. Inviting a person may open their profile, select a person with an authenticated invite contract or send a DM with a real invitation; none implicitly grants a Seat.
- Entering private Assistant from a live Talk creates a visibly private, permission-scoped mode. Never mirror the private mic, wallet/card text, DM content or responses into the public stage. Define how listening/microphone focus hands over and returns; public listening may resume, but public capture must not overlap private capture.

### Chats: one messaging destination, no buried AI marketplace
- Top: **Chats** heading, search, and a visible **New message** action. Main list initially prioritizes actual human threads with avatar/handle, short preview, timestamp, unread marker and exact pending/sent/delivered/read state where supported.
- Directly visible adjacent navigation: **People · Masanawa Agents · Twins** in a persistent small segment/filter, or an equally visible single-row selector validated on small screens; switching does *not* silently mix person IDs, AI character IDs and Twin public IDs. **People** is the Chats default.
- **Masanawa Agents** shows the full server-approved seventeen personas' available profiles/search and previous AI conversations; **Twins** shows public discovery, private Talk/Type, owner management and hired-seat entry. No character/Twin disappears when the old Agents root is removed. Offer **My Twin** in its owner/profile context too. A paid AI Seat always requires explicit quote and confirmation.
- Person profile primary contextual actions: **Message**, **Follow** and (if live) **Listen live**; adapt to two rows at narrow text sizes. Message is disabled or replaced with a request/eligibility explanation if identity/privacy policy disallows it; self-profile goes to Edit, not DM.
- Real person DM screen: other person's name/profile and verified context, message list, compact composer with emoji, attachment, mic/record **or** send (not overlapping buttons), voice review/playback, retry and readable status. Keep wallet transfer behind clearly labeled **Transfer** in attachments/overflow, **not** the send arrow. A DM with Gwani/Gwana should link to Assistant / AI persona chat explicitly and not be falsely labeled a human contact.
- New message opens privacy-aware human search; no silent phonebook import or publicly enumerable private identifiers. Group chat and calls are **not promised** by C01–C08 (unless separately scoped); do not put inert call/video/group controls in this release.
- Cache recent messages locally per account for near-instant display; lazy-page old messages and media, sync safely in background; revoked users cannot keep protected media authorization. No backup/restore screen requirement, but durable server history remains mandatory.

### Wallet: short, distinguishable finance journeys
- One Wallet tab: **native fiat**, **Credits**, **pending/available creator earnings**, and **crypto asset/network balance** visually distinct; no misleading combined value. Read-only balances/history load independently of assistant startup.
- Approved shortcut order: **Crypto** → **Data** → **Airtime** → **Electricity** → **TV/Cable**. Within Crypto offer qualified Deposit, Buy, Convert, **Send to Masanawa user** and external Withdraw with separate labels; services remain only Billing/Crypto families.
- Generic `Send` is disallowed without specifying currency/ledger. Use `Send crypto`, `Send Credits` or `Transfer to Masanawa user` *only for actually qualified capabilities*. A DM **Transfer** launches the same canonical, recipient-prefilled **but not preconfirmed** Wallet task.
- All financial entry points (Wallet, DM, private Assistant, profile contextual action) converge on **one** authenticated server quote/authorization/confirmation/idempotent execution/receipt pipeline; switching surface never creates another transaction ID. Confirm exact person, asset, network, amount, fee, expiry, market/KYC/AML eligibility and available balance. A text/voice reference like “send it to her” can prefill a person only if the active context resolves uniquely and confirmation displays identity.
- Reconciliation, timeouts, unknown outcomes, refunds, pending states and return-to-caller destinations are product-visible. No on-chain promise for internal book transfers; no provider or regional capabilities inferred from static UI.

### Assistant: one operator, both voices, all modalities
- Private assistant destination labeled **Assistant**, with Gwani/Gwana switch or profile setting, active task card, visible context and **Talk / Type** actions. Do not spawn a second AI executor per product surface.
- Anywhere contextual action opens a **private sheet** of the same task or navigates to the same Assistant state, retaining caller route, draft and task ID. Do not add a permanent floating assistant button on top of Home Start Talk FAB or Chats New message. Use a contextual header action/menu/assist chip with tested touch targets.
- Assistant can search/discover, draft and (after authorized review) send human DMs, manage Talks with actual Host rights, handle Twin/profile/settings as allowed, and quote/execute *qualified* Billing/Crypto. A third-party DM never becomes model input except with explicit narrow user action. User must see or hear **recipient and exact terms** before sensitive sends; financial execution always needs fresh deliberate consent and required authentication.
- Spoken, typed and tap journeys share one durable task contract; voice-first does not mean voice-required. Mic permission denial, noisy environment, RTL/large font, Hausa/code-switching and quiet-user journeys work. No browser-TTS substitution or background listening. Leave-by-back/close is safe and preserves outcomes.

### Header/profile/notifications
- Header **Activity bell** is for public Talk activity, Seat invitations, follows, gifts, earnings and platform notices. **DM unread** appears on Chats and conversation rows (with system notification where authorized), not duplicated as a second noisy Activity stream.
- Profile avatar opens the **You hub**: edit full avatar/name/handle/bio; My Talks, My Twin, Saved Talks, creator earnings, Settings, account security/deletion. Wallet root already exists: You can link to it but must not duplicate wallet balances as an independent authority.
- Search and profile links resolve an exact People/Agent/Twin type. Settings owns privacy, DM requests/blocks, clear local cache, notification previews and account deletion. Private media is never put on a lock screen by default.

## 3. Route / identity mapping: must be settled before C02/C03/C05 and R17/C08 code integration

**Verified current-code collision:** `apps/mobile/lib/src/router/app_router.dart` redirects old `/chats` to `/home?tab=talk` (private AI), and `/chat/:id` opens a **character** conversation; `apps/mobile/lib/src/screens/chat/chat_list_screen.dart` is an AI-thread list. `twin_home_shell.dart` renders **Start Talk** FAB on indices 0 *and 1* (Home and Agents); moving tab 1 to Chats without relocating the FAB is wrong. `person_profile_screen.dart` lacks Message; `ai_chat_screen.dart` polls wallet every 12 seconds when mounted. None of these observations establish test/device behavior.

**Contract to implement, names illustrative until shared router owner freezes them**:
- `/home` → public Explore/Live; `/talk/create` and `/talk/:id` → **public** Talk.
- `/messages` → human Chats list / People mode; `/messages/:conversationId` → authenticated human DM only; `/messages/new?to=<stable public user ref>` is an untrusted *draft prefill* resolved server-side, not authorization.
- `/agents` and `/persona/:publicId` → visible Masanawa Agent/Twin discovery or profile within Chats mode (no broken links); `/chat/:id` remains legacy **AI character** chat until a versioned migration with tests; **never** repurpose character IDs as person/conversation IDs.
- `/assistant` → private Gwani/Gwana work; `/home?tab=talk` and legacy `/chats` must retain their **historical** meaning through explicit compatibility redirects if new Chats destination uses another URI. Do not simultaneously assign two meanings to one URL. `/home?tab=agents` remains a valid alias to the Masanawa Agents section.
- `/wallet`, `/crypto`, `/billing`, `/u/:handle`, `/activity`, `/you`, `/settings`, `/my-twin` and old receipt/deletion/share links retain behavior. Financial deep links enter authorized task state **without** executing.
- Define typed **PersonRef / PersonaRef / ConversationRef / PublicTalkRef / FinancialTaskRef** discriminators. A display name, handle, AI character ID and conversation ID are never mutually substitutable. Version notification links, account-switch protected routes and return destination arguments.

**Back/return stack** is a test contract, not incidental router behavior: Home → public Talk → private Assistant → return same Talk; person profile → DM → same profile; DM → transfer quote → receipt → same DM without resending; Wallet shortcut → same private task → Wallet after completion; Chats → Agent/Twin profile → Chats mode and scroll position. Browser/notification deep link after sign-in must resume only the correct authenticated destination. No payment/mic action on route reconstruction.

## 4. End-to-end interaction matrix (each is required verification; not a promise of existing code)

| Start | Action | Required destination/feedback and return |
| --- | --- | --- |
| Home card | Open public Talk | Human-hosted live/replay view; back to same feed location |
| Home FAB | Create public Talk | Single composer, explicit Go Live; permissions failure/rejoin; host controls |
| Talk stage | Invite person | Authenticated eligible recipient; free invite/seat request; host approves separately |
| Talk stage | Sponsor Expert/Twin | Verified persona candidate + fee + explicit paid Seat consent; correct refund |
| Talk stage | Ask Gwani privately | Assistant sheet, mic domain isolated; return without leaking private content |
| Search person | Open profile → Message | DM or honest privacy/request state; block/self correctly handled |
| Chats → People | New message | Contact search → one real human conversation → encrypted/protected local cache and server history as specified |
| Chats → Person DM | Send voice note | Separate mic, review, bounded upload, recipient playback, deny/retry/outbox |
| Chats → Person DM | Transfer | Same Wallet crypto task, exact recipient/terms/consent, both receipts, back to DM |
| Chats → Agents | Talk to Expert | Private AI character conversation, independent of human DMs and paid Seat |
| Chats → Twins | Explore/manage/hire | Public persona/owner Twin/AI Seat contracts retained, discoverable in <= intuitive direct steps |
| Wallet → crypto | Deposit/Buy/Convert/Withdraw | Qualified server-driven task, correct balance/receipt/unknown/failure |
| Wallet → bills | Data/Airtime/Electricity/TV | Correct selected intent, voice/text/tap, durable quote/funding/recovery |
| Assistant → message | Draft and send to person | Exact recipient + editable message + deliberate consent + authoritative delivery |
| Assistant → money | Transfer to a person | No guessed network/recipient, fresh server quote, risk reauth, once-only settlement |
| Activity / push | Open invite / DM / receipt | Typed deep link, secure login gate, back to prior task |
| Profile | Edit photo/identity / Twin | Real persisted updates, cross-surface identity, retry/crop/remove/owner rules |
| Low network / restart | Browse history | Fast indexed cached list/thread, paginated catch-up, pending markers, account isolation |

## 5. Conflict register and binding resolutions

1. **Bottom `Talk` label versus public Talks:** *Recommend rename to Assistant.* Owner decision is the only remaining product naming approval; implementers must not improvise. Keep spoken action “Talk to Gwani” and public “Start Talk”.
2. **Agents tab disappears in Chats:** Agents and Twins become **immediate persistent Chats modes**, not deep Settings menus. Restore recent AI threads inside relevant modes, old URLs and all creator/paid-seat actions.
3. **FAB collision:** Home's **Start Talk** is not inherited by Chats. Chats exposes **New message**; no payments or AI operations masquerade as a composer send.
4. **Ambiguous `/chats` alias:** preserve historical private AI behavior, create a typed human-DM route namespace and explicit compatibility tests before linking pushes.
5. **Duplicate financial flows:** wallet/DM/Assistant actions use the *same* canonical quote/confirmation/task and receipt. Do not let voice actions use a shortcut or local money mutation.
6. **Public stage/DM/assistant audio and data:** separate streams and permissions at every transition, including back, microphone-denied and background playback.
7. **Search privacy and identity:** tagged People/Agent/Twin/Talk results; message request/deny/block policy server-side; no silent contact import or cross-type ID coercion.
8. **Activity vs DM notifications:** one canonical event/outbox, correct unread reconciliation and privacy-safe push; no duplicate Activity + DM clutter.
9. **Slow Chat startup:** local-first human DM cache, paginated history, lazy media; 12-second `ai_chat_screen.dart` wallet polling is a **candidate to profile and condition**, not disable blindly while a payment is active.
10. **Services list ordering:** `MOBILE-SCREEN-ARCHITECTURE.md` S80 says Bills then Crypto, while approved `APP-SHELL-CONTRACT.md` Wallet says Crypto first. Freeze **Crypto → Data → Airtime → Electricity → TV/Cable** on Wallet; keep independent Services lists consistent if retained.
11. **Public Host vs person message:** Message or Invite does not admit anyone to a public Talk; free human speaking Seats always need Host authority. Paid Expert/Twin Seat separate.
12. **Snapshot plans vs runtime truth:** merged docs and PRs do not prove R01–R19 or C01–C08 end-to-end readiness. Feature flags can control release exposure, **not** justify intentionally implementing a throwaway UX architecture.

## 6. One-build target, safe delivery order: design now, integrate without a second redesign

This order is *dependency order*, **not a recommendation to build one shell then discard it**:
1. **Design gate (before dependent code ownership):** accept/reject only the recommended tab label `Assistant` vs old `Talk`; freeze four destinations, human-vs-AI routes, typed IDs, profile Message/Chats Compose/Home FAB placement, notification badges, global assistant placement, finance terms and return-stack contracts **together**. Apply approved outcome consistently to APP-SHELL-CONTRACT, MOBILE-SCREEN-ARCHITECTURE, R17 and C08.
2. **Shared contracts first:** integration owner signs route map, authenticated DM/contact membership, realtime cursors, voice media boundaries, wallet task and AI action adapters, token/session/account cache lifecycle, localization strings; C01/C02/R17 owners avoid editing same router/profile simultaneously.
3. **Parallel independent lanes:** C01 identity/privacy, C02 repository/API/contract, C05 cache/performance foundation, R06/R08/C06 financial authority, C07 typed action registry; C03 and C04 follow real DM contracts. Existing R01–R19 work continues, without invalidating its foundations.
4. **One end-to-end integration pass:** integrated shell target and all links after the above route contract; one coordinated migration from old tab indices/links, with reversible routing and feature flags for **deployment safety** only. No final-UX renaming deferred until after the new features go live.
5. **Verification:** automated auth/privacy/retry/migration/route tests, Flutter analyzer/widget/a11y/RTL, low-end Android measurement, two real user devices, LiveKit/Gemini boundary, notification pushes, Postgres concurrency, provider reconciliation, regression against all R01–R19 and C01–C08. Missing signing, external provider or hardware evidence is explicitly **BLOCKED**, not passed. Owner Work's shared Actions incident #457 must allow real steps before claims of green CI.
6. **Release:** only when key journeys above work together; staged rollout is acceptable to protect users, but *does not replace* this single cohesive design or justify a knowingly short-lived navigation arrangement.

## 7. Exact definition of design-complete and done

**Design-complete** only if the owner-approved four labels, root entry points, all primary actions, conditional states, human/AI/talk/financial distinctions, errors, history, privacy, back/deep link matrix, low-end UX and shared contract ownership are agreed and documented before implementing conflicting screens. Do not let C01–C08 windows rename the navigation independently.

**Implementation DONE** only with concrete commit SHA, focused test commands/results, DB migration/backfill/recovery proof, integration environment deployment SHA, actual handset audio/DM/finance where permitted, measured performance, localization/a11y evidence and privacy/security qualifications. Never call a documentation review an implementation or no-rework guarantee: external provider and usability findings can require refinements, but these contracts prevent predictable wholesale redesign.
