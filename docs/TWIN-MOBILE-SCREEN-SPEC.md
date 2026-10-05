# Masanawa Twin Mobile Screen Specification

Status: implementation target, 2026-10-05.
Canonical product overlay: `docs/PRODUCT-TWIN-ECONOMY.md`.

## Navigation

Primary bottom navigation has exactly four product destinations:

1. My Twin
2. Explore
3. Activity
4. Wallet

Settings is secondary through profile/avatar/menu.
A public deep link can bypass the four-tab landing and open a twin conversation.

## My Twin

Purpose: make the user's twin feel owned and valuable without exposing agent internals.

### Header
- twin avatar;
- display name;
- public/private status;
- Share action;
- compact settings/edit action.

### Main actions
- **Talk to my twin** — opens the existing chat screen in owner-customization context.
- **Teach my twin** — same conversation surface, optionally seeded with a teaching prompt;
  do not create a second chat system.
- **Share twin** — link/QR/share sheet.

### Compact summary
Only useful signals:
- visitors;
- conversations;
- money earned;
- pending owner requests.

Do not add likes/follower counts or vanity streaks.

### Profile/customization
Initial setup may ask:
- name;
- languages;
- short style choice.

Everything else should be learned conversationally or edited in a simple advanced sheet:
- avatar;
- public bio/interests;
- voice preference;
- discoverability;
- whether paid owner access is enabled;
- availability/price bounds for owner access.

### Existing files to evolve
- `apps/mobile/lib/src/screens/settings/clone_setup_screen.dart`
- `apps/mobile/lib/src/agents/creator_clone.dart`
- current clone onboarding controller/transport on active onboarding branch.

Target new files may include:
- `apps/mobile/lib/src/screens/twin/my_twin_screen.dart`
- `apps/mobile/lib/src/state/my_twin_state.dart`

Do not delete the stable onboarding transport until the new My Twin journey is verified.

## Explore

Purpose: discover people through their twins, not through posts.

### Content
- search field;
- compact twin cards;
- recent/relevant/popular categories only if deterministic and privacy-safe;
- no post feed;
- no likes/reposts/comments.

Twin card:
- avatar;
- display name;
- short owner-approved bio/interests;
- languages;
- voice availability indicator;
- optional owner-chat availability indicator;
- open conversation action.

### Existing files to evolve
- `apps/mobile/lib/src/screens/chat/masana_list_screen.dart`
- `apps/mobile/lib/src/agents/agent_directory.dart`
- `apps/mobile/lib/src/state/agent_directory_state.dart`

Target new files may include:
- `apps/mobile/lib/src/screens/explore/explore_screen.dart`
- `apps/mobile/lib/src/agents/twin_directory.dart`
- `apps/mobile/lib/src/state/twin_directory_state.dart`

Do not expose platform/support agents in public Explore unless explicitly intended.

## Twin conversation

Reuse `apps/mobile/lib/src/screens/chat/ai_chat_screen.dart`.

### Keep
- text/media;
- replies/reactions/search;
- attachments;
- streaming;
- existing Gemini Live/native audio;
- ShellDocument/actions;
- offline/retry/recovery;
- accessibility and message history.

### Product changes
- public twin text is free;
- header clearly says this is the owner's AI twin;
- paid voice is gated by quote/consent before billable session;
- small overflow/action surface for:
  - Gift / Bless;
  - Buy something;
  - Request owner;
  - View twin profile.

Do not put four persistent monetization buttons beside every message.

### Human-owner presence
If a future real owner session occurs in-app, UI must clearly switch identity/presence:
- "Abdullahi joined";
- never make AI output appear as owner-authored.

## Activity

Purpose: show owners what their twin is doing economically and socially without becoming
a surveillance screen.

### Sections
- Today summary;
- owner requests needing attention;
- recent events.

Event types:
- new visitor/conversation summary;
- purchase attributed;
- gift received;
- paid voice completed/refunded;
- owner chat requested/accepted/completed/expired;
- earnings settled.

Privacy:
- do not expose raw visitor chat transcripts in Activity by default;
- owner can inspect conversations only when product/privacy policy authorizes it.

Target files:
- `apps/mobile/lib/src/screens/activity/activity_screen.dart`
- `apps/mobile/lib/src/agents/twin_activity.dart`
- `apps/mobile/lib/src/state/twin_activity_state.dart`

## Wallet

Purpose: one simple money surface.

### Top
- Spendable Credits;
- Pending earnings;
- Available earnings.

### Actions
- Add money;
- Send;
- Withdraw (when eligible);
- optional Buy crypto / Bills shortcuts, but do not make them the product identity.

### History
Unified list with clear reasons:
- funding;
- transfer sent/received;
- purchase;
- commission;
- gift;
- paid voice;
- owner session;
- refund;
- withdrawal.

### Do not show
- Agent Float as a primary balance;
- fulfillment reserves;
- provider settlement accounts.

Target files:
- `apps/mobile/lib/src/screens/wallet/wallet_screen.dart`
- `apps/mobile/lib/src/commerce/wallet_transport.dart`
- `apps/mobile/lib/src/state/wallet_state.dart`

Existing creator economy DTO/state can be migrated then deprecated after parity:
- `apps/mobile/lib/src/agents/creator_economy.dart`
- `apps/mobile/lib/src/state/creator_economy_state.dart`

## Reusable sheets

### Send Credits
Recipient -> amount -> confirmation -> receipt.

### Gift / Bless
Suggested amounts + custom amount -> confirmation -> receipt.
Do not generate creator commission from the gift's internal transfer itself.

### Paid voice quote
Price/charging unit + spend cap -> Start.

### Request Owner
- duration;
- owner availability choices;
- quoted price;
- payment-hold explanation;
- Request.
Then status card: pending / accepted / scheduled / completed / refunded / expired.

## Settings

Retain:
- account/profile;
- notifications;
- privacy;
- security;
- language;
- help;
- sign out/delete account;
- advanced twin preferences where needed.

Move out:
- creator economy;
- Agent Float;
- Skill management;
- platform/support agent selection unless still needed for a separate support setting.

## Router integration

`apps/mobile/lib/src/router/app_router.dart` is a shared integration file and should
be edited by one integration window only after individual screens exist.

Target routes:
- `/twin`
- `/explore`
- `/activity`
- `/wallet`
- `/twin/:publicId` or canonical deep-link equivalent
- `/chat/:characterId` preserved internally as needed
- `/settings`

Exact public identifier contract must be decided by Identity/profile owner; never expose
raw internal IDs merely for convenience if a stable public slug/ID is required.
