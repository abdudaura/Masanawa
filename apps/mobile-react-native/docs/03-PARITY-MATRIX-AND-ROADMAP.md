# RN/Flutter/Web parity ledger and phased implementation roadmap

Key: PRESENT-SOURCE means files/routes exist on current main but no complete device/provider proof; DRAFT means unmerged branch work; TARGET means owner-approved behavior not yet demonstrated; DEFERRED means not a current production commitment. Parity is accepted behavior against one authoritative Gateway, not mirroring Flutter's obsolete navigation or copying every Dart widget.

## 1. Priority parity matrix

| Domain / trace | Flutter baseline at audited main | RN first delivery target | Web/desktop relationship | Blockers/evidence |
| --- | --- | --- | --- | --- |
| Account OTP/session, recover/logout (J10/11, R16) | PRESENT-SOURCE: secure session and refresh | P1 complete; actual device sign-in and logout | Same account via browser-safe auth policy, not copied mobile tokens | OTP qualified channels; multi-device session tests |
| Five-root navigation + legacy links (R17/C08, J01-11) | Four-tab old SOURCE; five-tab DRAFT #493/#497 | P1 approved FIVE-tab shell; no fake empty routes | Same 5 roles, sidebar at desktop | Work-integrated route contract and return behavior |
| Public Talks discovery/live/feed (R02/04/09/13, J01) | PRESENT-SOURCE | P2 feed/playback and then verified Host/Speaker media | Browser Talk listener/host parity separately qualified | LiveKit stage, interruption, replay consent |
| Human DMs/contact/privacy (C01-C05, J03/04/10/11) | TARGET; several DRAFT/duplicate branches | P2 only after server schema/consent/API/event convergence | Browser secure DM using same messages | #468/#472/#475/#473/#483/#478/#474/#476 consolidation |
| One Gwani/Gwana Assistant (C07, J02/07) | Existing private AI chat; target workspace DRAFT | P2 text/tap + tasks, P3 real Live audio | Same server conversation, browser platform audio adapter | Work-approved persona/session/action contract |
| Wallet/receipts/credits/NGN/earnings (R05/06/10, J05/08) | PRESENT-SOURCE; proof incomplete | P2 read-only authoritative projections, P4 guarded sends | One ledger and receipts across clients | no provider charges until qualified |
| Crypto/airtime/data/power/cable (R07/08, C06, J08/09) | PRESENT-SOURCE, provider and scope gated | P4 only compliant quoted confirmed path | Same exact quote/status/fee semantics | custody, KYC/AML, settlement, webhook, limits, region |
| Agents/Experts/Twins/My Twin (R03/18, J06) | PRESENT-SOURCE | P2 directory/details, P3 creator management | Same profiles, ID, commissioned seat rules | backend availability, pricing and proper role |
| Push/Activity/readbacks (R14, C03, J04) | FCM source PRESENT; qualifications OPEN | P3 RN device registration, foreground/background deep link | Web push independently approved and validated | provider credentials, APNs entitlement, privacy preview |
| Media attachments/voice notes/replay (R13, C04, J04/11) | Files, playback & draft voice-note source | P3 bounded upload/play/recovery | browser capability checks, same signed media | permissions, media expiry, duration, retention |
| Profiles/safety/locales (R01/11/12/15/18/19, J02/11) | SOURCE PRESENT; many DRAFT slices | P1 basic + P3 complete | Same user settings/role/safety | deletion, screen-reader, RTL, moderation evidence |
| Video calling/video Talks | No verified product approval or e2e on main | DEFERRED, discovery only after explicit decision | Different native/browser adapters if approved | product scope, permission, infrastructure, cost |
| WhatsApp/Telegram | Backend channels exist separately | P3 only channel-linked status / qualified handoffs | Reuse Gateway integration | no duplicate device-bridge |

No selected new client may erase Flutter's rights to supported API versions or require an existing Flutter user to switch apps.

## 2. Phases and exit gates

**P0 — Planning and contract inventory (THIS PR only).**
Record audited commit, source/target discrepancy, unresolved PR collisions, owned/non-owned files and requirements trace to J01-J11, R01-R19, C01-C08. Exit: plan review; explicit owner kickoff AFTER consolidation freeze; authoritative integration SHAs chosen. No RN dependency installed or shipped.

**P1 — Technology/native proof and secure foundation.**
Spike Expo dev builds/prebuild vs bare React Native using exact supported RN/React/Expo/Node versions and real LiveKit, PCM/Gemini voice, Firebase/APNs, encrypted storage, deep links, file/video playback on representative Android and iOS. Choose and record ADR, runtime and OTA provider. Add RN workspace package and lockfile in an isolated reviewed feature branch ONLY after freeze, not in planning PR. Establish non-conflicting Android applicationId/iOS bundle ID, signing/entitlement placeholders in secret manager, strict TypeScript, lint/test, typed client generation, account OTP/session, 5-tab adaptive navigation, offline/auth restore, telemetry redaction, English/Hausa accessibility. Exit: repeatable signed internal native builds, contract/auth tests and real sign-in/safe logout; no placeholder feature labeled working.

**P2 — Core read experiences and messaging.**
Implement Talk feed/search/detail/listen, Assistant text+task cards, Agent/Twin directory, read-only Wallet projections/receipts and human Chats text only AFTER integrated C01/C02/C03. Build stable IDs, permissions, error/empty/loading/retry, offline snapshots/outbox with bounded dedupe/readback, deep links and account switching. Exit: 2 real users/handsets authenticate and complete J03 text + corresponding negative/privacy paths, Talk listen, agent/chat history, no cross-tenant leaks.

**P3 — Voice, media, creator and realtime parity.**
LiveKit Host/Listener/Speaker stage, reconnect/host grace, public/private audio focus isolation, explicit microphone grants; paid Gwani/Gwana Gemini Live and silent fallback; authorized Twin/directing/sponsoring; private voice notes/attachments/signed replay, safe notifications/activity, privacy/safety/profile/locales. All C04/C05/C07/R02/R04/R09/R13/R14 depend on real finalized Gateway APIs. Exit: J01/J02/J04/J06/J07/J10/J11 on device; no fake voice/video badge.

**P4 — Money and operations qualification.**
Only after backend provenance and eligible provider environments: wallet account/earnings and separated Credits/NGN/crypto, payer confirmation, billing/crypto quotes, idempotent submission, uncertain outcome readback, creator gifts, settlements, reconciliation and supported country/network policy. No irreversible optimistic UI. Exit: J05/J08/J09 plus security, ledger and sandbox/live authorized qualifications; cross-client same receipts.

**P5 — Adaptive desktop/web experiment and hardening.**
Compare portable RN view primitives and Next.js apps/web for browser desktop; choose source sharing of pure feature presenters/hooks/design tokens/contracts or RN Web components only where tested. Do not replace or deploy apps/web in this phase by default. Split panes/sidebar/keyboard and reduced-memory responsive layout. Complete iOS background audio, notifications, accessibility, app lifecycle and privacy gates. Exit: documented browser-vs-native parity boundaries; no duplicated money/AI auth.

**P6 — Production candidates and guarded rollout.**
Full automatic + real-device/provider J01-J11/GJ suite; stable API/schema/readyz, backup/restore, app signing and secrets, store disclosures, FCM/APNs routing, upload limits, telemetry, crash-free/performance budgets, staged cohort, rollback and support runbook. Release RN first as opt-in separate identity to a controlled cohort; Flutter remains supported. Expand only from measured correctness, accessibility, reliability, security, costs and explicit owner approval.

## 3. Order rules for independent parallel development

- Flutter R17/C08 integration, C01-C07, R01-R19 and Work #497 keep their own ownership. RN consumes final contracts, writes no competing migrations or shared router during consolidation.
- First RN feature implementation goes in isolated RN paths; shared contract edits require explicit owner coordination, tests and backward compatibility for Flutter and existing clients. Do not create shadow /v2 endpoints merely for UI convenience.
- Freeze key contract fixtures per merge SHA; whenever Gateway routes change, regenerate RN clients and run Flutter+RN+web contract matrix before deployment.
- Each phase has reviewable functional slices and own native builds/tests. Exit gates require proof, not only documentation or screenshots. Use existing release requirements checklist and cross-feature traces instead of creating a rival DONE ledger.