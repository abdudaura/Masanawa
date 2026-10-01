# ChatWithStars Provider / Integration Forensics

Pinned source: `Baatiku/chatwithstars@3ab02704118ce3d8f38a423c9a52e9d44a705aeb`

Status: ACTIVE REMEDIATION

A provider is not "analysed" merely because its name appears in the Integration Ledger. This matrix records concrete auth, retry, idempotency, reconciliation and secret-handling evidence.

| Provider | Source evidence | Auth / secret boundary | Retry / failure behavior | Idempotency / reconciliation | Classification | Remaining gap |
|---|---|---|---|---|---|---|
| Flutterwave | `apps/admin/app/api/webhooks/flutterwave/route.ts`, `services/runtime/src/flutterwave-inbox-retry.ts`, Flutterwave acceptance/cutover tests and 20260918/22 migrations | server secret + webhook verification; live credential evidence expires; egress and webhook registration bound to current fingerprints | provider event failures persist to durable inbox; retry worker claims due events; HTTP/provider verification failures remain failed/retryable rather than assumed success | event inbox key, provider verification before mutation, chargeback registration, wallet/order/creator ledger RPCs, uncertain/reconciliation states | A behavior, redesign adapter | complete provider API call inventory and exact retryability map for every operation |
| NOWPayments | `apps/admin/app/api/webhooks/nowpayments/route.ts` | IPN secret + signature verification; absent secret fails 503 | storage/fulfilment failures return 503; unsupported/intermediate statuses map to confirming rather than paid | durable provider event insert; unique event key makes duplicate callback no-op; paid state calls canonical fulfilment RPC | A/B | outbound order-creation path and settlement/expiry polling not yet traced |
| VTPass | `20260909183500_vtpass_service_orders.sql` plus historical service-order runtime | historical provider credentials/config | durable order states include pending/uncertain/failed/refunded; reconciliation fields retained | explicit idempotency key/provider request+transaction IDs, wallet debit/refund timestamps | C provider / A order semantics | provider retired; verify no production callsites survive |
| Facebook Graph/Pages | automation `services/facebook.py`, publisher/tests/token vault | encrypted destination tokens; page access token derivation; token validation cache | transient Graph errors recognized; fetch failures surfaced; invalid destinations skipped; publisher tests required | queue/posted uniqueness and social publish receipts provide dedupe outside provider client | B | exact post/video upload retry rules and ambiguous publish lookup need source trace |
| YouTube | automation `services/youtube.py`, runtime/compat modules, continuous-ingestion/backfill tests, scheduler | provider/API/cookie configuration scoped in automation service | realtime window and historical backfill have separate bounded policies; failed recent work can be requeued | durable scheduler slot claim + source/page cursors + queue uniqueness; backfill oldest-first | A/B | API quota/error taxonomy and credential refresh behavior still to trace |
| TikTok | automation `services/tiktok.py` | provider token/config path | source adapter present | social queue expected to provide outer idempotency | B/C | implementation maturity insufficiently traced; do not adopt until full source/test evidence |
| Telegram | runtime telegram modules/tests + vault/auth migrations | vault-scoped bot/MTProto credentials; user auth requests stored separately and cleanup migration removes secrets | explicit auth queue/outbound delivery states; failures do not redefine canonical contact identity | canonical message identity and delivery evidence; routing tied to resolved user/agent | A/B | enumerate rate-limit/backoff and resend behavior |
| WhatsApp Web | runtime messaging modules, calls `whatsapp-web.ts`, worker lease/account-directory migrations | linked browser/device session and encrypted auth/session state; tenant guard | durable worker lease/reliability; call runtime has staged healer/relink behavior | message id uniqueness + outbound delivery evidence; call/provider state preserved across recovery | A/B | browser-library-specific failure modes must remain adapter-only |
| Google OAuth/Gmail/Calendar | `services/runtime/src/google-integration.ts`, admin OAuth start/callback routes, readiness test | access/refresh tokens encrypted; OAuth client secret server-side | one forced token refresh on HTTP 401; missing refresh/config -> reconnect_required | reads naturally replayable; calendar mutations require workflow/tool idempotency outside client | B | calendar-create duplicate prevention must be supplied by Masanawa workflow boundary |
| TypeSafe JEV | `jev-provider.ts`, schemas, readiness/language/shadow tests | bearer API key, configured model and bounded readiness probe | timeout/provider/auth/model mismatch explicitly classified; readiness cache TTL differs by failure type | decisions stored/replayed separately; provider response Zod-validated before use | B | exact evaluate-call retry policy and billing/cost handling |
| ComfyUI | `services/media-studio/providers/comfy/comfy_client.py`, `engine/render_queue.py` | network endpoint; no domain credentials in client | queue/poll timeout/error surfaced; render queue retries bounded then `needs_review` | local durable job uniqueness by episode/turn; prompt_id/output/gate report retained; actual prior output drives next turn | B | replace local SQLite/Windows paths with canonical workflow/store; remote upload auth boundary |
| Kling/Hailuo/Runway/Veo | studio export/provider artifacts | external provider credentials not fully centralized in pinned source | provider-specific render failures represented through studio job layer | canonical intent should be render-job idempotency, not provider UI/job ID | B/C | direct adapter code is incomplete/uneven; evaluate independently before adoption |
| Modal | `infra/modal/*_worker.py` | deployment/provider secrets | worker-level failures | caller job identity required | C/B deployment reference | no canonical domain ownership; only adopt if chosen compute backend |
| RunPod | `infra/runpod/*handler.py`, Dockerfiles | provider deployment secrets | handler/job failure semantics | external job ID only adapter evidence | C/B deployment reference | same as Modal |
| Telnyx | `src/lib/telnyx.ts`, legacy Telnyx API routes, setup script | Telnyx API key server-side; WebRTC token endpoint | legacy API-specific errors | number/callback resources have provider IDs; no evidence this path is current canonical runtime | C/B | legacy only unless telephony architecture independently chooses Telnyx |
| Supabase/PostgreSQL | migrations + runtime/admin DB clients | service role vs authenticated/anon RLS/RPC boundaries | DB/RPC failures generally fail closed in consequential paths | advisory locks, unique constraints, append-only ledgers, durable event inboxes and leases are primary idempotency substrate | A concepts | schema redesign required; donor table names/history not copied blindly |
| Modal/RunPod/Cloudflare/Railway/Vercel | deployment roots/config | deployment secrets | platform-specific restart/health behavior | none should be domain idempotency source | C/B | deployment ADR later |
| ffmpeg | studio media pipeline | local executable | deterministic command failure | deterministic transform from immutable inputs | B | pin version/capability checks |
| Gemini/OpenAI/provider model APIs | runtime/calls/automation/studio modules | provider keys/pools; some key rotation/readiness behavior | multiple subsystem-specific retry policies exist | model calls are non-authoritative proposals unless attached to workflow/domain evidence | B | consolidate all model clients under provider registry; inventory every callsite |

## Findings that change the migration design

1. **Provider readiness is stateful evidence, not configuration.** Flutterwave explicitly invalidates old acceptance when current credential, egress or webhook fingerprints change. Masanawa Ops needs a generic provider-acceptance model with evidence freshness and dependency invalidation.
2. **Webhook receipt is not business success.** Flutterwave and NOWPayments verify/signature-check and persist events before business mutation. Canonical provider inbox + domain reconciliation belongs below individual web routes.
3. **Idempotency is layered.** Database uniqueness/advisory locks, workflow operation keys, provider references and delivery receipts all participate. A single generic `idempotency_key` column is insufficient.
4. **External integrations must not own truth.** Facebook/YouTube/TikTok queues, WhatsApp/Telegram transports, Google APIs and JEV are adapters around canonical social/session/workflow/decision state.
5. **Legacy integrations are evidence, not commitments.** VTPass and Telnyx should not be carried forward merely because code exists.

## Open provider gaps before ChatWithStars closure

- Flutterwave: operation-by-operation provider API map (collections, bills, payouts, chargebacks, verification) and retryability taxonomy.
- NOWPayments: outbound order creation and any polling/reconciliation path.
- Facebook: ambiguous publish recovery/lookup behavior.
- YouTube: provider quota/error taxonomy.
- Telegram: rate-limit/backoff/resend policy.
- TikTok: determine whether adapter is complete enough to retain at all.
- Google Calendar mutation: define canonical workflow idempotency requirement.
- Model APIs: enumerate subsystem clients so duplicate provider ownership can be removed.

Until these are closed or explicitly deferred as C/reference with rationale, ChatWithStars remains `partial`.
