# AI operator action, task, memory and artifact contract — V1 integration target

**Normative cross-lane interface proposal approved for implementation planning; IMPLEMENTATION / integration UNVERIFIED.** Date 2026-10-08. This is a `U01–U09` product interface target, **not** a new competing production API. The existing `@masanawa/agents`, `@masanawa/tools`, `@masanawa/skills`, Gateway `agent_shell`/`agent_conversation`, financial quote/receipt services, C07 and postgresql migration authorities remain canonical. U01 exclusively owns new shared **operator contract version 1** and adapter mapping; other windows use this document and submit compatibility changes to U01 instead of creating incompatible action formats. Server API paths in examples are **illustrative, not deployed**.

## 1. Authority graph

```text
Human (authenticated user + current UI/context + explicit instructions)
    -> Gwani/Gwana intent/proposal (untrusted model)
    -> Gateway capability discovery, read/prepare, authorization
    -> typed, persisted task/plan with bounded requested scopes
    -> preview/clarification; one exact user confirmation when consequential
    -> Gateway domain operation executor (Talks, C01–C04 DM, Wallet, Twins, File, Learning)
    -> authoritative readback/reconciliation with receipt
    -> task timeline + chat artifact; resume/retry or explain failure
```

**Only Gateway/domain owners authorize and execute writes.** Agent suggestions carry neither bearer tokens nor signed financial approval. Flutter, mobile shell cards, WhatsApp/Telegram and AI utterances are untrusted request surfaces. Never create a generic `execute_code`, SQL or unrestricted HTTP-fetch capability for AI.

**Identity:** every request includes server-verified tenantId, userId, client session, device-scoped requestId and, where applicable, CharacterId, CharacterSessionId, personaVersion, role and account; account/tenant never accepted from user-controlled body. Scope `public-talk`, `human-dm`, `private-assistant`, `persona-chat`, `direct-twin` is an enum with separate authorization and audio routing. A DM conversation ID never equals a Character session; caller cannot change representation by presenting a forged contextHint.

## 2. Capability registry semantics (typed, discoverable and fail-closed)

Every exposed operator capability has:

- **canonical name + semver/contract version**, supported platform/region, enabled/disabled state; user-facing localized action label.
- **domain owner**, source of truth; `read`/`prepare`/`execute`/`reconcile`/`cancel` sub-operations; input, output and error schema, maximum payload/array lengths, network/media limits.
- **permission predicate** by current account/consent/Host/Twin owner/DM member/blocked status, latest server flags, provider/KYC/custody/beneficiary eligibility, current device/session/risk.
- **execution classification**: (a) read-only, (b) private reversible draft, (c) user-visible nonfinancial send/publication, (d) money/irreversible/privileged. Classification determines confirmation, step-up, quotas, locking and audit; not determined by LLM prompt.
- **cost policy**: model token budget, media bandwidth, authorized platform/creator wallet spend, per-agent rate limit and provider fee; only backend rates are trusted. Insufficient creator Float must not silently cause charge to another user or change attribution; any fallback/reroute must follow published policy.
- **schema/version compatibility** with clients: unsupported card/action yields textual explanatory safe fallback and permission to upgrade; no invisible button doing nothing. Reject unknown tool IDs/revisions rather than mapping to nearest match.
- **observability contract**: immutable traceId, taskId, operationId, exact resulting receiptId/domain reference, support code and privacy-safe metrics.

Minimum V1 catalog, pending real R/C API qualification: `accounts.me.read`, `agents.directory.read`, `agents.twin.owner.read/prepare`, `talks.discover`, `talks.draft.prepare`, `talks.create`, `talks.host.invite`, `talks.host.approve-seat` (price/Host authorization), `human.contacts.lookup`, `human.message.draft`, `human.message.send`, `wallet.balance.read`, `billing.catalog.read`, `billing.quote.prepare`, `billing.purchase.confirm`, `crypto.routes.read`, `crypto.quote.prepare`, `crypto.transfer.confirm` (ONLY upon separately qualified C06), `learning.progress.read/update`, `files.create/read/share/revoke`, `tasks.list/read/cancel`, `settings.profile.read`, `support.issue.prepare`. For unavailable domains return typed `not_qualified` with explanation; do not invent APIs or force unblock by bypassing the domain.

**No canonical path is mandated in this document:** U01 publishes versioned concrete TS interfaces, fixture schemas, mapping from existing Gateway/AgentShell and capability discovery route after inspecting current main/PRs. U07–U09 integrate typed adapters but must not edit shared Gateway `app.ts`/`main.ts` or financial ledgers concurrently. Separate adapter fixtures and composition handoffs are admissible before Work integrates.

## 3. Durable task and operation machine

**Task** (user goal) is distinct from **operation** (single atomic requested domain side effect) and from **agent turn** (text/voice inference). A single task may include many zero-cost reads and few separately approved writes. Task and operation references persist server-side, never just in Flutter local state.

Proposed task phases:
- `proposed` — raw request received, not yet validated as an executable plan.
- `clarifying` — only required missing info asked; versioned option list tied to taskId.
- `prepared` — plan/read-only result and exact draft rendered; not executed.
- `awaiting_approval` — issued canonical short-lived approval/quote and required user action.
- `running` — approved domain operation admitted using user-bound idempotency key.
- `reconciling` — provider/network unknown or client interrupted: read status; NEVER blindly replay a money/send operation with new key.
- `succeeded` — verified domain receipt/readback with final status.
- `failed` — authoritative failure code and safe retry/next step.
- `cancelled` — cancellation accepted **only if irreversible execution did not occur**; later compensation is a new operation.

**Invariant:** no `succeeded` without server evidence; a model statement is not a receipt. Never transform unknown → success because of timeout. Stage events monotonic and append-only, account/tenant indexed, cursor paginated; duplicate event/retry reconciles to one outcome. Cancel, exit app, persona switch, signout and back navigation have specified effects and cannot silently make a completed external transaction undone.

Operation preview and approval bind **userId, tenantId, operationId, exact capabilityVersion, issued quote/action/plan revision, recipient/account, amount/currency/network/fees/expiry, human acknowledgement, device/session reauth when required, server-issued nonce and idempotency key**. A generic "yes" from speech is **not** an approval token; spoken approval must occur within an explicitly armed confirmation UX and must be reviewed with accessible exact terms. Never reuse consent after terms revision, expiration, account switch or new persona.

**Pseudo-schema (documentation, not drop-in code):**

```ts
type OperatorTask = {
  taskId: string; // canonical server ID
  scope: "private-assistant" | "persona-chat"; // public DM context only as minimal reference
  ownerUserId: string; // from auth, never client-writeable
  characterSessionId: string;
  requestedPersonaVersionId: string;
  phase: "proposed" | "clarifying" | "prepared" | "awaiting_approval"
       | "running" | "reconciling" | "succeeded" | "failed" | "cancelled";
  version: number; updatedAt: string;
  steps: readonly {operationId?: string; capabilityId: string; state: string;
    receiptId?: string; errorCode?: string}[];
};
type OperatorProposal = {
  requestId: string; // stable on retries
  taskId?: string; capabilityId: string; capabilityVersion: number;
  contextRef?: {kind: "talk" | "dm-selected-message" | "wallet" | "twin";
    id: string; revision?: string}; // reauthorized by Gateway
  untrustedArguments: Record<string, unknown>; // validate against schema
};
// Later server-issued ApprovalTicket has bound terms, deadline, session/account and hash;
// never include provider secrets nor trust ApprovalTicket minted by the model.
```

Canonical implementation MUST use existing branded IDs/types where available, not copy this literal string shape into 20 divergent schemas. First-class task ownership is scoped by user, not by client tab or current persona, while messages carry actual attributed speaker/persona. Multiple devices: one operation lock and readback winner; local pending journal in Flutter mirrors server state but cannot execute offline.

## 4. Context discipline — consent, memory and person DMs

Provider may receive only minimum typed contextual refs to user-owned/approved resources. Context inclusion order: authenticated user intent → capability description + safe choices → current server state → user-scoped selected memory → explicitly consented content. No blanket message feed retrieval, shared secret, raw API provider credential, account-wide DM context, public Talk transcript or Twin owner's private files. All tool output is **data**, not privileged new system instructions; sanitize prompt-injection attempts from human DM/file/web content. Keep provenance and permission checks at retrieval and again at execution.

**Persistent personal memory** is opt-in, narrowly scoped, reviewable/correctable/deletable with retention and source metadata; don't equate existing memory module tables with an automatically approved memory product. Persona/Twin owner memory cannot be treated as the user's private Assistant memory. Financial account details, other people's messages, precise contact/health or sensitive data require explicit policy/consent or no persistence.

**Selected-message AI help**: human presses Ask Assistant on exact current message IDs; Gateway rechecks membership/block/deletion, evaluates privacy notice and bounds content selection, prepares an ephemeral task context; user sees proposed disclosure. The assistant is not a member of the human DM. Generated draft stays in private Assistant until user reviews and deliberately sends; no auto-reply or invisible third-party content ingestion. If eventual E2EE is approved, no server blind decrypt or undermining E2EE promise; on-device explicit user sharing is separate architecture and key agreement.

## 5. Voice, silent parity and cross-screen handoff

Real private native Gemini Live audio and public LiveKit/DM voice note are separate media tracks, permissions, authorization and audio focus. Live voice is deliberate activation; never start microphone on tab entry. Barge-in stops speaker audio while preserving task phase. If mic denied, disconnected or iOS unsupported, typed/tap route remains complete. Guard against hallucinated/misheard amounts/numbers/address, code-switching Hausa ↔ English, RTL, slow/repeat/correct options, and truncated transcripts. Do not show untrusted ASR as a committed financial instruction. App background, device switch and notification deep link resume task by opaque ID with fresh Gateway authentication/authorization. UI must return to prior tab/scroll/DM/Talk without leaking private speaker audio.

Server-driven structured cards for `review`, `choices`, `approval`, `progress`, `result`, `pending`, `unknown` and `unsupported` are **versioned and presentational**, with accessible equivalents. They embed server-issued opaque action tokens bound to exact revision, never untrusted executable scripts. UI never trusts arbitrary link/download href from tool content without safe allowlist/security policy. A task card is not an authority grant.

## 6. Protocol and safety tests U01 owns at minimum

- malicious model proposes nonexistent capability, wrong contract version, forged account/role/recipient, extra JSON fields, stale quote, payment with generic "yes", revoked DM and forged resource ID → server rejects without side effect.
- same text/voice/tap request maps into **one** taskId/operationId; concurrent cross-device/double taps/timeout/request replay yield exactly one domain write and correct readback.
- on unknown outcome client/user receives `reconciling` and a read-status path, not a second operation; server fails closed on lost auth and terminal states persist.
- old Flutter client/feature flag/offline restart → explicit unsupported/upgrade/cancel, bounded event delta, no crash/no leaked account cache.
- no DM, Twin owner, or public Talk context appears in another person's agent context; prompt injection in file/DM/web cannot authorize another tool.
- active voice playing + Talk public audience + private Agent + DM voice note → deliberate audio focus; no unintended track transmission or copied speech.
- real R/C domain readiness tests stay owned by those lanes: financial ledger, C01 consent, Talk Host authorization, S3 media/object lifecycle and app device validation cannot be "unit mocked green" here.

## 7. Ownership and migration rules

- U01 exclusively owns **new shared operator protocol** (publish schemas, examples, fixtures and a migration-safe adapter into existing shell contracts); U02 task persistence, U03 Flutter state/presentation, U04 authorized product adapters, U05 privacy context, U06 teaching, U07 file work, U08 human selected-message agent bridge and U09 native voice must consume U01 versioned shape. U20 observes build/compatibility without rewriting contract.
- **One Gateway composition owner** coordinates integrating new services with existing C07/R17/C08/finance PRs; no 20 simultaneous edits to `services/gateway/src/app.ts` or `main.ts`. One migration registration owner ensures no reused filename/sequence; create additive migration in isolated module and record proposed order until integration.
- Deprecating direct billing/crypto directive parsing requires real parity/compatibility fixtures; U01 may propose adapters, but cannot alter signed quote/receipt/ledger behavior without financial owner reviews and tests.
- Contract change uses version bump and consumer fixture negotiation, not silent incompatible edit. Work integrator later elects one source and proves full connected server/db/mobile/voice/provider path.

**Status on creation: CONTRACT SPECIFICATION ONLY. Not an existing compiled type file, migration or production endpoint.**
