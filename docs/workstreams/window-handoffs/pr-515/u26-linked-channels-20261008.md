# U26 — WhatsApp/Telegram opt-in assistant channel linking: final source handoff

**Updated:** 2026-10-08 17:15 UTC. **Owner:** GPT-6 U26 implementation window.
**State:** PARTIAL_IMPLEMENTATION (isolated source and tests committed, shared production Gateway/Flutter/migration integration intentionally excluded). **Not DONE. Not deployed. Not merged.**
**Base main:** 5e758673ae91082520b21b3153da53791ae2cbf3.
**Branch:** work/u26-safe-linked-assistant-channels-20261008-gpt6.
**Last code SHA before this handoff:** 499f89f3697dd119857f0747e9005d262520befb. The committed handoff's own final HEAD is linked in draft PR #515.
**PR:** https://github.com/Baatiku/masanawa/pull/515 (DRAFT / OPEN / UNMERGED).
**Ownership lease:** first GitHub claim commit b42b1abb99ebc69c76643b5f361c7ad0d44d523a at approx 2026-10-08T17:04Z, renewed by this window's source commits. Own only new isolated Gateway channel_linking files, new Flutter channel_linking files/tests and this workstream handoff. Five-minute rule applies.
**Trace:** U26 / R15-F08 channel webhook safety / C07-F18 Assistant / J07 and J11 auth, privacy and cross-product authority.
**Overlap audit:** examined open PR inventory and workstream branches; U21 #508, U22 #509, U24 #510, U23, U28, U29, U30, Work #497, C07 #480, C01 #468, C02 #472/#475, C05 #474/#476, C06 #487/#490, Firebase #461, CI #457. Did not modify another window's owned shared source. Canonical contracts and five-tab app target preserved.

## Changed source paths (all on this draft branch)
- services/gateway/src/channel_linking/service.ts — CSPRNG 96-bit proof code and SHA-256 domain-separated digest, 5-minute expiry, code validation, URL and account actions.
- services/gateway/src/channel_linking/schema.sql — isolated U26 security.channel_link_intents plus per-user channel preference; not yet in the shared migration manifest.
- services/gateway/src/channel_linking/postgres_repository.ts — transactional PG owner locks, rate policy (30s cooldown, five/hour), row-locked single-use proof, conflict and owner checks, unlink/revoke, active-account and exact verified sender binding.
- services/gateway/src/channel_linking/routes.ts — authenticated status/begin/unlink/prefer REST; account identity ONLY from canonical verified platform session.
- services/gateway/src/channel_linking/provider_bridge.ts — wrapper for existing C07 provider bridge that intercepts proof codes BEFORE assistant input, reuses canonical delivery dedupe and refuses nonconsented old phone-autolink.
- services/gateway/src/channel_linking/default_agent.ts — resolves real platform default Gwani/Gwana support agent from canonical admin roster and user preferences without hardcoded IDs.
- services/gateway/src/channel_linking/integration.ts — isolated composition seam accepting actual sessions/channel repository/PG pool/roster plus provider-owned public destinations; intentionally NOT wired to global Gateway.
- services/gateway/src/channel_linking/service.test.ts, routes.test.ts, provider_bridge.test.ts, postgres_repository.test.ts — authored unit and Fastify/security/mock SQL tests; NOT RUN.
- apps/mobile/lib/src/channel_linking/assistant_link_transport.dart — typed authenticated Dio API, explicit 401/409/429/retry errors, official provider URL allowlist, readback.
- apps/mobile/lib/src/channel_linking/assistant_channel_settings_screen.dart — independent nested Settings screen with status, opt-in/copy provider code, app-open, refresh, preferred selection, confirm-unlink, guarded account-switch/teardown, user-safe errors. F12 must mount it; no live route exists on main.
- apps/mobile/test/channel_linking/assistant_link_transport_test.dart — authored Dart URL/DTO forgery tests; NOT RUN.
- docs/workstreams/u26-linked-channels-20261008.md — original visible claim and this final exact handoff.

## Implemented code behavior and real boundaries
A signed-in user can request an unguessable five-minute link proof, read status, select preferred verified channel or revoke it through per-user authorized endpoints WHEN gateway routes are actually composed. Code is sent as an ordinary message to the official WhatsApp/Telegram assistant via provider-verified ingress. Only the trusted sender/chat ID and the durable hash determine the canonical consented binding; the proof is never submitted by an arbitrary mobile HTTP caller or the LLM. Exact bound sender+chat and active user state are checked before forwarding ordinary provider messages to the existing assistant runtime. Unverified legacy auto-created customer-channel links are not trusted by the new wrapping bridge. Channel replies use existing message dedupe/delivered state. User can still use app human Chats separately; no cross-user memory, phonebook import, new DM store or financial authority added. All integration claims in this paragraph are about written code, not a running deployed service.

## Missing implementable source and hard merge blockers
1. **F11/shared migration owner** must register schema.sql deterministically after existing security customer-channel and platform-identity migrations; run disposable PG migrations and account/deletion/tenant tests, evaluate migration naming/order with competing unmerged branches. No production DB access or migration applied.
2. **F08/R15/F18 shared Gateway owner** must use createCustomerChannelLinkingComposition in the elected main.ts/app.ts. Dependencies: live pool, platformSessions, canonical customerChannels, support profiles, user preferences and real existing customer assistant bridge. Supply provider-owned publicly confirmed https://wa.me/<provider-number> and https://t.me/<bot-name> without disclosing bot tokens/credentials. Register composition.registerRoutes(app) exactly once and pass composition.bridge into BOTH createLinkedWhatsAppController({bridge,authDir}) and Telegram customer channel webhook option. **MANDATORY:** do not bypass this wrapper; legacy createCustomerChannelBridge auto-provisions phone-linked identities and therefore cannot be called on unconsented inbound messages. WhatsApp currently uses Baileys linked-device JIDs; Telegram signed secret/private sender checks are owned by R15. Validate webhook signatures and replay in actual integration.
3. **F12** must mount AssistantChannelSettingsScreen from canonical Settings without touching five-tab root ownership (Talks, Chats, Assistant, Wallet, Agents). Hide if routes/providers are uncomposed; no fake connected state. Verify signout/login switch and restart.
4. **F18/U01/R05-R08** must qualify current Gwani/Gwana task continuity and canonical financial step-up rules after integration. U26 never grants additional capability; provider messages are untrusted request surfaces.
5. Real provider runtime config, DMs/Assistant separation, rate limiting, account deletion and channel revocation, old-link upgrade consent, provider-unavailable support states, errors, push, two-device tests and audited rollout remain OPEN. No production feature flag activated.

## Testing and verification truth
**Executed test commands: NONE.** GitHub connector created/updated repository branch files and draft PR; static source inspection and authoring Vitest/Dart tests are NOT passing test evidence. Local repo/installed pnpm workspace dependencies, Node >=24 and Flutter SDK not present in this execution workspace; GitHub Actions quota/runner recovery issue #457, staging PG, provider credentials and actual Android handset were unavailable. These blockers were not repeatedly retried.

**Deferred commands on a proper Work checkout and composed integration SHA:**
1. pnpm install --frozen-lockfile
2. pnpm --filter @masanawa/gateway-service typecheck
3. pnpm exec vitest run services/gateway/src/channel_linking
4. pnpm typecheck && pnpm test:ci && pnpm build
5. cd apps/mobile && flutter pub get && flutter analyze && flutter test test/channel_linking && flutter test
6. pnpm test:integration and pnpm test:e2e after adding disposable PG real transaction/2-user, provider-ingress spoof/replay/expiry, and Android-level end-to-end cases. Record actual exit codes and full SHA; no claimed passing output exists.

**Adversarial acceptance yet to run:** A/B ownership conflict and rollback, expired/consumed/forged OTP, competing begin/confirm/unlink, 10 parallel requests and rate caps, wrong tenant, disabled/deleted account, forged Telegram identity/group or spoofed WhatsApp remote JID, duplicate signed webhook, provider 404/timeout and reconnect, stale auto-link bypass check, instant unlink and incoming worker race, channel status after restart and switch, no private human DM or money leakage, exact quote confirmations through existing ledger, small Android and text/voice/tap parity. Provider code may be socially phished; offer informed UI and rate-limited proof; never log the code or treat unsalted phone hashes as consent.

**Source/test release gates:** SOURCE_WRITTEN=yes (isolated paths). LOCAL_TESTED=no. CI_EXECUTED=no. DB_INTEGRATED=no. APP_INTEGRATED=no. DEVICE_VERIFIED=no. PROVIDER_QUALIFIED=no. DEPLOYED=no. MERGED=no. Overall U26 is PARTIAL_IMPLEMENTATION, not IMPLEMENTED_UNVERIFIED or DONE.

## Data, recovery and rollback
No secrets or account PII are stored in Flutter other than the temporary user-displayed proof held in memory; auth already resides in canonical API/session. Database persists only domain-separated code digest and verified provider identity by tenant/user; product readback does not enumerate provider identifiers. Rollback of transactions on conflict; unlink clears confirmation and current link; active-account guard on provider ingress. Account deletion must remove retained intent/preference rows and links. The shared auto-link path MUST be securely disabled/wrapped before enabling U26, else opt-in is bypassed. No production migration, provider enablement, Android build, finance change, merge or deploy occurred.

## ChatGPT Work integration sequence
1. Read current #515 changed files, exact HEAD and this handoff; honor F08/F11/F12/F18 ownership and PR #497/Firebase #461 reconciliation.
2. Add isolated schema to the one migration sequencer, perform SQL disposable account/tenant/restart tests and repair source/type errors before claiming success.
3. Compose Gateway app.ts/main.ts with customer-session routes and SAME verified-provider bridge for Baileys and Telegram; ensure no path calls old auto-link ahead of proof and safe public provider URL config.
4. Mount nested Flutter Settings screen only once endpoint is live and qualified, preserving five tabs and existing auth.
5. Run the deferred commands, add real PG/backend/provider/mobile tests, validate signed webhook/revoke/financial guard and device flow, record exact SHAs/results, and obtain independent review.
6. Only after executed complete qualification, consider merge and staged deployment. Keep this PR DRAFT and UNMERGED meanwhile.
