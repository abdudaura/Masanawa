# Phase 0B Forensic Coverage — ChatWithStars

Pinned revision: `3ab02704118ce3d8f38a423c9a52e9d44a705aeb`

Status: ACTIVE — descendant-level remediation pass.

This file supersedes the earlier root-only declaration of coverage. A subsystem is complete only when implementation, tests, durable state, external integrations, classification, canonical owner and acceptance strategy are all identified.

## Runtime/domain descendants

| Capability family | Implementation evidence | Test/evidence | Durable state evidence | Ledgers | Class | Canonical destination | Acceptance/parity gate |
|---|---|---|---|---|---|---|---|
| Character/agent binding and versioning | `services/runtime/src/agent-resolver.ts`, `agent-persona-versioning.ts`, `agent-scoped-runtime.ts`, `star-agent-context.ts` | resolver/persona/scoped-runtime tests | `20260913144330_agent_foundation.sql`, `20260913151254_agent_binding_and_version_management.sql`, `20260913163452_version_agent_persona_identity.sql`, star identity migrations | IDN-*, D-AGT-003 | A/B | `packages/identity` + `packages/agents` | version activation is explicit; Character identity does not equal runtime Agent; stale version cannot become active implicitly |
| Named Character handoff | `star-handoff.ts` | `star-handoff.test.ts`, `star-handoff-privacy.test.ts`, cross-channel continuity tests | named-star handoff migrations 20260927053852..065036 | HND-001/002, D-WF-* | A | `packages/workflows` + runtime bridge | private memory omitted by default; destination/source authority checked; completion evidence bound to inherited task |
| Character life/canon | `star-life.ts`, `star-life-engine.ts` | life/life-engine tests, hidden-publication/canon tests | `20260926211100_star_life_event_canon_immutability.sql`, `20260928011428_star_life_engine_idempotency.sql` | WLD-001..009, D-WLD-* | A | `packages/world` | immutable approved canon; routine occurrence idempotency; visibility/provenance preserved |
| Skills/capabilities | `skill-contract.ts`, `agent-skill-mapping.ts`, `capability-registry.ts` | skill-contract v1/v2, capability registry/discovery tests | skill v2, agent-skill binding, star expertise migrations | SKL-002/006/007, TOL-002, D-SKL-* | A/B | `packages/skills` + `packages/tools` | invalid/uncertified versions cannot activate; current binding/version selected deterministically |
| Decisions/JEV | runtime decision paths and replay attachments | JEV language/replay evidence in source map | decision replay/evaluation migrations | DEC-001/002, D-DEC-001, I-JEV-001 | A/B | `packages/decisions` | schema/version/language gate and replay evidence preserved; provider failure cannot rewrite domain state |
| Conversation/runtime posture | `conversation-brain.ts`, `conversation-turn-shape.ts`, `response-intelligence-core.ts`, role runtime/policy | conversation brain/turn/response/role tests | conversation/contact/memory schema history | AGT runtime rows, REL/MEM | B | `packages/agents` + gateway/session compiler | posture/role affects compiled run policy only; does not own Character or memory truth |
| Learning proposals | `learning-proposals.ts`, `learning-safety.ts`, `learning-semantics.ts` | learning proposal/safety/semantics tests | character learning/outcome evidence migrations | LRN-* | A/B | evaluation/learning subsystem | learned proposal remains proposal until certified/admitted; no self-promotion to production truth |
| Consumer entitlement | `consumer-entitlement.ts`, message-pump entitlement preflight | `consumer-entitlement-identity-hardening.test.ts`, subscription capability/trial tests | `20260925055437_consumer_subscription_entitlement_gate.sql`, identity-hardening + billing-plan migrations | SUB-001, D-ENT-001/002, D-COM-009/010 | A/B | `packages/entitlements` + commerce | reserve before response; deliver/release idempotently; identity resolution fails closed; billing state alone never grants arbitrary capability |
| Consumer privacy | `consumer-privacy.ts` | `consumer-privacy.test.ts`, admin data inventory tests | `20260925113000_global_consumer_privacy_controls.sql` | PRV-001, D-PRV-001/002 | A/B | `packages/privacy` + security/commerce | authenticated subject only; explicit destructive confirmation; financial receipts minimized rather than corrupting reconciliation |
| Contacts/private relationship facts | `contact-identity.ts`, `contact-fact-learning.ts`, conversation thread memory | contact identity/fact tests | contact identity graph, merge, memory-evidence, phone-dedupe migrations | REL-*, MEM-* | A/B | identity + memory | aliases may merge identity evidence but never silently merge unrelated private chat histories |
| Groups/community | `community-membership.ts`, `group-agent-runtime.ts`, `group-listener.ts`, `group-proactive-policy.ts`, `group-world-model.ts` | membership/listener/thread/proactive/admin tests | group threads/settings, `20260914130055_group_expert_world_model.sql`, kill-switch migration | GRP-001, D-GRP-001/002 | A/B | relationships + world + gateway | group scope explicit; owner/private facts guarded; proactivity/moderation policy separate from inferred profile; no private relationship leakage |
| Missions/autonomy/outreach | `mission-constitution.ts`, `mission-control.ts`, `mission-evaluator.ts`, `outreach-mission-authority.ts` | mission constitution/control/evaluator, durable-authority/outreach tests | `20260909223000_durable_missions_routines_work.sql`, mission continuation/constitution migrations | MSN-001, D-MSN-001/002, TSK-* | A/B | `packages/workflows` + proactivity | current authority checked at execution; leases/retries durable; terminal outcome/evaluation evidence required |
| Telecom/bills | `bill-service-catalog.ts`, `bill-service-orders.ts`, `bill-service-provider.ts`, `bill-service-reconciler.ts`, `telecom*.ts` | bill/telecom/repeat/receipt tests | telecom agent template + wallet/commerce/provider migrations | TEL-001, COM-001..004 | A/B | `packages/commerce` + provider adapters | exact catalog/quote; explicit confirmation; provider-confirmed fulfilment; uncertain result reconciled; repeat-safe receipt |
| General commerce | `commerce-intelligence.ts`, `commerce-resume-worker.ts`, creator/customer wallet modules, crypto modules | commerce recovery/funding/sales, wallet, crypto tests | commerce/wallet/refund/funding migrations | COM-001..004, D-COM-* | A | `packages/commerce` + workflows | append-only ledger evidence, idempotent side effects, ambiguous provider outcomes reconciled before retry |
| Creator tenancy/services | `creator-mode-runtime-guard.ts`, `creator-services.ts`, `creator-order.ts`, `creator-payout-reconciler.ts`, `creator-wallet-actions.ts` | creator mode/financial safety/order/payout tests | creator accounting, pricing, settlement, payout lifecycle migrations | CRT-001, D-COM-008 | A/B | tenancy + commerce + ops | tenant isolation; payout reserve before provider call; failed payout releases reserve; uncertain state not double-paid |
| Civic vertical | `civic-source-policy.ts`, `civic-truth-lifecycle.ts`, jurisdiction/graph/case/grounding modules | source/truth/jurisdiction/refresh/case tests | civic claim/leadership/relationship lifecycle, pulse/election registry migrations | CVI-001, D-CVI-001 | B | `packages/verticals/civic` + knowledge/workflows | source + jurisdiction + freshness retained; stale/disputed state excluded from current-answer path unless explicitly historical |
| Telegram | `telegram-runtime.ts`, `telegram-message-identity.ts`, `telegram-user-auth-queue.ts`, outbound/delivery | approval/message-identity/outbound/user-document tests | Telegram credential/contact/auth migrations | CHN-001, I-SOC-001 | B | gateway channel adapter | channel identity normalized to canonical relationship/session; credentials remain vault-scoped |
| WhatsApp messaging | `whatsapp.ts`, `whatsapp-reliability.ts`, `whatsapp-text.ts` | reliability/text/idempotency tests | WhatsApp worker lease/account-directory migrations | CHN-001, TSK-004, I-WA-001 | A/B | gateway adapter | durable delivery evidence prevents duplicate resend; transport state does not own conversation identity |
| Voice response policy | `voice-policy.ts`, audio/transcription delivery paths | voice delivery/duration/transcription/understanding tests | provider/config state, no separate identity truth | CHN/RTC/provider rows | B | presence/media provider policy | voice-vs-text is delivery policy; STT/voice provider failures degrade without losing canonical inbound message |
| Call runtime | `services/calls/src/call-readiness.ts`, `recovery-policy.ts`, resident control/poller, provider state, direct transport | 20+ call readiness/race/recovery/runtime ownership tests | durable call-session/device-runtime migrations | CALL-001..006, D-RTC-001, I-WA-001 | A/B | `services/presence` | readiness distinguishes degraded/action-required; soft recovery before destructive relink; incoming accept waits for materialized provider call |
| Social ingestion/publishing | automation `scheduler.py`, `jobs.py`, `publisher.py`, provider services, token vault | posting cadence/review/tenancy/backfill/token-vault tests | automation service DB + platform social state | SOC-001..005, D-SOC-* | A/B | `services/social` + workflows | per-tenant scheduling; durable slot claims; queue uniqueness; review isolation; token vault; historical backfill does not duplicate |
| Studio render/continuity | media engine `render_queue.py`, continuity/reference/quality/lipsync/export modules | source-map acceptance evidence + project manifests | local queue DB/project files are donor implementation state | STD-001..006, D-STD-* | A/B | `services/studio` | durable idempotent render job; bounded retry then human review; next-shot continuity derived from actual prior output, not only prompt plan |
| Ops/acceptance | admin acceptance/reconciliation/financial adjustment/control modules and routes | acceptance health/operations/provider cutover/payout safety tests | acceptance evidence/control flags/audit and financial tables | OPS-001/003..006, D-OPS-* | A | `apps/ops` + telemetry/security | “configured” != “accepted”; emergency controls durable; financial adjustments bounded/audited |
| Admin/API surface | `apps/admin/app/api/**` + admin pages/libs | library/unit tests | reads/writes canonical DB | capability rows above | B | `apps/ops` | API/UI cannot bypass package authorization or become duplicate business logic |
| Legacy Astro fan web | `src/lib/**`, `src/pages/**` | existing acceptance helpers | legacy auth/chat/payment/subscription state | LEG-001 | C/B | future client surfaces | preserve only externally required fan/creator UX behavior and migration data; do not retain parallel auth/chat/payment authority |
| Supabase functions | profile update + voice chat functions | function behavior as migration evidence | same PostgreSQL state | LEG/IDN/CHN | C/B | canonical services/providers | no function-owned domain truth; migrate only needed adapter behavior |
| Deployment/GPU wrappers | `deploy/**`, `infra/modal/**`, `infra/runpod/**` | endpoint tests | provider config/secrets | DEP-001, I-GPU-001/002 | C/B | deployment/provider adapters | provider-specific deployment is replaceable; domain packages must run independently of these wrappers |
| Static/project fixtures | `data/**`, `public/media/**`, media-studio project/export trees | manifests/examples | checked-in data only | DAT-001 | C/B | seed/test fixtures only | provenance/privacy review before reuse; generated outputs are never source-of-truth architecture |

## Durable-state proof

The 381 Supabase migrations are not treated as one undifferentiated root. The following state families have direct Phase 0B evidence:

- identity/agent/versioning: agent foundation, binding/version management, persona identity, Star identity/publication/rehearsal;
- memory/relationship: memory lifecycle/search/ownership, contact identity graph/merge/history;
- workflows: durable missions/work, handoff lifecycle, commitments, work ownership;
- world: life events/canon/life-engine occurrence idempotency, group world projection;
- commerce: wallets, orders, payment/refund/reconciliation, creator ledger/payout, consumer subscriptions/usage;
- operations: provider acceptance/cutover, control flags, audit/financial adjustment;
- channels/presence: WhatsApp directory/leases, Telegram credentials/auth, durable call sessions/device state;
- civic: claim/leadership/relationship lifecycle, refresh/election/pulse;
- skills: versioned skill contracts, bindings, certification/rehearsal.

Migration-by-migration accounting is now materialized in `chatwithstars-migration-manifest.json`: all 381 pinned migration filenames resolve to at least one canonical family/classification. The previously missed 85 files are dispositioned in `CHATWITHSTARS-MIGRATIONS.md`.

## Integration proof

Confirmed integration families now represented in the Integration Ledger include PostgreSQL/Supabase, Flutterwave, NOWPayments, legacy VTPass, Telegram, WhatsApp Web runtime, Facebook, YouTube ingestion, TikTok, Telnyx, Google OAuth, Modal, RunPod, ComfyUI, external video providers, ffmpeg and JEV.

Each retained integration still requires a provider-specific auth/retry/idempotency/reconciliation matrix before final source closure.

## Current closure status

**PARTIAL, not covered.**

The runtime/domain families above are now descendant-traced, but two closure tasks remain:

1. close or explicitly retire the remaining provider gaps in `CHATWITHSTARS-INTEGRATIONS.md`;
2. verify generated migration manifest coverage against the pinned 381-file tree whenever the source pin changes.

The migration accounting gap is closed at the current pin; provider behavior closure is still open. Only after those provider gaps pass may ChatWithStars move back to `covered`.
