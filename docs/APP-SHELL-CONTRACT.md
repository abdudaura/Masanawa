# App Shell Contract

## Contacts route clarification — latest owner decision 2026-10-08

The root shell is **still exactly Talks · Chats · Assistant · Wallet · Agents**. **Chats→New message must open a full nested human Contacts directory**, not a sixth tab or AI personas list: real accepted Masanawa contacts, pending requests, Add by exact @handle, search/favorites and authentic C02 human conversation opening. Optional OS phonebook viewing/invitations are **voluntary device-local actions**, not a prerequisite, and cannot implicitly resolve a phone number into a verified Masanawa user or crypto recipient. All contacts and person profiles share current C01/C02/R15/R18 privacy authorization; correct old routes/back/scroll/drafts/deep links. Full [Contacts requirements](CONTACTS-AND-ADDRESS-BOOK-EXPERIENCE-20261008.md), [R/C recovered owners](ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md) and [K13–K20](CONTACTS-AND-ADDRESS-BOOK-EXPERIENCE-20261008.md#f-integration-and-security-testing-mandatory-contacts-journeys). C01 draft #468 supplies a real but unmerged initial contacts screen; R17/C08/F12 sole shell owner mounts the approved final version.


> **Owner requirements completeness:** Before implementing this five-tab target, verify placement, conditional actions, Gwani/Gwana switch, legacy routes, contextual wallet handoffs and user experience with `OWNER-REQUIREMENTS-TRACEABILITY-20261008.md` (P/N/T/M/A/W/Q references) and `WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md` (J01–J11). They extend acceptance but **never** create a sixth tab or another payment/message authority. Every R17/C08 change must prove the old routes/back stack and full camera-shy, low-literacy, human DM, creator earnings, billing and crypto journeys.


Status: **OWNER-APPROVED FIVE-TAB TARGET — 2026-10-08; Flutter app migration OPEN / UNVERIFIED**.
Supersedes the previously approved Home · Agents · Wallet · Talk root arrangement and earlier conditional Home · Chats · Wallet · Talk proposal **for planned architecture**, not a claim that the current APK already follows the new navigation. Implement **one** final shell through R17 + C08, with active-PR/file ownership coordination; no throwaway intermediate navigation. See **END-TO-END-UX-ARCHITECTURE.md** for full destinations, action placement, route compatibility and acceptance.

## Bottom navigation

**Exactly five destinations from left to right: Talks · Chats · Assistant · Wallet · Agents.**

1. **Talks** — *the previous Home Explore/Live Talk feed*, now a single public audio Talk destination with Explore/Live sub-tabs, full-width vertical cards, human-hosted stage, recordings/replays and green **Start Talk** FAB. Never substitute a private AI conversation for public Talk.
2. **Chats** — human-to-human private text/voice-note/media conversations only, local-first durable recent history, unread indicator, contact search and **New message**. No AI-character chat list and no transfer on the message Send arrow.
3. **Assistant (CENTER)** — the one primary **private Gwani/Gwana chat interface**, visual center emphasis, deliberate voice or complete typing/tap path, switch **Gwani ↔ Gwana inside the same conversation**. Same durable user-owned assistant workspace and task state; record per-message persona attribution. Never start mic, public Talk or spend on tab entry. Qualified action/quote/confirmation and session privacy still server-owned.
4. **Wallet** — native fiat / Credits / available vs pending creator earnings / crypto assets kept separate, actual history and qualified crypto/bill actions. Exact receipts/status without waiting for AI. Money never merges across domains.
5. **Agents** — full **Masanawa Agents** and **Twins** directory/search, availability/profiles/private character conversations, My Twin management, and explicit public Talk Seat sponsor/invite actions. Discovering an Expert or Twin does not mean switching the privileged Gwani/Gwana Assistant persona or authorizing a paid Seat.

**There is no separate Home tab, fifth feature duplication, hidden sixth navigation or Rooms/Skills/Workflows directory.** Talks inherits previous Home's Explore/Live full-width discovery and becomes the first landing root. Chats contains only human private messages; Agents retains AI persona/Twin discovery, Assistant is the *only* centrally supported Gwani/Gwana operator conversation, and Talks owns all public audio. Assistant is deliberately centered with two tabs on either side.

## Header, creation and profile

Root header: Activity/notification bell + profile avatar; search where relevant. Bell opens Talk/social/payment/platform Activity with useful unread states; DM unread belongs to Chats (not duplicated inbox). Profile avatar opens You/profile/Settings; full avatar upload/replace/crop/remove and handle/display name/bio persist and refresh cross-surface (R18). My Talks, My Twin, Saved Talks, Earnings, security/privacy/notification/language/support/deletion remain accessible from You/Settings, not new root tabs.

**Start Talk** green FAB appears on the **Talks** discovery root, opens public Talk composer, and requires later explicit Go Live. Never present it in Chats, Assistant, Wallet or Agents, or as an ambiguous global action. **New message** is the primary Chats action. Contextual agent invitation, qualified transfer and shopping actions remain inside relevant profile, Talk or Wallet surfaces. No controls cover mic/keyboard/bottom labels; measure 320dp widths, large text, RTL and accessible targets.

Public Talks remain human-led, free human speaker Seats with Host admission, paid AI Seats only by explicit quote/consent, moderated participation, gifts and qualified replays. A human DM never automatically admits a person to a public Talk.

## Single central Assistant and contextual entry

Inside **one** Assistant chat UI, show active **Gwani** or **Gwana** identity and a visible switch; persist chosen identity for the user and attribute replies by actual persona. Preserve the shared authorized assistant conversation, drafts and pending task identity across switching. Changes of persona cannot auto-approve or replay a sensitive payment, expose other users' DMs, import a private Expert/Twin chat, or create a new hidden assistant thread. Offer Type instead, deliberate native-audio mic control, accessible cards and recoverable action states. A globally reachable 'Ask Assistant' affordance reuses the same authenticated task from Talks, Chats, Wallet and Agents without starting the mic or changing public audio permissions.

Agents tab **does not duplicate** this root Assistant: an Expert or Twin's separately authorized persona chat opens by name from its profile, without inheriting Gwani/Gwana's universal operator privileges or disguising a paid public Talk Seat as private chat.

## Wallet service ordering and handoff

Show **Crypto** first; then **Data bundles**, **Airtime**, **Electricity**, **TV/Cable**, plus actual qualified Add funds, Send crypto/other explicitly named currency, external Withdraw and History. Billing and Crypto are the **only** standalone services. Server capability/account/market/asset/network/KYC policies determine availability. A shortcut can preselect a verified Assistant/Wallet intent, asks only missing details, but never pays, authorizes, turns on mic or changes voice permissions when opened.

DM **Transfer** opens the same qualified Wallet internal crypto task with exact authenticated recipient, asset/network, server terms, fresh explicit risk-appropriate confirmation, once-only ledger settlement and both receipts. A generic chat Send arrow is **text/voice-note only**. Internal book transfers are not automatically an on-chain send. No credits/fiat/earnings/crypto mixing or model-authoritative balance.

## Route continuity and state restoration (must pass tests)

Use **named** destinations and typed IDs, never reuse old numeric shell indices:

- **Talks** root new '/talks'; old '/home' and '/home?tab=home' map to Talks Explore. Keep '/talk/create' and '/talk/:id' public stage semantics unchanged.
- **Chats** human-only root new '/messages'; authenticated DM '/messages/:conversationId'. Prior '/chats' is currently a *private AI* alias and **must map to Assistant for backward compatibility**, not silently become human chat. No '/chat/:characterId' repurposing: that is an AI persona thread.
- **Assistant** root '/assistant'; legacy '/home?tab=talk', old '/chat' and historical '/chats' aliases map to this private Assistant workspace, preserving sign-in and appropriate deep-link behavior.
- **Wallet** '/wallet' and '/home?tab=wallet'; **Agents** '/agents', '/masana' and '/home?tab=agents'. Preserve '/persona/:publicId', '/my-twin', '/u/:handle', '/activity', '/you', '/settings', '/crypto', '/billing' and valid receipts/invite links; legacy '?tab=create|activity|you' retains its historical action.
- Notification links and tasks use typed **PersonRef, PersonaRef, ConversationRef, PublicTalkRef, FinancialTaskRef**. Correct auth on launch/switch, no wrong-account cached content or public/private deep-link misrouting. Back returns to real prior screen with scroll, drafts, Talk role and unfinished task identity preserved.

## Acceptance, ownership and evidence

**Only an explicitly claimed R17/C08 shared shell integration owner** updates Flutter root tab enum/router/nav/localization and shared deep link interfaces, coordinating active R work and C01–C07 owners under MULTI-WINDOW-WORK.md's five-minute lease. Underlying R01–R19 and C01–C08 requirements are unchanged and still separately checked. Do not infer mobile implementation from this target document.

Pass five-tab screen-reader/RTL/low-end Android tests, Chats authentic two-account text/voice/cache/push tests, Gwani→Gwana→Gwani switch preserving scoped history and nonduplicate approval, Agents/Twins discovery and paid Seat gating, Talks live/audio/gifts/replay, Wallet funding/crypto/billing exact quote, back and deep-link compatibility. Document source/build/deploy/device evidence, fail closed on restricted capabilities, and do not count CI #457 zero-step failures as passing application tests.
