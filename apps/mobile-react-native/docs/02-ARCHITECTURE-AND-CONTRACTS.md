# React Native app architecture and shared contracts

Status: PROPOSED for a separate client, not an approval of any new backend feature. Product authority is docs/APP-SHELL-CONTRACT.md and docs/END-TO-END-UX-ARCHITECTURE.md; security authority is docs/SECURITY-AUTHORITY.md / SECURITY-MODEL.md; API lifecycle is docs/API-LIFECYCLE.md.

## 1. Client/server/desktop boundaries

- Flutter apps/mobile: maintained consumer app, full support and bug/security releases continue. RN never rewrites/deletes that tree or replaces Flutter by default.
- React Native apps/mobile-react-native: second consumer client for Android and iOS, common product jobs and customer account. Owns native UI, accessibility, adaptive layout, presentation state, encrypted ephemeral caches, mic/camera/file OS permissions, notification display and transport adapters ONLY.
- Next.js apps/web: future phone/tablet/desktop consumer browser remains independent deployment and framework. Adopt shared contract schemas, terminology, design tokens and UX models. Reuse portable non-DOM pure TypeScript utilities only after an explicitly reviewed package boundary. Do NOT treat React Native Web as an automatic replacement for apps/web; compare RN Web rendering vs Next.js independently during P1 desktop prototype. Electron/Windows/macOS native clients are future decisions, not committed scope.
- Gateway services/gateway plus packages/contracts, security, agents, identity, commerce, PostgreSQL, worker, LiveKit/Gemini and provider adapters remain sole authoritative domain systems. No RN local payment execution, independent user registry, private AI memory brain or direct provider secret.
- Shared state across clients is server-owned: one account/identity, server sessions, conversation/session IDs, public Talk/Seat IDs, DM sequence/cursors, wallet operations, receipts, Twin assignments and history. Each client uses its own encrypted local presentation caches, not a copied SQLite ledger.

## 2. Proposed client modules

Presentation: phone bottom tabs Talks | Chats | Assistant | Wallet | Agents with Assistant at index 2; tablet optional two-pane; desktop browser sidebar and list-detail panels representing the same five jobs; no hidden sixth tab. Keep navigation URLs/return state distinct from device gestures.

Core layers: (a) typed Gateway transport + version negotiation; (b) authentication/session manager, single-flight token refresh, logout, app lock and account-scoped cache; (c) feature repositories/readbacks and bounded query cache; (d) offline outbox with idempotent server acceptance only for eligible operations; (e) event/realtime cursor and replay; (f) media permission/audio focus/LiveKit/PCM adapters; (g) FCM/APNs push display/dedupe/link admission; (h) internationalization, accessibility, design tokens, feature/capability gating; (i) observed errors and redacted telemetry.

Candidate toolchain: TypeScript + React Native with Expo development builds / prebuild if supported by required LiveKit/Gemini, microphone capture, background push, signed media playback, file and secure-storage native modules. Expo Go is insufficient evidence for custom native media. Run a native dependency compatibility spike before choosing Expo vs bare RN, package versions or OTA provider. No framework install authorized by this document. Align future JS package manager and Node with root exact engine/lockfile; isolate Metro/Babel config from Next.js, Flutter, server TS or pnpm symlink assumptions.

## 3. Authentication and role rules

- Follow Gateway capabilities-driven OTP selection; SMS/email availability is server data, not a hardcoded policy. Do not ask the user for API tokens.
- Match auth endpoints exactly from existing app/Gateway: /auth/capabilities, /auth/otp, /auth/verify, /auth/refresh, /auth/logout; most business APIs use /v1/...; use canonical route metadata rather than a blanket /v1 rewrite.
- Keep access/refresh in OS keystore/keychain-backed secure storage; no AsyncStorage/localStorage, logs or crash traces with token payloads. Hydrate account before routing; clear caches, subscriptions, push installation binding and pending intents on logout, revocation or account swap.
- Refresh is serialized/single-flight and replay is bounded; never retry a rejected mutation blindly after unknown outcome. Require request/operation IDs and authoritative readback for paid effects. App background/restart and 401 races have explicit tests.
- User can be customer/person, Twin owner, Talk Host, listener, Speaker, moderator and paid recipient under different permissions; AI Expert and personal Twin are NOT platform login roles. Render features from signed server authorization and verified capabilities; admin account/routes remain segregated.
- Tenant/user/subject scope always comes from server session. Never trust a client ownerId, tenantId, agent role label or deep-link ID for access control. Treat all URLs and media/provider actions as untrusted ingress.
- Phone Android and iOS build identity/signing must be distinct from Flutter in parallel beta unless an explicitly approved in-place upgrade mechanism, stable data-migration proof, legal/store ownership and rollback plan exist. Same human account is compatible; native package identity is not assumed compatible.

## 4. Domain feature contracts and invariants

| Job | Client contract and authority |
| --- | --- |
| Talks public | Existing /v1 Talk API and LiveKit media-token grants; server admission for host, audience, Seat, mute, hand-raise, replay, recording and AI Seats. A Talk needs human Host; no AI-only public broadcast. Do not auto-start a mic or publish on tab entry. |
| Chats human-only | Await one final C01-C05 contact admission, DM persistence, realtime cursor, signed media, push and local-first semantics after Work reconciliation. No AI-character threads masquerading as human messages; no E2EE or direct calls claim unless independently designed/verified. |
| Assistant private | One durable server-bound Gwani/Gwana workspace, in-chat persona switch with attribution, typed message/action cards, voice/type/tap continuity; agent operation cannot authorize external effects alone. Separate mic/audio and privacy from public Talks. |
| Wallet | /v1/wallet, /v1/wallet/ngn, ledger operations, separate NGN kobo/Credits/pending and available earnings/crypto by asset+network; strict quote/confirm/request ID/readback/receipt. UI may cache displays, never author authoritative balance/settlement. |
| Agents | Server authorized Experts, Twins, profile/skills/availability and My Twin; don't hardcode inventory, pricing, commissions, skill grants or approved public Seat role. |
| Billing/crypto | /v1/commerce/bills/* and /v1/financial/* as qualified by server. Provider result, webhook, compliance gates, network-specific fees, ledger, reconciliation only on existing financial backend. |
| Identity/profile | Public vs private profiles, avatar, language, notification, privacy, safety, account deletion and creator entitlements with exact session/consent authority. |
| Events/push | Event schemaVersion and actor/tenant scope; replay cursor/retention, gaps/snapshot repair, dedupe by stable event ID, unread readback. Never place private DM/person info in public Talk stream/notifications. |
| Media | Signed, expiring scoped URLs; permitted MIME/byte/duration/retention checks; playback expiry recovery; background audio focus/interruptions; user-granted microphone/camera; no reusable credential in URL. |
| Channels | WhatsApp and Telegram remain Gateway/server channel integrations; RN consumes allowed status/identity, not new provider credentials. |

## 5. API compatibility and schema reuse

The source of truth is services/gateway runtime schemas plus packages/contracts public exports, docs/API-LIFECYCLE.json and tests/contracts. Existing Dart DTOs are observation, not an upstream wire contract. Build a reproducible RN-safe schema/codegen workflow from reviewed JSON Schema/OpenAPI snapshots, not importing node:crypto, Postgres/domain implementations or deep server paths into Metro/web bundles. Persist schema snapshot SHA and client support matrix; validate wire errors and HTTP status, cursors, optional vs required properties, amounts in safe decimal/integer wire units and canonical IDs. API additive fields must not break old Flutter or RN builds; breaking changes require a supported major/versioned envelope or dual read/write adapter with staged deprecation.

Contract tests compare Flutter fixtures, Gateway responses, RN serializers, TypeScript generated models, event replay versions and error envelopes. API major, event schemaVersion, native build/runtimeVersion and feature-flag version are separate dimensions. Rely on /readyz and migration compatibility before calling a client ready. Preserve legacy links with typed route mapping and privacy-safe fallback/return handling.

## 6. Responsive and access needs

Phone: five accessible bottom destinations, keyboard-safe compact chat composer, readable buttons, optional mic. Tablet: landscape/portrait split panes where helpful (Talk feed/detail, Chats list/thread, Wallet list/receipts) without changing data authority. Desktop browser: Next.js-first analysis, sidebar, keyboard/mouse/focus, drag/drop only where secure, large panels for Talks/Assistant, same receipts and role gates. Shared experience means consistent jobs/data/intent contracts, not forced pixel-identical UI or hidden desktop-specific accessibility.

Locales: English + Hausa P0, preserve Arabic RTL and es/fr/pt parity per existing Flutter ARB inventory later; time/amount/currency locale-appropriate without changing actual units/codes. Every voice path has text/tap/quiet equivalent. Camera-shy public audio is valid; explicit permissions, screen-reader announcements, reduced motion, large fonts, low-memory bandwidth/offline/reconnect testing required.