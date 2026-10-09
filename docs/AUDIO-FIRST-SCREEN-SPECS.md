# Masanawa audio-first screen specification

Status: approved product direction with implementation and local-source reconciliation outstanding. Updated 2026-10-09.

This specification records the owner's latest direction. It does not certify that any screen, payment provider, audio path or publishing job works. The owner reports a locally fixed application and built APK; that source and APK must be reconciled before implementation. Earlier conversation observations about GitHub code are not evidence about that local build.

## Navigation and names

The directory is **Masana & Contacts**. New chat opens it; Contacts is not a bottom-navigation destination. Assistant must occupy the middle position.

Proposed integration default: **Talks · Chats · Assistant · Wallet · Rooms**, with Calls under Chats. This is a recommendation resolving six destinations into five tabs, not explicit owner approval to remove the previously requested Calls tab. Record the owner's final decision before treating Calls placement as final. Directory, Assistant, Talks and wallet requirements below do not depend on that decision.

Tab switching preserves each destination's scroll, filters, draft and navigation state. Detail pages use one consistent short transition. Back returns to the originating screen and preserves context; links resolve through canonical destinations and tested legacy aliases. Repeated taps cannot open duplicate pages. Audio behavior follows the shared focus policy below.

## Screen inventory and controls

| ID | Screen | Minimum layout and controls |
|---|---|---|
| UI-01 | Launch | Neutral native splash and Flutter launch background, approved logo, consistent Android 12+ and night resources; no blue flash. |
| UI-02 | Authentication | Log in / Sign up; Email / Phone selectors; email fields or international phone field and obscured numeric password; submit, password visibility, recovery, validation. Centre the language icon without visible text; retain accessible label and touch target. |
| UI-03 | Account recovery | Available verified recovery methods, recovery status and session invalidation confirmation. Unverified phone alone cannot recover an account. |
| UI-04 | Talks feed | Following / Discover; vertically paged audio-post cards with avatar, name, AI badge where applicable, follow, title, waveform, duration, play/pause, seek progress, likes, comments, plays, save, share and report/block. No endless live sessions. |
| UI-05 | Talk comments | Bottom sheet with thread, comment composer, submit, pagination, report and own-comment deletion. Feed context remains intact. |
| UI-06 | Create Talk | Record, pause/resume, recording duration, cancel; preview, trim, delete/re-record, optional title, publish; visible upload/processing state and recoverable draft. Initial proposed cap: three minutes, configurable and not owner-final. |
| UI-07 | Creator profile | Persona/bio, AI disclosure, follow/unfollow, published Talks, report/block. Public profiles expose no wallet activity. |
| UI-08 | Chats | Search, conversation list, unread state, new chat, favourites/pins where already supported; proposed Calls filter. |
| UI-09 | Masana & Contacts | Masana / Contacts filters, shared search, favourite/recent entries, alphabetical people list, invitation only where supported. Masana show role and AI identity; people show stable account identity. Existing twins are not silently relabelled as human contacts. |
| UI-10 | Conversation | Compact identity header, call and menu; messages, voice bubbles with duration/seek/speed, transfer cards; composer with attachment/emoji outside input, send when text exists and microphone otherwise. Hold recording, slide cancel, lock, preview/delete/send. |
| UI-11 | Assistant | Centred floating vertical billing choices above composer: Airtime, Data, Electricity, TV/Cable, reflecting actual available products. Selection replaces choices with relevant next choices. Compact current-draft summary, Back/Change/Cancel and typed/voice input. |
| UI-12 | Purchase review / receipt | Recipient, product, MSN total, fees, quote expiry and explicit authorization; pending/success/failure/uncertain receipt and status refresh. No success before confirmed execution. |
| UI-13 | Calls | Recent/missed/outgoing list, start call via directory, ringing/connecting/active/reconnecting/ended states, mute, audio output, hang up and clear availability errors. Placement pending navigation decision. |
| UI-14 | Rooms | Joined/discover list, create/join where enabled; room details, members, audio-note history, composer, leave/report and moderator controls. Optional live audio belongs here, subject to provider qualification. |
| UI-16 | Settings / safety / support | Preserve working profile/avatar, language, security/device sessions, notification controls, account deletion/export and support. Private account data stays separate from public creator profiles; show pending deletion/support status and recovery. |
| UI-15 | Room session | Speaker/listener roles, join/leave, mute, request-to-speak, participant list, moderator removal and connection status. Do not expose this control as functional before verified implementation. |

Wallet screens and escrow contracts are specified in [the canonical wallet/P2P plan](MSN-WALLET-P2P-CONTRACT.md). Conversation transfer sheets and receipts must reuse that canonical wallet flow rather than create a separate money implementation.

## Common state contract

Every applicable screen implements these states deliberately; do not show a permanent spinner or a raw technical exception.

| State | Required behavior |
|---|---|
| Loading | Stable skeleton or progress in the affected area, no duplicate actions. |
| Empty | Clear explanation and one relevant action: follow creators, start chat, join room or record first post. |
| Error | Specific user-facing failure, safe retry and preserved inputs; distinguish uncertain payment from failed payment. |
| Offline | Clearly marked cached content, retained local drafts and explicit pending state. No fabricated delivery/payment success. |
| Permission denied | Explain the exact permission and offer retry/settings where appropriate. Never label provider failures as microphone denial. |
| Stale | Refresh availability/quotes/member permissions before action; expired purchase quote needs a new review. |
| Blocked/restricted | Explain unavailable action without leaking private account or moderation details; prevent contacting blocked recipients. |
| Rate limited | Show retry timing when supplied and preserve draft; no automatic retry storm. |
| Account switch/logout | Clear private cache, stop audio and invalidate old subscriptions; never carry a draft, payment, feed interaction or recording into another account. |

Controls need readable labels, screen-reader semantics, adequate touch targets and reduced-motion behavior. Waveforms are decorative supplements to accessible duration and playback controls. Low-data mode avoids automatic audio fetching; transcripts are optional accessibility support, not a publishing prerequisite.

## Shared audio focus and diagnosis

One audio plays at a time. Starting recording, a call or live room session pauses feed and chat playback. Release recording resources after cancel, failure, navigation and logout. Resume listening only through a predictable user-visible action. Test output routing, Bluetooth/headphones, interruptions and reconnects.

Separate stages: permission → recorder initialization → local capture/playback → upload → retrieval/playback → live-session authorization → outgoing stream → provider response → speaker routing. Each has distinct diagnostic codes and useful errors. Logs include correlation IDs and safe stage metadata, never raw private audio, secrets or complete sensitive chat contents.

Do not require Gemini Live for ordinary recorded voice-note capture. A working local recording and upload path must remain independently testable from a live assistant connection.

## End-to-end journeys and acceptance

| Acceptance ID | Journey and observable completion |
|---|---|
| UX-A01 | Cold start in light/dark mode reaches auth/home without a blue native/Flutter flash. Language icon is centred and accessible. |
| UX-A02 | Email signup/login/recovery remains usable. Phone signup/login uses numeric password with server-side protection; UI identifies phone as unverified and does not treat it as ownership proof. |
| UX-A03 | Tab switching, nested detail, deep link and Back preserve expected state; repeated taps and account switching cannot duplicate or leak state. |
| UX-A04 | New chat opens Masana & Contacts; selecting a person or Masana opens the correct conversation with correct identity. |
| UX-A05 | Record locally, preview, send, receive on a second device, seek and change speed. Permission denial, upload failure and provider failure display distinct errors and retain retryable drafts. |
| UX-A06 | Start purchase through menu, continue with text or voice, change an earlier choice, review quote and explicitly authorize once. Both menu and conversational-only paths yield the same verified receipt. |
| UX-A07 | Interrupted or uncertain purchase resumes through status lookup without duplicate charge or delivery. |
| UX-A08 | Record/trim/publish Talk, observe processing, play from another account, follow, like and comment; restart/retry cannot create duplicate posts or counters. |
| UX-A09 | Scroll Talks with one active player, preserve position, respect low-data mode; block/report and moderation affect visibility appropriately. |
| UX-A10 | Room membership permits intended audio posts and denies outsider/moderator-only actions. Optional live session is independently qualified on two devices. |
| UX-A11 | Calls connect and recover on supported devices/providers; microphone/audio interruptions release resources and do not break subsequent recording. |
| UX-A12 | Chat MSN/crypto transfer reuses wallet authorization and receipts; retry is idempotent and public profiles contain no financial details. |

## Masana editorial and publishing design

Each Masana has a persisted persona, expertise, language, voice, emotional style, recurring formats and editorial boundaries. Treat laughter, crying, pronunciation and emotional delivery as audio qualities to listen-test, not guaranteed model capabilities. Mark AI-generated accounts and posts clearly. Fiction must not masquerade as a real personal experience. Fact, news, history and faith claims need appropriate sources; time-sensitive posts show their date.

Schedule: topic → persona script → source/fact and safety checks → Gemini speech generation → duration/playback validation → publish once. Store a canonical publication ID, schedule timezone, script version and provenance. Apply per-agent and platform budgets, maximum posts, duplicate prevention, retry limits and administrator pause. Failed generation never publishes an empty clip. User-facing content does not expose pipeline internals.

Sample editorial concepts below are proposed scripts to develop, not generated, scheduled or published audio:

| Persona direction | Sample concept | Delivery |
|---|---|---|
| Gwani, practical guide | Before sending money: three checks | Calm, useful, 60 seconds |
| Gwana, warm storyteller | The neighbour who returned a forgotten wallet | Clearly fictional, expressive, two minutes |
| Hausa humour creator | The family meeting that could have been a voice note | Respectful humour, 90 seconds |
| History creator | One lesson from an old trading city | Source-based, curious, two minutes |
| Learning creator | Three English phrases for today | Examples and pauses, 60 seconds |
| Technology creator | Why a microphone works in one app but fails in another | Plain explanation, 90 seconds |
| Reflective storyteller | A letter to someone starting again | Clearly fictional, gentle, two minutes |
| News explainer | What happened and what remains uncertain | Dated, sourced, restrained |
| Faith educator | A small daily act of kindness | Carefully sourced, respectful |

## Handoff evidence

Each implementation handoff names its exact commit SHA, owned paths, acceptance IDs passed, device/provider evidence, unresolved failures and integration dependencies. Screenshots alone do not prove audio, escrow, delivery or provider behavior. Reconcile local improvements before replacing a screen or declaring an old instruction completed. Superseded instructions can be archived with a pointer here; unfinished historical requirements remain traceable until explicitly resolved.
