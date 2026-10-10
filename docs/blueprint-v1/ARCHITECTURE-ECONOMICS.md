# Masanawa v1 — Architecture, canonical contracts, provider economics and release gates
Status: **PROPOSED**, 2026-10-10. This document is not verified executable source and must not change existing runtime providers or financial authority without reviewed migration.

## Architecture decision: modular monolith first
Preserve working boundaries and contract packages inside existing monorepo rather than greenfield microservices.
```text
Android Flutter member app    Flutter admin app    (small optional web/ops)
            \                     |                  /
                   HTTPS/WebSocket/WSS
                  authenticated API Gateway
   +---------+---------+---------+-------+---------+
   | Identity| Chat &  | Audio & | Agent | Ledger, |
   | sessions| presence| social  | Tasks | Commerce|
   +---------+---------+---------+-------+---------+
                   domain services / workers
         PostgreSQL canonical state + outbox/jobs
               object storage / media refs
     external adapters (Gemini, Flutterwave, NOWPayments,
              Telegram, eligible WhatsApp, push)
   static-egress DigitalOcean relay ONLY for requirements
```
Existing workspaces (`apps/mobile`, `apps/admin_mobile`, `apps/web`, `apps/ops`, `services/gateway`, `services/worker`, `packages/*`, `adapters/storage/postgres`, `adapters/crypto/nowpayments`, `database/*`) are inventory starting points, not guaranteed operational endpoints. No direct mobile write to provider, ledger or database. Server holds credentials. Avoid introducing a new wallet/chat/agent backend without a demonstrated need.

### Source-of-truth hierarchy
1. PostgreSQL transactional tables + append-only financial ledger, outbox, operation journal.
2. Authenticated server contracts and authorization decisions.
3. Device-local private cache and outbox as *projections* with deterministic sync; never settlement truth.
4. Models suggest actions but cannot execute spend/delete/publish or authority escalations without policy + consent.
5. External payment/provider statuses are verified, reconciled and linked to internal durable operation IDs.

## Canonical identities and data types
Keep distinct opaque identifiers: `AccountId`, `DeviceId`, `HumanConversationId`, `AgentConversationId`, `PersonaId`, `RoomId`, `AudioPostId`, `MediaId`, `TaskId`, `OperationId`, `QuoteId`, `LedgerTransactionId`. Directory entry is a typed union human/persona; a phone, display name or handle is not a stable financial recipient. Make all external input shape-validated and versioned.

All writes: actor from auth session; operation ID; idempotency key bound to payload+actor; resource expected revision for conflicts; canonical timestamps; typed error; immutable correlated audit ID; explicit state transition. Avoid silently converting old Cr/fiat into MSN, IDs or legacy Talk objects.

### Model contract snippets — illustrative proposals only
```ts
type Money = { assetId: string; atomicAmount: string; precision: number };
type Ack = {
  operationId: string;
  stage: "queued"|"accepted"|"processing"|"completed"|"failed"|"outcome_uncertain";
  resourceRevision: string; correlationId: string;
};
type DomainError =
  "AUTH_REQUIRED"|"FORBIDDEN"|"VALIDATION"|"RATE_LIMITED"|
  "REVISION_CONFLICT"|"QUOTE_EXPIRED"|"INSUFFICIENT_FUNDS"|
  "CAPABILITY_UNAVAILABLE"|"NETWORK_RETRY"|"OUTCOME_UNCERTAIN";
type PurchaseDraft = {
  taskId:string; revision:string; service:string|null;
  selectedOptions:Record<string,string>; missingFields:string[];
  quoteId?:string; status:string;
};
```
Use current [integration contracts](../AUDIO-FIRST-INTEGRATION-CONTRACTS.md) and [wallet contract](../MSN-WALLET-P2P-CONTRACT.md) as review authority; don't duplicate schema exports. These samples explain invariants, **not new compulsory wire JSON**.

## Modular responsibilities and strict invariants
| Domain | Authoritative responsibilities | Forbidden shortcuts | Key cross-boundary tests |
|---|---|---|---|
| Identity | email/phone paths, verified ownership evidence, recovery, session and device revocation, scoped access | numeric PIN treated as SMS verification or sole payment approval | account switch, guessed PIN, revoked token |
| Chats | **fan-to-Masana** DMs and agent replies, voice notes, media and durable outbox | fan-to-fan DM or call, message accepted only after agent response | forbidden human recipient, offline retry, agent ACK and callback recovery |
| Agent tasks | persona/skill configuration, quotas, budgets, quote drafts, gateway model invocation | model text becoming provider payment instructions/financial completion | repeated fields, approval replay, delayed model/audio |
| Masana Home | one text/image/audio post authority, media processing/approval, follows/comments/reactions/moderation | forged member public posts, duplicate media pipelines, false playback | publisher ACL, post once, media cleanup, audio focus |
| Global Rooms | staff-created profession channels, owned by Masana teacher, announcements + questions + optionally moderated discussion, paid/free entitlements | user-created rooms, arbitrary human ownership and unverified paid access | lone member question replied, subscriber price/version, unauthorized reads |
| Money | exact-amount double-entry ledger, funding, quote, authorization, MSN issuance/redemption, internal transfers, settlement receipts | extra chat wallet, float amounts, provider redirect = confirmed payment | double credit/debit, replay, failed provider, rollback |
| P2P | order offers, atomic reserve, claim, verified release, disputes and staffed resolution | screenshot-only release, freeing reserved funds after paid claim | paid vs expire race, freeze on dispute |
| Crypto | asset/network allowlists, custody addresses, deposit confirmations, conversion and withdrawals | unsupported network or unverified payout claims | invalid memo/network, reorg, payout reconciliation |
| Channels | account linking, approved WhatsApp + Telegram webhook, media, consent, normalized chat/task state | shadow personal-account automation or untrusted inbound instructions | signature, dedupe, opt-out, cross-account ID |
| Platform agents | central Masana character bible, profiles, skill-led Rooms, voice/calls, fan memory, weekly missions; **Gwani moderator cases/support** | user-owned agents, fan-to-fan chat, unauthorized new Rooms, agent irreversible moderation | char revisions, admission/owner scope, Gwani case audit and appeals, mission tests |
| Ops/admin | RBAC, approval, case/ticket management, incident controls, quotas, audit and backoffice | showing provider keys, raw transcripts or unrestricted ledger edits | role spoof, operator action audit, rollback |

## Authentication, privacy, Integration safety
- Authenticated identity is server-derived; verify caller permissions **per resource** and media fetch. Multi-account switching cancels subscriptions/outbox ownership and locally encrypted private projections.
- Preserve distinct internal account and character identifiers for routing and permissions. Use standard names and profiles in the product without repeated AI labels. Do not promise end-to-end encryption unless actually implemented and verified.
- Trusted tool boundaries: incoming messages, instructions, documents and retrieved pages are untrusted input. Tool ACLs, typed argument validation, service catalog allowlists, task budgets and consent challenge enforce every side effect.
- Validate webhook signatures on raw payload and fetch authoritative provider transaction status; record dedupe, retry limits and reconciliation.
- Least privilege service accounts and runtime DB roles; secret store not Flutter/PR/log; private object URLs short-lived, revocable according to expiry/access; malware/size/codec validation.
- Retention schedule: public Talks, DM audio, drafts, deleted/replaced media, blocked content, account deletion, dispute/financial evidence, system logs; balance legal needs against minimization.
- Safety and abuse controls: account enumeration/OTP/PIN rate limits, spam and harassment reports, public content moderation, vulnerable-user protections, transaction velocity and limits, administrative separation of duties.
- Launch eligibility for MSN/P2P/crypto is contingent on regional regulatory advice and actual provider approvals; this document is not legal advice.

## Durable state machines
**Chat message:** LOCAL_QUEUED -> SENDING -> SERVER_ACCEPTED -> DELIVERED_TO_PEER (human when supported) -> READ_BY_PEER. Separate agent PROCESSING -> COMPLETED/FAILED. Timeouts from SERVER_ACCEPTED must **look up status**, not resubmit a new task blindly.

**Purchase:** DRAFT -> NEEDS_INPUT -> QUOTED -> AWAITING_AUTHORIZATION -> EXECUTING -> CHECKING_STATUS -> COMPLETED | FAILED | CANCELLED. A temporary unknown result remains uncertain with same operation ID.

**Masana Home post:** ADMIN_MISSION -> WORKER_DRAFT -> MEDIA_PREPARING -> REVIEW -> SCHEDULED -> PUBLISHED | FAILED | REMOVED. Server-enforced publisher role is admin/worker only; member reactions/comments are separate resources. Retry with original post ID and dedupe key.

**P2P:** reserve seller MSN atomically -> awaiting fiat -> claimed -> authorized verified release OR dispute -> resolution/return. No automatic release on screenshot or unchecked timer.

**Removed personal-agent economy:** do not issue new Twin commissions, prices, credit reservations, owner-session purchases or Twin referral payments. Existing posted credits, liabilities, disputes and receipts must remain auditable and be reconciled before retirement.

**Workers:** persistent mission and publication queue with scheduled occurrence IDs, atomic lease, bounded retries/dead-letter, heartbeat, admin pause, revision pinning, costs and scorecard, idempotent post write; reuse worker/scheduler, never add another personal-agent economy or fictional world simulator.

## Platform and stack evaluation (provisional)
- **Keep Flutter**: current code/assets/test investment; dual Android apps; one UI/contract repository abstraction. Evaluate native voice/mic isolation and Shorebird/release policy before changing.
- **Keep TypeScript Gateway + Postgres**: extensive existing services/types, tested ledger patterns; avoid mandatory microservice decomposition. Node 24 and pnpm 12 from root package pins; document Flutter/Android/PG versions from exact checked build environment before qualification.
- **Railway**: currently used; simple deployments. Monthly Hobby minimum $5 including resource usage [1]. Audit direct Git-triggered Railway deploys and migration-on-start before merging to main.
- **DigitalOcean**: preserve the single $4 fixed-egress relay if needed and proven; published 512MiB shared CPU price $4/mo [2]. Do not multiply droplets without load evidence.
- **Neon vs current DB**: Neon free announced 1GB/project in Oct 2026 [3]; possible staging/pilot candidate, **not** license to move financial ledger without backed-up restore, cost/connection and provider comparison. Keep data portable: vanilla Postgres SQL, migrations, pg_dump and staged restore.
- **Gemini**: Gemini 3.8 Live priced at published token/minute rates [4]; choose model through capability/voice QA per locale and budget. A text fallback remains available if voice provider fails; ordinary audio notes independent.
- **Flutterwave**: Nigerian bills APIs require KYC, funded source balance, server IP whitelisting [5]; partner/market-specific availability must be checked. Reuse canonical purchase and onramp adapters.
- **NOWPayments**: retain existing adapter; never assume approved withdrawals, custody or networks from code presence. Qualification uses account credentials privately, sandbox/low-value limits and supported webhook signatures.

## Three-scale costs and caps — deliberately transparent assumptions
These are **planning illustrations**, not a bill estimate or real measured spend.
| Scenario | Illustrative assumptions | Known baseline | Unpriced usage requiring measurements |
|---|---|---|---|
| Internal development | Railway Hobby, 1 minimum fixed-IP relay, Neon Free only if eligible | $5 + $4 = **$9/mo** before consumption overages | storage/backup, Railway compute/network, push/SMS, Gemini tokens, provider charges |
| Pilot | Same base, 100 daily active people, 500 text tasks/day, 100 live voice min/day, 2GB media/day | **$9/mo base** only (not total) | ~3,000 live voice input/output minutes/month. At $0.005 + $0.018/min [4] an artificial fully-active audio-both-sides estimate is ~$69 **before context/text and other charges**; media egress may dominate |
| Growth | 1,000 daily active people, 5,000 tasks/day, 1,000 live voice min/day, 20GB media/day | base no longer representative | voice illustrative ~$690 for 30,000 min; dedicated compute, queue, storage, egress, backups, operational support required |

**Sensitivity:** audio rates are input/output independent, reprocessed session context changes cost, and not every input minute produces output minute. Store actual model token usage per task and enforce max duration, context compaction, per-user quota, task budget and global hard-stop. Current price page shows 3.8 Live audio ~$0.005 input/min and ~$0.018 output/min [4]. Vendor prices/quotas may change; review at deployment. Flutterwave processing fees/provider margins and merchant P2P liquidity are distinct variables. Media bytes/user/day × retention days and external egress are mandatory in cost dashboard. Do not infer profitability without real prices and operational risk.

## Portability and reversible choices
Single canonical SQL schema, schema migration checksums, encrypted nightly backups in controlled storage, actual off-account restore exercise, adapters with explicit capability flags, provider-neutral media references, replaceable text/voice model interface, one financial authority. Version any disruptive API changes and dual-read/dual-write migrations with reconciliation. Never mutate applied SQL in place.

## Performance targets (candidate SLOs, benchmark before adoption)
Warm tab render cached content without network wait; separate cold/warm metrics on low-end Tecno-class Android. Define P50/P95 message server ACK and first AI text separately; provider purchase outcome can remain pending. Keep network retries bounded and preserve drafts. Audio permission-to-local playback test before Live API test. Target 99.5% nonfinancial API availability for pilot only after measuring capacity; money correctness and no duplicate debit take priority over speed. Alert on backlog, unreconciled transfers, stuck media, error rates, costs, credit runout.

## Acceptance and release gates
1. **Design:** approved roles/scope/SC control-level specs, device wireframes, decision records and current stack TCO; factory structural design check passes but is not proof.
2. **Source:** each slice has API/db/client/adapters/tests, aligned contracts and exact file owner; known TypeScript/Vitest/Dart/SQL failures fixed; PR review and real executed commands at head SHA.
3. **Integration:** one non-deploying unified SHA, migrations/ports/routes wired, PG18 fresh+upgrade tests and release APK type/analyzer/tests; inspect CI and Railway deploy hooks. Automated CI zero-step means BLOCKED, never PASS.
4. **External:** second-device chat/audio/calls, authorized provider tests with redacted evidence, cross-account denial, crypto/fiat reconciliation, wallet P2P race negatives, Telegram/WhatsApp official endpoints, real admin ops, low-data/no-permission behavior.
5. **Release:** signed APK and pinned package/cert/hash, environment/config readiness, feature flags, recovery/backups plus **restored DB and media**, rollback rehearsal, regional eligibility signoff, monitoring and cost controls. A health HTTP 200 or successful build is insufficient.

Sources retrieved 2026-10-10:
[1] https://docs.railway.com/pricing/plans
[2] https://www.digitalocean.com/pricing/droplets
[3] https://neon.com/blog/neon-free-plan-1-gb-per-project
[4] https://ai.google.dev/gemini-api/docs/pricing
[5] https://developer.flutterwave.com/docs/bill-payment
Source/current agreements: ../AUDIO-FIRST-INTEGRATION-CONTRACTS.md, ../MSN-WALLET-P2P-CONTRACT.md, ../BACKEND-STORAGE-OPERATIONS-20261009.md, ../FLUTTER-RELEASE-AND-SHOREBIRD-POLICY.md.

## Confirmed scope subtraction (2026-10-10)
Do not develop or expose personal Twins, user clone training/onboarding, Twin directories, Twin owner-access sessions/offerings, paid Twin seats, gift-based Twin payouts, credit plans, attribution or commissions. Platform-owned Gwani/Gwana/Masana configuration, professional global Rooms, creator-only Home and server-authorized fan-to-Masana conversations/calls remain. Previous APIs/tables may exist in the inherited codebase; deprecate them without deleting applied SQL or forfeiting existing ledger obligations. See [legacy cleanup](LEGACY-SCOPE-CLEANUP.md). Presentation uses name/avatar and role if useful, without repetitive AI disclosures or trust-oriented copy.

## Owner-confirmed new character platform / 2026-10-10
[Masana-only Home and character-mission architecture](MASANA-CREATOR-NETWORK-20261010.md) supersedes member-created audio/Talk content and old audio-only Home UX. One typed `PublicPost` accepts text/images/audio and future-gated video from server-authorized Masana professionals; user `Comment`, `Reaction`, `Follow` and Chat/Call remain available under member authorization. 1) agent bibles versioned and curated by Admin; 2) weekly missions and editable local-time posting slots via durable worker; 3) content generation, media review and idempotent publication with global per-agent budgets; 4) scoped fan memories stored in existing PostgreSQL memory package (character + user IDs), evidence/consent/expiry/deletion; 5) full agent profiles, directory, conversation and eligible call capabilities. No clone or user-uploaded public posts. All global Rooms are platform-created and profession-labeled with a default Masana teacher; members ask questions and see permitted replies. There are **no** human-to-human DMs/calls or member-owned Rooms. Avoid a new independent memory package or duplicate feed DB. [Twelve fictional profiles with profile-photo concepts and four unproduced additional portrait assets](MASANA-STARTER-CAST-20261010.json) are proposals; no assets or live account seeding is claimed. Budget for periodic content job, image/audio generation, image storage, media egress, fan memory writes/retrieval and optional live voice separately; enforce a stop switch. Source financial authority/Gwani remain unchanged pending tests.

## New owner scope: global professional Rooms, digital subscriptions and video readiness
Read [the canonical Rooms/admin architecture](MASANA-ROOMS-ADMIN-ARCHITECTURE-20261010.md) before modifying contracts. Server rejects fan-to-fan messaging/calls and fan Room creation; no phone-book contacts. Member participation occurs in Masana-owned Room questions/comments, not private human DMs. Subscription entitlements have mutable admin *pricing offers* but immutable accepted price versions and external store/provider verification (Google Play Billing may be mandatory in Play-distributed apps). Gwani can investigate reports with authorized evidence, reversible actions and operator-gated bans/unbans; no unconstrained moderation powers. Future Home video fields and player are designed now but disabled until encoding/CDN/cost/device qualification. Keep one modular monolith + PostgreSQL worker, reuse existing Flutter/mobile/admin and ledger/voice/media packages. Seed plan: 12 professional agents, 12 owned Rooms, 24 sample published-style records in staging fixture, 12 Room welcome posts and first-answer test fixtures, not yet loaded into real DB. Cost model must add fan-out, room answer budgets, subscriptions and video delivery economics.

## External Videos infrastructure / owner-confirmed 2026-10-10
**Front-end alone is insufficient:** extend canonical TypeScript Gateway and worker, PostgreSQL migrations, server content ACL, audit, admin sources and Flutter player. Proposed source metadata: `ExternalVideoSource(provider, channelId, embed/discovery capability, auth reference, cursor, sync mode, enabled)`; `ExternalVideo(provider, videoId, sourceId, publishedAt, metadata, moderationState, embedability)`; deduped webhook/import record and lease/reconcile status. Treat external video ID unique per provider. External clip is never a platform-original `PublicPost` claiming a Masana publisher. Store **no MP4**, just provider IDs/approved metadata and source attribution. Import only from admin-qualified channels via official provider APIs or manually approved public video links; YouTube WebSub+playlist first, TikTok creator-authorized Display API next, Facebook eligible Page permission or manual only. Worker's retries, auth revocation and deleted-content reconciliation are mandatory. Frontend host uses official iframe or permitted SDK in scoped Android WebView; preserve attribution, ads/controls, one active player, data-saver, offscreen dispose and an open-at-source fallback. No provider-specific raw streaming/copying. For key schema/API/ops/test contract read [Home external videos](HOME-EXTERNAL-VIDEOS-20261010.md). No financial database tables are replaced by this content change, but broader Masanawa rebuild requires full canonical schema migration and verified upgrade from old state.
