# C09 — Private human voice and video calls: complete product and integration specification
**2026-10-09 · newly owner-approved scope. Source in an isolated draft branch; NOT enabled in production.**

## Decision, positioning and exclusions
The owner's 2026-10-09 approval supersedes the older C01–C08 plan's **deferral** of direct calls (and only that deferral). Keep exactly **Talks · Chats · Assistant · Wallet · Agents**. Private **one-to-one person-to-person** calls are entered from **Chats > accepted human conversation**, nested Chats > Calls history, and the contact profile. Public Talk stages, AI Live/Gwani/Gwana, and voice-note recording are different audio domains and cannot be joined together by a UI switch.

**CORE:** audio/video incoming/outgoing, answer/decline/end, mute, camera privacy, camera flip, audio route, a real durable missed/declined/completed call log, secure short-lived LiveKit credentials, blocked/revoked protection, two-phone behavior, low-bandwidth fallback. **LATER / expressly not implied:** groups, PSTN/SIM calls, SIP, calls to AI twins, recording, screen sharing, hold/transfer, PiP, switching audio↔video inside an established call, full E2EE and web/iOS background CallKit/ConnectionService before qualification. Avoid a sixth root tab and an independent call identity database.

## Product pattern research (retrieved 2026-10-09)
- WhatsApp's official 1:1 help describes a call action inside a person thread, accept/decline, mute, camera toggle and end. **Adopt** these familiar basics, not copyrighted UI; **avoid** its broad group/screen-share feature set in C09. https://faq.whatsapp.com/1862285217468140/ https://faq.whatsapp.com/1153602608602452/
- WhatsApp's Android notes recommend data saving under poor connectivity and document permission and ring patterns. **Differentiate** with an explicit consent-first accepted-contact-only policy, no phone-number discovery, and audio-first defaults on budget phones. https://faq.whatsapp.com/1862285217468140/
- Existing Masanawa's Flutter dependency `livekit_client ^2.13.0` and custom server-side LiveKit HS256 Talk credential issuer are already present on main. **Reuse SDK and auth patterns**, but *never* share a public Talk room/token/participant namespace.

## Provider economics / portability (retrieved 2026-10-09)
- **LiveKit Cloud:** official page lists Build $0, Ship starting $50/mo, Scale starting $500/mo; media participant minutes/egress and entitlements must be priced in the actual account before scale. https://livekit.com/pricing
- **Agora RTC:** official pricing lists a free package of 10,000 standard minutes per month and approximately $0.99/1,000 standard audio minutes, HD video equivalent ~$3.99/1,000 video participant minutes; prepaid terms and proxy tiers apply. https://www.agora.io/en/pricing/video-calling/ https://github.com/AgoraIO/docs-portal/blob/main/content/docs/en/realtime-media/video/reference/pricing.mdx
- **Daily:** official per-participant-minute rates vary by volume, with advertised audio $0.00036–0.00099 and video $0.0015–0.004; verify current tier and minimums. https://www.daily.co/pricing/video-sdk/
- **Decision:** reuse existing LiveKit for pilot, because one existing SDK and infrastructure outweigh a premature provider change. Preserve a `HumanCallMediaIssuer` boundary so Agora/Daily/self-hosted LiveKit remains a reversible later choice. Do not provision chargeable resources automatically. TCO examples: 100 two-person calls × 5 minutes = **1,000 participant-minutes**; 1,000 such calls = **10,000 participant-minutes**; 10,000 = **100,000 participant-minutes**. Apply real audio/video mix, TURN/egress, logs, bandwidth, support, tax and redundancy to each provider's billing units before activation. These are workload inputs, not quotations or guaranteed monthly totals. **Cost safeguards:** no recording, cap connected calls at 2h, max two participants, metrics only; alerts at 50/80/100% budget, operator kill switch and expiry.

## Screens: exact route, hierarchy, controls, states and outcomes
All screens operate under the C01/C02 canonical `tenantId,userId,conversationId`; remote names/avatar come only from authorized human contacts, not LiveKit tokens. No phonebook permission. New C09 screens are nested and never displace the root five-tab bar except during a deliberate full-screen call.

| Screen | Entry and visual hierarchy | Controls (accessibility labels) | Server truth, errors and return behavior |
| --- | --- | --- | --- |
| **SC-C09-01 Human chat/header** | Chats → existing C02 person DM: peer avatar/name, voice/video action icons top right, existing message list/composer unchanged. | **Voice call**, **Video call** 48dp tap areas; disabled if contact not accepted, blocked, no authenticated connection or call already in progress. | Tapping sends `POST /messages/calls` with stable client request key. No pre-call mic/camera activation. Busy 409/429 and offline show calm, local error. Back returns to same chat and draft. |
| **SC-C09-02 Outgoing ringing** | Modal/nested screen: person name/avatar, explicit `Calling…`, kind, data-use note; no deceptive timer before acceptance. | **Cancel call**, **Open chat** (preserve call state), safe Back cancels only after confirmation. | Poll `GET /messages/calls/:id` while foreground. 45s timeout → Missed, reject → Declined, no active media until accepted. On connectivity loss status becomes **Unconfirmed**; retry state by ID before another dial. |
| **SC-C09-03 Incoming** | Foreground incoming banner or screen: verified human name, audio/video badge, no autoplay camera. Background R14/FCM private generic hint with app-open/sign-in validation. | **Answer**, **Decline**, **Back to chat**. Answer checks OS mic permission and video camera separately; if camera denied, offer voice-only decline/retry decision, never silently upgrade video. | Only intended callee can accept, only while ringing, single atomic accept; server handles race with cancel/timeout/block, otherwise 409. Deep link includes opaque call ID only, no token/name/phone; background full-screen/lockscreen admission needs platform approval and device proof. |
| **SC-C09-04 Active voice call** | Full-screen quiet view: remote person avatar/name, `Connecting… / Connected / Reconnecting` and elapsed from confirmed server `answeredAt` timestamp. | Bottom controls **Mute/unmute**, **Speaker/earpiece**, **End call**; Bluetooth route via OS; large tap targets, volume buttons retain system behavior. | Media token only after accept and current auth/admission; connect via private LiveKit room. End revokes room; permission lost, blocked, hangup, media timeout close mic and show status. Call history always server-read. |
| **SC-C09-05 Active video call** | Remote video fills safe area; floating local preview (not overlaying end) and clear avatar fallback if camera off or track absent. | **Mute**, **Camera on/off**, **Switch camera**, **Speaker**, **End**; no recording/screen share; camera off before navigation away. | Camera starts **only after** explicit accept and OS permission, allow audio if remote camera absent; fail-closed camera/mic on logout, app switch or revoked rights. Low-bandwidth user can turn camera off. |
| **SC-C09-06 Calls history** | Chats → Calls nested header, simple recent list with direction, voice/video icon, time, outcome and callback action. | **Call again** (new stable request ID), **Return to chat**, no batch erasure or account mixing. | `GET /messages/calls?limit=30`, server filters blocked/revoked. Empty→“No calls yet”; loading→skeleton; offline→no stale hidden contact exposure, Retry visible. |
| **SC-C09-07 Privacy/permissions** | Settings → Chats/Calls: short consent explanation, link to OS mic/camera permissions, block/report via R15. No confusing new recording toggle. | **Manage microphone/camera permission**, **Block contact** canonical C01/R15, **Report** existing R15; no auto-answer. | Denied/limited/permanently denied permission leaves human text and incoming decline available; no opening system settings without user gesture. |

**Layouts:** mobile first; 320dp, large text, Hausa/English labels for integration's R11 arb/intl catalog, RTL mirroring, 48dp minimum hit targets; dynamic status semantics/live regions. Never hide End behind keyboard. Skeletons rather than spinner without context, predictable back transitions, no blank screens on a killed/background return. Build real touch and screenreader verification on Tecno BF7 and one second Android.

## State machine and authority
```
authenticated chat + accepted contact → RINGING (45s, cancel/decline/missed)
RINGING -- callee accept and still authorized --> ACTIVE (bounded 2h)
ACTIVE -- either participant end / revoked permission / expiry --> ENDED
RINGING -- caller cancel --> CANCELLED
RINGING -- callee decline --> DECLINED
RINGING -- no answer / timeout --> MISSED
```
No backward transitions, duplicate request creates no second call, old accepted callback cannot resurrect a canceled invitation. One active/ringing call **per user** within a tenant, serialized by ordered PostgreSQL user locks; 429 anti-spam gate required before integration. Mutations and metadata are in PostgreSQL, no client-predicted delivered/ringing truth. Never route calls through AI, wallet, creator gifts, or public Talk stage.

C09 service uses canonical bearer principal via existing `PlatformCustomerSessionAuthorizer`, a **fresh** C01/C02/R15 permission adapter plus a SQL same-transaction accept/block check, and a non-optional LiveKit revoker on end. Provider JWT is narrowly scoped to an opaque private room, publishes only mic or mic+camera, no screen/data/record/admin, expires after 30–90s; JWT expiry alone **does not revoke a joined LiveKit connection**. Integrator must implement provider room close on end/timeout/block/account deletion; reconciliation worker and outbox must retry this on provider failure. TLS/WSS, media transport and server-to-server JWT signature are necessary; **do not advertise end-to-end encryption**.

## API & persistence contract (C09 v0)
- `POST /messages/calls` body `{conversationId,requestId,kind:"audio"|"video"}` → 201 `HumanCall`.
- `GET /messages/calls` with limit 1–50 → `{calls:HumanCall[]}`.
- `GET /messages/calls/{callId}` → `HumanCall`, 404 if not member/revoked.
- `POST /messages/calls/{callId}/accept|decline|end` body `{}` → atomic transition, stale=409.
- `POST /messages/calls/{callId}/media-token` body `{}` → short-lived `CallCredentials` **only when active, authenticated and still permitted**.
- Internal `human_call_signal_outbox`: opaque `callId`, recipient, event type for R14 worker; never include contact phone, DM text, JWT, unmasked name. Signal can prompt a poll; **it is not readback authority**.

C09 schema draft resides in `services/gateway/src/human_calls/schema.sql` and must be incorporated **once** by the migration owner after chosen C01 0016, C02 0017 and C03 0019/0020. No production migration without disposable PG18 test+review. Transactional SQL keeps recipient authorization checks with state changes. R14 push worker, GET /calls polling fallback, and F12 root integration must jointly prove incoming background calls; FCM alone cannot guarantee killed-app ringing or Android foreground-service rights.

## Golden journeys (tests are acceptance requirements, not a claim of passing)
1. **K21** A accepted B, A taps audio, B receives authenticated invite, accepts, both join distinct private LiveKit room, mute/speaker/end works, server history says ended.
2. **K22** Video call B grants camera/mic, both render remote/local tracks, camera flip/off, network switch, reconnect, end closes both tracks.
3. **K23** Block/decline/revoke/time-out between ring→accept or token→join immediately rejects and forcibly terminates media; no cross-tenant or C third-party join.
4. **K24** Duplicate request, simultaneous A↔B and A↔C calls, two-device answer, repeated end, stale notification, app kill/restart and clock skew never double dial or show counterfeit connected state.
5. **K25** Incoming push foreground/background/terminated, Android 12+ permission denial/limited battery, data saver, silent/DND, lockscreen privacy, app sign-out/switch; never leak a name/voice or auto-open mic/camera.
6. **K26** 320dp and large font/RTL/accessibility, low-network quality, poor/absent Wi-Fi, handoff away from public Talk/private Gemini/voice-note recorder with exclusive microphone/camera focus.
7. **K27** Budget/quotas (calling abuse cap, LiveKit participant+room metrics), expiry/cleanup outbox, cancellation failure recovery, incident kill-switch, secured secrets and backup/restore.

**Reality gate:** This draft is **PARTIAL_IMPLEMENTATION** until F12/C01/C02/F16/R14 and native OS controls are composed and real two-device, provider, Postgres, security and release tests pass. Do not show an enabled call icon in the distributed APK before those gates.
