# ChatWithStars Provider / Integration Forensics

Pinned source: `Baatiku/chatwithstars@3ab02704118ce3d8f38a423c9a52e9d44a705aeb`

Status: ACTIVE REMEDIATION

A provider is not "analysed" merely because its name appears in the Integration Ledger. This matrix records concrete auth, retry, idempotency, reconciliation and secret-handling evidence.

| Provider | Source evidence | Auth / secret boundary | Retry / failure behavior | Idempotency / reconciliation | Classification | Remaining gap |
|---|---|---|---|---|---|---|
| Flutterwave | `apps/admin/lib/billing.ts`, `services/runtime/src/flutterwave-bills.ts`, webhook/retry routes, acceptance/cutover tests and 20260918/22 migrations | scoped server credential + verified webhook; live credential/egress/webhook evidence expires and invalidates dependent acceptance | read/catalogue/balance calls = `safe_read`; bill payment, payout/transfer and virtual-account creation = `reconcile_before_retry`; transient HTTP classification exists but side-effect writes cannot be blindly replayed | workflow/client request key + stable provider reference; bill lookup by reference, transfer lookup by ID/reference, webhook inbox, chargeback verification, uncertain-state reconciliation | A behavior, redesign behind ADR-0010 | closed at architectural level: provider-specific endpoint inventory traced; direct donor helper code is not canonical |
| NOWPayments | webhook route + billing provider enum only; checkout path explicitly accepts Flutterwave only | IPN secret + signature verification | webhook/storage failure returns 503; duplicate event is no-op | event-key dedupe + fulfilment RPC | C provider / A webhook pattern | retire as active provider at current pin; preserve generic verified-webhook + dedupe pattern only |
| VTPass | `20260909183500_vtpass_service_orders.sql` plus historical service-order runtime | historical provider credentials/config | durable order states include pending/uncertain/failed/refunded; reconciliation fields retained | explicit idempotency key/provider request+transaction IDs, wallet debit/refund timestamps | C provider / A order semantics | provider retired; verify no production callsites survive |
| Facebook Graph/Pages | automation `services/facebook.py`, `publisher.py`, tests/token vault | encrypted destination token; page token derivation; validation cache | upload session start/transfer/finish errors surface immediately; transient auth validation recognized; donor does not safely replay failed publish | outer planned-post/queue uniqueness provides canonical idempotency; upload session/video IDs are provider evidence | B | retain capability but classify publish as `reconcile_before_retry`; canonical adapter must add provider-status lookup/operator reconciliation before republish |
| YouTube | `services/youtube.py`, runtime/compat modules, ingestion/backfill tests, scheduler | API key/cookie configuration scoped in automation service | HTTP retries: 3 with backoff on 429/500/502/503/504 and Retry-After; provider reasons explicitly classify rateLimitExceeded/backend/internal/serviceUnavailable as retryable | historical page-token stack/cursor + scheduler slot claim + queue uniqueness preserve progress without duplicate ingestion | A/B | closed for ingestion; this donor is an ingestion/read adapter, not a publishing provider |
| TikTok | `services/tiktok.py` | yt-dlp/cookie-style source access; no canonical publishing credential contract | bounded 4-attempt ingestion retry with increasing delay; errors returned to scheduler | historical offset cursor; outer queue/dedupe handles ingestion identity | C/B | retain only as optional ingestion-source reference; no evidence supports a TikTok publishing provider at this pin |
| Telegram | `telegram-outbound.ts`, `telegram-delivery.ts`, tests + vault/auth migrations | exact channel-account credential; bot and MTProto credentials separated | no blind retry contract is present; document delivery explicitly forbids automatic retry because timeout may follow provider acceptance | pre-send delivery-part lookup by caller idempotency key; provider message ID persisted as transport receipt | A/B | closed architecturally: classify sends as `reconcile_before_retry`; canonical gateway must resolve ambiguous delivery before resend |
| WhatsApp Web | runtime messaging modules, calls `whatsapp-web.ts`, worker lease/account-directory migrations | linked browser/device session and encrypted auth/session state; tenant guard | durable worker lease/reliability; call runtime has staged healer/relink behavior | message id uniqueness + outbound delivery evidence; call/provider state preserved across recovery | A/B | browser-library-specific failure modes must remain adapter-only |
| Google OAuth/Gmail/Calendar | `google-integration.ts`, OAuth routes/readiness test | encrypted access/refresh token + server OAuth client secret | exactly one forced refresh/retry on HTTP 401; otherwise error | Gmail/calendar reads = `safe_read`; calendar create has no donor idempotency/reconciliation and therefore must be `reconcile_before_retry` or `never_automatic` behind a workflow operation key | B | closed as donor evidence; Masanawa must add mutation idempotency/reconciliation, not copy `calendarCreate` directly |
| TypeSafe JEV | `jev-provider.ts`, schemas, readiness/language/shadow tests | bearer API key + configured model | timeout/network and 429/529/500/502/503/504 marked retryable; invalid JSON/schema is terminal; adapter itself does not own retry scheduling | response validated before decision admission; request_id/usage captured when supplied; durable decision replay remains outside provider | B | closed architecturally: retry scheduling/cost accounting belongs to decision workflow/telemetry, not provider client |
| ComfyUI | `services/media-studio/providers/comfy/comfy_client.py`, `engine/render_queue.py` | network endpoint; no domain credentials in client | queue/poll timeout/error surfaced; render queue retries bounded then `needs_review` | local durable job uniqueness by episode/turn; prompt_id/output/gate report retained; actual prior output drives next turn | B | replace local SQLite/Windows paths with canonical workflow/store; remote upload auth boundary |
| Kling/Hailuo/Runway/Veo | studio export/provider artifacts | external provider credentials not fully centralized in pinned source | provider-specific render failures represented through studio job layer | canonical intent should be render-job idempotency, not provider UI/job ID | B/C | direct adapter code is incomplete/uneven; evaluate independently before adoption |
| Modal | `infra/modal/*_worker.py` | deployment/provider secrets | worker-level failures | caller job identity required | C/B deployment reference | no canonical domain ownership; only adopt if chosen compute backend |
| RunPod | `infra/runpod/*handler.py`, Dockerfiles | provider deployment secrets | handler/job failure semantics | external job ID only adapter evidence | C/B deployment reference | same as Modal |
| Telnyx | `src/lib/telnyx.ts`, legacy Telnyx API routes, setup script | Telnyx API key server-side; WebRTC token endpoint | legacy API-specific errors | number/callback resources have provider IDs; no evidence this path is current canonical runtime | C/B | legacy only unless telephony architecture independently chooses Telnyx |
| Supabase/PostgreSQL | migrations + runtime/admin DB clients | service role vs authenticated/anon RLS/RPC boundaries | DB/RPC failures generally fail closed in consequential paths | advisory locks, unique constraints, append-only ledgers, durable event inboxes and leases are primary idempotency substrate | A concepts | schema redesign required; donor table names/history not copied blindly |
| Modal/RunPod/Cloudflare/Railway/Vercel | deployment roots/config | deployment secrets | platform-specific restart/health behavior | none should be domain idempotency source | C/B | deployment ADR later |
| ffmpeg | studio media pipeline | local executable | deterministic command failure | deterministic transform from immutable inputs | B | pin version/capability checks |
| Gemini/model APIs | runtime Gemini router/rate-limit/resilience/errors, calls/automation/studio modules | physical-key fingerprints + scoped credentials/system key | persisted model/project route state; physical-key RPM reservation; 429 cooldown, 403/404 unavailable cooldown, bounded 503 retry, 401 key rejection, bounded queue wait and fallback to system key | every attempt is telemetry/cost evidence; inference result remains non-authoritative proposal | B | donor callsite duplication is intentionally not preserved; consolidate behind ADR-0010 provider registry |

## Findings that change the migration design

1. **Provider readiness is stateful evidence, not configuration.** Flutterwave explicitly invalidates old acceptance when current credential, egress or webhook fingerprints change. Masanawa Ops needs a generic provider-acceptance model with evidence freshness and dependency invalidation.
2. **Webhook receipt is not business success.** Flutterwave and NOWPayments verify/signature-check and persist events before business mutation. Canonical provider inbox + domain reconciliation belongs below individual web routes.
3. **Idempotency is layered.** Database uniqueness/advisory locks, workflow operation keys, provider references and delivery receipts all participate. A single generic `idempotency_key` column is insufficient.
4. **External integrations must not own truth.** Facebook/YouTube/TikTok queues, WhatsApp/Telegram transports, Google APIs and JEV are adapters around canonical social/session/workflow/decision state.
5. **Legacy integrations are evidence, not commitments.** VTPass and Telnyx should not be carried forward merely because code exists.

## Provider closure decisions

The previously open provider gaps are now resolved at the migration-architecture level:

- Flutterwave: retained as strong consequential-provider behavior donor; mapped to `safe_read` and `reconcile_before_retry` operations under ADR-0010.
- NOWPayments: retired as active provider at the pinned source; retain only verified-webhook/dedupe behavior.
- Facebook: retained, but publishing is explicitly `reconcile_before_retry`; donor lacks sufficient ambiguous-publish recovery to copy directly.
- YouTube: retained as ingestion/read adapter with explicit retry taxonomy; not a publishing provider.
- Telegram: retained; outbound delivery is not blindly retryable and must reconcile ambiguous sends.
- TikTok: optional ingestion reference only; no publishing-provider adoption.
- Google: reads are replay-safe; calendar mutation requires canonical workflow idempotency/reconciliation absent from donor.
- JEV: provider supplies retryability classification; workflow owns durable retry scheduling.
- Gemini/model providers: mature routing/quota behavior is retained as donor evidence, but all duplicated clients collapse into the canonical provider registry.

No remaining ChatWithStars integration is allowed to define its own business truth or independent retry framework.

## Remaining source-level gap

Provider architecture is now closed, but ChatWithStars remains `partial` until the source-specific coverage document is reconciled against this decision and all remaining non-provider descendant unknowns are zero.
