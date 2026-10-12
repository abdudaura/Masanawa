# Masanawa UI audit and refinement design

Status: PLANNED. Source inspected; no product implementation, runtime UI, device, provider or deployment verification performed by this audit.

## Goal and authority

Deliver the owner's requested white-header, green-accent messaging experience in the existing Flutter app. Correct shared authentication alignment, add real Chats/Calls search, replace legacy Status, connect Rooms, and simplify the complete Wallet/Crypto journey. Preserve working behavior, privacy and canonical financial authority. No platform rewrite or fake data.

Current owner instructions, AGENTS.md (2026-10-11), and CONTINUE-HERE.md (2026-10-12) govern: Chats · Status · Wallet · Calls · Rooms; Chats is ordinary launch default; explicit incoming-call/deep-link destinations remain intact. Older October 9 documents prescribe a different shell and human contacts: those portions are superseded, not instructions to restore retired features. Masana are AI contacts. User status publishing is not assumed supported.

## Inspected source snapshots

| Ref | SHA | Finding |
| --- | --- | --- |
| main | 682827b7712518e78657bae3d3dc9b8956806b83 | Current calls/native/group/incoming source, but legacy Status/Rooms mounting |
| integration/rebuild | 523b1511ebff58ce10d5e90cb2478680970e0d2b | PR674 authenticated Status composition and C10 inbox search; different shell; Rooms integration gate |
| lane/rooms-membership-invites-20261011 | f2951e3a11f09dc5b2ac4c391e30d1fac22cc57f | Canonical membership/invites, questions, lessons, subscriptions and saved-lesson source; handoff reports feature tests, not main/device integration |
| lane/status-media-binding-20261012 | e7588974af9483ca1fe6fe84a044463dd5011a0f | Canonical image authorization/signing additions, active media work |

These are inspection snapshots, not permanent execution baselines. Refresh refs/PRs and `.factory/leases.json` from factory/claims before editing. Do not overwrite other windows' updates. Acquire exact paths under project coordination; shared composition belongs to AF00, money to AF01, auth to AF08. Plan creation does not claim implementation paths.

## Findings verified in source

| Requirement | Evidence | Disposition |
| --- | --- | --- |
| Center language | name_screen.dart, otp_screen.dart, password_screen.dart and phone_login_screen.dart each use AlignmentDirectional.centerEnd around LanguagePickerButton | Missing across all four routes; current code is edge-aligned, which appears on the left in RTL |
| Chats header | screens/chat/chat_list_screen.dart explicitly sets u.brand, white foreground and MasanawaWordmark(light:true) | Overrides the already-white global AppBar theme |
| Wordmark | ui/components/masanawa_wordmark.dart defaults to size 20, weight 900 and a small Agents suffix; non-light color uses bright green | Need readable darker brand-green on white and slightly larger balanced type; preserve intentional brand lockup until reviewed |
| Chats search | main ChatListScreen has no search; integration features/masana_chat/masana_chats_list_screen.dart has a controller, 350ms debounce and authenticated inbox query | Reuse existing search authority on the selected composed shell; prevent duplicated search/services |
| Status | main FiveTabShell mounts TalkHomeScreen and New status links to /talk/create | Wrong underlying resource, not merely wrong color; integration has authenticated MasanaFeedScreen and kind-aware media |
| Calls search | main CallsScreen loads paginated real history with account/token identity fencing but has no query UI | Add shared search presentation without losing history, native reporting, group calls or incoming state |
| Branch conflict | integration CallsScreen differs from main by 29 additions and 325 deletions | Never replace the newer main Calls screen with this older placeholder during Status integration |
| Rooms on main | screens/rooms/rooms_screen.dart reads talkFeedProvider(live), filters isLive, and opens Talk detail; GatewayTalkTransport converts /talks 404 into [] | A missing legacy endpoint can masquerade as genuinely empty Rooms; deployed cause still requires runtime confirmation |
| Rooms on integration | app/masanawa_consumer_shell.dart mounts _RoomsIntegrationGate | Source exists elsewhere, but is not connected to root navigation/backend composition |
| Bottom navigation | theme uses textMuted for unselected icons/labels; selected label and icon use brandStrong; indicator transparent | Partly neutral already, but selected text must be near-black, icon bright green, and unselected contrast/weight stronger |
| Wallet root | FiveTabShell embeds WalletScreen without funding/send callbacks; embedded WalletScreen has no header | Main wallet tab cannot expose optional actions just by restyling |
| Wallet semantics | wallet_screen.dart displays Spendable Credits, Cr, pending/available earnings from credit DTOs | Conflicts with MSN target; cannot silently rename units or imply a financial migration |
| Crypto | finance/crypto_wallet_screen.dart contains a gradient balance panel, asset strip, four large action tiles and history card | Real capability-gated Buy/Receive/Convert/Withdraw flows exist and must survive redesign |

This is a targeted source audit, not a claim that every app screen or deployed endpoint has been exhaustively verified. Historical audit findings must be reproduced on the eventual composed SHA before being called current defects.

## Selected approach and alternatives

Recommended: targeted reconciliation onto fresh main, preserving its newer Calls authority, adopting existing authenticated Status/inbox and canonical Rooms modules selectively, then shared presentation refinements. Do not wholesale-merge an older shell or copy entire historical branches.

Recoloring main alone is smaller but leaves legacy Status/Rooms data flows and missing searches unresolved. Replacing main with integration/rebuild brings substantial source but risks regressing Calls, retired-feature policy and financial behavior. A rewrite adds unnecessary risk and is excluded.

## Shared visual system

- White light-mode main surfaces and headers; dark charcoal body text/actions. Preserve existing dark-mode token support if subsequently enabled; the current app explicitly mounts light theme.
- Reuse token colors: brandStrong #075E54 for readable wordmark, brand #25D366 for selected icons and restrained highlights; textPrimary #111B21 for selected labels and principal text. Bright green is not small body text on white.
- Main wordmark target 24 logical pixels, weight 700, normal balanced spacing; header standard 56px with 16px horizontal inset and 24px actions. At narrow widths move secondary actions to overflow before clipping the wordmark.
- Shared main-header factory/component supports optional actions and bottom content. Detail screens retain descriptive titles and back buttons using the same surfaces/typography; they do not all need a wordmark.
- Search field target 44–48px, light neutral fill, 16px side inset, search icon, accessible clear action and 14–16px input; no heavy borders or shadow. Query state stays with its tab and clears on account change.
- Navigation: white background and subtle top separation; 24px icons; 12px labels; unselected charcoal with weight 600, selected near-black weight 700 and bright-green icon. A small translucent green indicator is optional only if it improves selection recognition without a bulky background.
- Existing 4px spacing grid and minimal dividers; minimum interactive targets 44px. Large text, RTL, safe areas and keyboard behavior are part of acceptance.

## Search behavior

Chats searches actual authorized inbox/conversation identifiers: display name, stored conversation title and supported character/group identifiers. Only expose group results if the canonical chat model actually supports them; group calls do not establish group messaging. Preserve pin/archive/read/order behavior. Use the existing server query on the composed inbox and an immediate local projection for available/offline rows where safe. Distinguish no conversations, no query matches, offline cache and denied access. Fence stale results as soon as the query changes, not only when the debounce fires.

Calls searches display name, character identifier, call reference and human-readable supported state/direction. Current history is cursor-paginated: searching only the loaded page cannot be called complete history search. Prefer a bounded server query using the existing account-authorized history reader, retaining the query in cursor scope and cancelling stale requests. If only a loaded-results filter is delivered initially, state that scope visibly and report it as partial until complete-history lookup is implemented. Preserve load-more, deduplication, retry, call lifecycle revision refresh and token/account fences.

## Status

Use existing authenticated Masana-only feed/media authority, not live Talk discovery. Present compact author/avatar/update rows with timestamps, AI identity and restrained rings where meaningful. Existing following/discover behavior and media/detail/comments/save actions remain connected. Recent/viewed sections require a real viewer read state; add account-scoped view state or omit the viewed section rather than invent it. Do not imply expiry that the server does not implement. The current product supports Masana publishing, not user publishing: do not restore an unsupported My status composer or /talk/create shortcut. An account row may navigate to supported account information, with truthful wording.

## Rooms

Connect the existing persistent Rooms discovery/joined/detail/member/lesson source through authenticated per-account clients and canonical route factories. Reuse membership/entitlement, invite, moderation and saved-lesson safeguards. Review public exports/dependencies and forward-only migrations before root composition; do not change applied SQL.

Treat unavailable backend, denied access, offline/load failure, no published Rooms and no matching search as distinct states. An available Discover/Join action is appropriate; Create appears only if server capability and current product policy support it. Paid access remains verified by the existing subscription authority. Optional live audio does not substitute for persistent Rooms.

## Wallet and Crypto journey

Wallet: white shared header, compact truthful balance and freshness/error area, small supported actions, compact Billing/Crypto entry rows and flat activity list. Balance does not dominate the screen. Reserved/pending amounts stay distinct. Preserve current legacy credit denomination until the existing MSN authority is reconciled; never relabel Cr as MSN. Reconciliation is a functional prerequisite to claiming an MSN wallet, not a visual task.

Crypto: show actual supported asset/network rows, balances when supplied, selected route and compact capability-gated Buy/Receive/Convert/Withdraw controls. Remove gradient and oversized tiles. The DTO primarily exposes selected-route balances; do not calculate a fictitious aggregate portfolio or market valuation. Missing values remain unavailable, not zero. Internal Send appears only with a supported canonical route.

Apply the same typography, spacing, action hierarchy and flat receipt/status rows to existing deposit dialogs, conversion quote/review/confirmation, withdrawal quote/review/confirmation, secure checkout/status refresh, send sheets and receipts. Keep amounts exact, fee/expiry/network/recipient warnings visible and uncertainty distinct from failure. No new financial authority, provider activation or altered authorization/idempotency.

## Additional scoped improvements

Fix search/result accessibility, long names and large balances, avatar image failure fallbacks, mobile keyboard/safe-area overflow, localization of new copy, and error-vs-empty distinctions. Preserve scroll/query state across tabs and clear private state across accounts. Recheck historical About/version/clear-chat findings before including them in a separate supporting-screen patch; no unrelated settings rewrite.

## Verification and remaining dependencies

Baseline and final checks must use exact recorded SHAs. Test 320, 360, 390 and 430 logical-pixel widths, large text, English/Hausa/RTL, loading/error/empty/populated states, search clear and stale responses, pagination, tab/back/deep links and account switching. Execute meaningful Flutter widget/controller and affected backend tests, analyzer/typecheck and builds. Android device/audio/payment-provider qualification is separate from source/widget verification.

This session has cloned the repository and inspected source/branches/docs. Flutter and Dart are not currently on PATH; no analyzer, widget test, UI render, APK build or financial/provider request has been run. Existing branch handoffs report tests but are not newly executed evidence here. No changes are claimed complete.

Read references: AGENTS.md; CONTINUE-HERE.md; docs/MULTI-WINDOW-WORK.md; docs/AUDIO-FIRST-PRODUCT-20261009.md; docs/AUDIO-FIRST-SCREEN-SPECS.md; docs/MSN-WALLET-P2P-CONTRACT.md; docs/AUDIO-FIRST-INTEGRATION-CONTRACTS.md; docs/WHOLE-APP-SOURCE-AUDIT-20261009.md; docs/BACKEND-STORAGE-OPERATIONS-20261009.md; docs/FLUTTER-RELEASE-AND-SHOREBIRD-POLICY.md; apps/mobile/docs/BUILDS.md; branch-local Status and Rooms qualification handoffs. Older freeze/nondeploying rules are superseded by current development policy. Signed release/OTA compatibility remains a distinct release concern.
