# Launch first-10 completion workstream

Owner/window: current ChatGPT launch completion window  
Branch: `work/launch-first10-completion-20261007`  
Base: `release/mobile-apk-ready-20261006` @ `956d00694e34a71c75947991d8744dab4518b6c7`  
PR: #329 — **Complete first-ten launch integrations**  
Started: 2026-10-07

## Reclaimed stale ownership

Under `docs/MULTI-WINDOW-WORK.md` five-minute lease, stale shared work
from PR #126 and PR #136 was reclaimed after inspecting and preserving useful
history. Rejected local-agent commits at the old #136 head were intentionally
not reintroduced.

The user-preserved WhatsApp-first mobile redesign was reconciled surgically.
The older propagation branch was not merged wholesale because the APK-ready
line contains newer realtime voice, Twin, branding and production work.

## Locked product rules preserved

- Masanawa is **WhatsApp + Masanawa intelligent services**, not a mini-app dashboard.
- Home is the primary consumer surface; root navigation is **Home · Explore · Activity · Wallet**.
- Internet Cafe, Wallet funding, billing and crypto enter conversation first.
- Language is dynamic from the user's current speech/text; no fixed language preference is collected or displayed.
- Twin setup is gender + age + image, followed by a Gwani-led realtime interview.
- During Twin setup, user-speech transcription is internal only and is never rendered in chat.
- Public Twin text chat remains free; realtime Twin voice uses trial/paid admission.
- Light mode remains white/grey/blue with Masanawa blue `#0A6FFA`.

## First-ten status

### 1. Android APK / device readiness — code complete, device qualification external

The launch branch is based directly on the APK-ready release line and preserves
its Android/application identity and current realtime voice implementation.
Mobile shell, router, theme and service-entry changes are integrated here.

Remaining qualification is physical: build/install this branch on the target
Android device and exercise sign-in, Home, microphone, camera/photo selection,
Twin setup, billing/crypto service intents and paid voice.

### 2. Flutterwave billing chat journey — code complete, monetary qualification external

Existing canonical billing custody was preserved:
- live Flutterwave catalog;
- exactly-once quote/confirm/purchase handling;
- NGN wallet and refund/recovery;
- temporary in-chat funding account;
- automatic continuation after verified funding;
- one explicit purchase confirmation.

Primary mobile entry is now conversation-first from Home/Internet Cafe/Wallet,
including the restored **Add money** chat handoff.

Remaining qualification is a real provider/account monetary test with the
production Flutterwave credentials/webhook/relay.

### 3. NOWPayments crypto — code complete, provider qualification external

Added a server-controlled conversational crypto executor over the canonical
Financial service:
- live provider-qualified deposit/conversion/withdrawal routes;
- capabilities, balances and history;
- deposit creation;
- fiat purchase;
- conversion and withdrawal quote;
- durable five-minute pending confirmation custody;
- exact request-id replay on confirmation;
- explicit cancel;
- provider-qualified withdrawal route API.

Internal crypto action syntax is only included in model instructions when the
Financial executor is configured, so machine tags cannot leak during provider
misconfiguration.

Remaining qualification is real NOWPayments account/custody/relay/whitelist/
2FA route evidence and live monetary smoke tests.

### 4. Home / Rooms integration — code complete for first-ten launch surface

The active shell is now:
**Home · Explore · Activity · Wallet**.

Home uses the server projection and retains compact WhatsApp-first presentation:
- Masanawa app bar;
- compact Gwani/Gwana cards;
- horizontal Data/Airtime/Electricity/TV intent chips;
- My Twin;
- continuations;
- Audio Stories / News Updates display naming;
- Crypto Tokens after Internet Cafe;
- no dashboard-style section headings.

Internet Cafe and Study Center are active conversational rooms. Existing Story
Radio PR #211 and its admin PR #213 are preserved as separate stale content
workstreams and were not wholesale merged into this launch PR.

### 5. Voice-first Twin creation — code complete, device voice qualification external

The old language/form onboarding was replaced by:
- gender;
- age;
- required image;
- immediate Gwani realtime interview.

Only Twin-setup Live sessions receive input transcription. That transcript is
never displayed or stored as chat text; it is reduced into bounded structured
Twin facts. Once Gwani has durable facts for personality, boundaries, purpose
and interaction style, setup completes automatically: the live interview is
stopped/flushed, the last fact extraction is awaited, the interview is
summarized and the canonical Twin profile/avatar/public link is provisioned.
The visible Finish Twin action remains only as a recovery fallback.

### 6. Twin share / deep link / free public chat — code complete

The public Twin resolver remains `/twin/:publicId`, resolves through the
canonical directory and enters ordinary text chat. My Twin share uses the
canonical public URL. Paid admission is only introduced when a visitor starts
realtime voice with someone else's Twin.

### 7. WhatsApp production channel — code complete, Meta registration external

Added:
- durable channel identity/session/message-id storage;
- HMAC `X-Hub-Signature-256` verification;
- GET webhook challenge verification;
- text/audio/image/document ingress;
- media retrieval;
- exact-once Agent/financial execution for inbound message IDs;
- separate durable outbound-delivery state: failed provider sends retry delivery
  without repeating the Agent/billing/crypto turn;
- canonical Masanawa phone-identity linking;
- same Agent conversation/Skills/Commerce/Wallet runtime as mobile;
- outbound text delivery/chunking;
- fail-fast environment configuration.

Remaining qualification: Meta app/phone registration, access token, webhook
registration and real inbound/outbound testing.

Inbound voice notes are supported. Outbound provider voice-note delivery is not
claimed in this PR because the current native Gemini audio format is not
universally accepted by WhatsApp/Telegram without a provider-compatible codec
transcode path.

### 8. Telegram production channel — code complete, bot registration external

Added:
- webhook secret-token verification;
- text/caption/contact/voice/document/photo ingress;
- Telegram file retrieval;
- contact ownership validation (`contact.user_id == sender`);
- link only when the shared phone matches an existing Masanawa phone identity;
- durable canonical session continuity and exact-once Agent execution;
- durable outbound delivery acknowledgement/retry;
- outbound text delivery and request-contact keyboard;
- fail-fast environment configuration.

Remaining qualification: bot token, `setWebhook`, secret token and real
Telegram delivery test.

### 9. Core Teaching — code complete

Study is now distinct from **Teach my Twin** customization.

Core Teaching:
- runs inside the canonical Agent conversation/AgentRun path;
- stores progress by tenant + user + character + relationship;
- dynamically follows current language/register;
- teaches in manageable steps with examples/exercises/checks;
- stores topic, goal, level, checkpoint, next step and mastery notes;
- strips hidden learning-state metadata before user delivery;
- resumes progress across sessions/channels.

Study Center is enabled in the Home projection and enters `entry=study`.

### 10. Paid Twin voice — code complete, live settlement qualification external

Existing backend quote/trial/reserve/admission/live-token/start/settlement
custody is preserved.

Mobile lifecycle hardening added:
- startup failures settle paid admission as interrupted;
- wallet/presence recovery on failures;
- call completion requires verified `mediaStarted`, not merely sheet open;
- chat close during grant/session startup no longer leaks a reservation;
- Twin setup uses support-agent-only `twin-setup` Live grants.

Remaining qualification is a real paid/trial voice call on device against the
production Gemini/Twin economy runtime.

## Additional launch hardening completed

- Conversation turns now reject closed/expired canonical Character sessions
  before inference or financial side effects.
- Channel bridges reopen only genuine stale/closed sessions, never arbitrary
  model/provider/payment failures.
- Bare `yes/confirm` is arbitrated through pending billing before pending
  crypto to avoid ambiguous financial execution.
- Fixed-language Twin profile/teaching hooks were removed.
- Light theme and conversational Wallet/Cafe presentation from the user's
  preserved local redesign were restored without replacing newer APK work.

## Verification evidence

Focused deterministic tests were added for:
- hidden Teaching-state stripping/persistence;
- crypto confirmation reusing the exact persisted request ID;
- duplicate channel execution idempotency and completed-vs-delivered retry behavior;
- expired conversation sessions failing before inference/financial execution;
- Cafe Crypto shortcut expectation.

GitHub Actions for PR #329 currently fail before any workflow step receives a
runner (approximately three-second runs with zero steps), so no hosted compiler
or test result is being represented as green. The connected execution
environment cannot clone GitHub over the network, so a local monorepo
typecheck/build could not be run here.

The PR remains **draft** until branch build/device/provider qualification is
available.

## Production environment additions

Registered/documented:
- `MASANAWA_FLUTTERWAVE_VERIFY_ON_START`
- `MASANAWA_WHATSAPP_ENABLED`
- `MASANAWA_WHATSAPP_VERIFY_TOKEN`
- `MASANAWA_WHATSAPP_APP_SECRET`
- `MASANAWA_WHATSAPP_ACCESS_TOKEN`
- `MASANAWA_WHATSAPP_PHONE_NUMBER_ID`
- `MASANAWA_WHATSAPP_GRAPH_VERSION`
- `MASANAWA_TELEGRAM_ENABLED`
- `MASANAWA_TELEGRAM_BOT_TOKEN`
- `MASANAWA_TELEGRAM_WEBHOOK_SECRET`

Webhook deployment instructions are in `docs/CONFIGURATION-DEPLOYMENT.md`.

## Deployment status

No production deployment was performed by this workstream. No provider secret
was changed. No live financial action was executed.

## Current status

**First-ten code integration: complete on PR #329.**

Remaining work is qualification/deployment evidence:
1. build/install/test this branch on Android;
2. restore/execute hosted CI or run monorepo typecheck/tests in a connected workspace;
3. Flutterwave live monetary smoke test;
4. NOWPayments live route/custody/withdrawal/conversion smoke tests;
5. Meta WhatsApp registration + webhook delivery test;
6. Telegram bot webhook delivery test;
7. paid/trial Twin realtime voice settlement test on device.


## Continuation after exhausted window — 2026-10-07

The continuation window resumed from PR #329 at head `4fa62739b9866ee0511ec970dbd82bafc82e91d0`.

Hosted CI was retried for both Mobile Build and Foundation CI. Both retries again failed
before a runner was assigned: `runner_id=0`, no runner name and `steps=[]`. This
continues to indicate GitHub runner allocation/non-execution rather than an application
compile/test result.

Three stale/reclaimable acceptance suites were reconciled into this launch branch:

- `tests/integration/twin-public-share-free-text.test.ts`
  - stable public Twin share identity;
  - owner identity not leaked;
  - another user's public text remains zero-charge;
  - paid voice evidence cannot make text billable;
  - hidden/non-discoverable Twins do not project publicly.
- `tests/integration/twin-paid-voice-acceptance.test.ts`
  - configurable seven-day trial remains zero-charge;
  - paid verified usage settles inside reservation;
  - unused reserve is refunded;
  - ambiguous/over-reservation usage goes to reconciliation;
  - paid voice admission cannot affect free text.
- `tests/recovery/twin-paid-voice-retry-acceptance.test.ts`
  - crash-after-settlement exact replay is idempotent;
  - changed retry payload fails closed;
  - ambiguous usage cannot post money;
  - trial units are consumed once;
  - failed-before-media consumes no trial and posts no charge.

These tests were preserved from stale acceptance PRs #226/#233/#291 and now travel with
the actual first-ten integration branch instead of remaining disconnected acceptance work.

The branch remains draft because executable CI, Android device validation and live provider
qualification are still external evidence requirements; no test pass is fabricated.
