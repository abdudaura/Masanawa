# Continue Here

## LATEST CORRECTION — Contacts and full pending-work reconciliation (2026-10-08)

**Owner re-audit supersedes the initial plan's claim of completeness.** The blanket development pause stays **lifted for independent exact-path work**. The initial U01–U20 assignments are unchanged; **new U21–U30** cover missing product experience, and **F01–F18** explicitly recover every R01–R19/C01–C08 foundation from current draft source. Do not run 48 writers against shared files. Read [master re-audit](docs/UNFINISHED-SCOPE-RECONCILIATION-20261008.md), [Contacts/phonebook](docs/CONTACTS-AND-ADDRESS-BOOK-EXPERIENCE-20261008.md), [U21–U30 + F01–F18 assignments](docs/ADDITIONAL-U21-U30-AND-FOUNDATION-F01-F18-20261008.md), [28 additional prompts](docs/ADDITIONAL-WINDOW-LAUNCH-PROMPTS-20261008.md), [all 79 unchecked historic tasks](docs/LEGACY-150-TASK-RECONCILIATION-20261008.md) FIRST. Existing C01 #468 has an unmerged contacts management UI; preserve it, add a real nested Chats→Contacts screen and optional consented **device-local** phonebook rather than rebuilding C01 or silently uploading phone numbers. K13–K20 cover Contacts tests. Existing Work #497, Firebase #461, C02/C05/C06 duplicate migrations, R17/C08 route integration, #457 CI and real device/provider/DB checks remain pending. Additional F windows must resume/reconcile existing code, never overwrite it or claim false DONE.


## OWNER OVERRIDE — PARALLEL DEVELOPMENT RESUMES (2026-10-08)

**The owner explicitly lifts the blanket consolidation pause imposed at 2026-10-08T13:44Z. Start or resume nonoverlapping implementation across twenty individually assigned U01–U20 ChatGPT windows NOW while ChatGPT Work usage is unavailable.** The freeze section below is preserved as **historical context only**, not an ongoing prohibition. This is a scheduling override, **not permission** to merge unverified PRs, change production, bypass security/CI, overwrite existing R/C/Work code or claim false verification.

**To launch the 20 windows without duplicate claims, copy one uniquely numbered U01–U20 prompt from [`docs/20-WINDOW-LAUNCH-PROMPTS-20261008.md`](docs/20-WINDOW-LAUNCH-PROMPTS-20261008.md).**

**Mandatory first reading:** [20-window assignments and copyable prompt](docs/20-WINDOW-AI-CHAT-EXECUTION-20261008.md), [product outcomes](docs/AI-FIRST-PRODUCT-AND-HUMAN-COMMUNICATION-20261008.md), [operator task/security contract](docs/AI-OPERATOR-ACTION-AND-TASK-CONTRACT-V1-20261008.md), [human Chat and contextual AI contract](docs/HUMAN-CHAT-AND-CONTEXTUAL-AI-CONTRACT-20261008.md) and [integration/acceptance evidence](docs/20-WINDOW-INTEGRATION-AND-ACCEPTANCE-20261008.md). Existing R01–R19/C01–C08/J01–J11, five tabs, Flutter/Shorebird, financial and privacy rules remain authoritative. Give **exactly one U number to each development window**.

**Operate safely:** inspect fresh main, live open/draft PR heads and touched files, five-minute exact-path leases and `docs/workstreams/` claims. Preserve Work draft [#497](https://github.com/Baatiku/masanawa/pull/497), Firebase #461 and existing C/R drafts. Implement complete source/tests in owned, isolated modules, leaving shared Gateway composition, migration registrations, wallet, Firebase and Flutter root router to their elected integrators. All unverified new feature PRs **DRAFT/UNMERGED** with SHA-specific handoff. CI #457, Postgres, provider credentials and two-device/audio tests remain outstanding; document unexecuted tests once, don't retry impossible checks. **When Work resumes**, use one controlled final reconciliation to combine branches and test/merge only genuinely verified changes.


## Historical consolidation freeze — 2026-10-08T13:44Z (superseded by owner override above)

The owner has explicitly requested one clean, unified codebase with all branch work accounted for before local compilation and the next feature round. **ChatGPT Work integration is active in PR #497. Pause new feature/lane claims until this consolidation checkpoint ends.** Existing windows should preserve their current source, commit/push their precise handoff and current SHA, then leave further scope to the Work integrator. Do not erase unfinished source, silently replace shared composition, start competing migrations, or mark a lane DONE on source review alone. This freeze coordinates the user's requested consolidation; it does not claim tests are green or changes are merged.

Work has preserved Firebase #461 and recorded local-agent build values in `docs/FIREBASE-LOCAL-COMPILATION-HANDOFF.md` on #497. C02 uses #472's schema/API because C03/C04/C05 depend on it; #475 UI/outbox is adapted instead of applying its competing0017. Five-tab root integration is preserved at #497. Read the current [Work evidence and remaining queue](https://github.com/Baatiku/masanawa/blob/work/work-lane-consolidation-20261008/docs/workstreams/work-integration-verification-20261008.md) before touching any shared path.


## Mandatory all-window handoffs → one final ChatGPT Work integration (2026-10-08)

**Every R01–R19 / C01–C08 / shared owner window must commit and push a complete, repository-visible SHA-specific handoff in `docs/workstreams/` and link it from its PR before leaving a lane.** This is required even when code is partially implemented, CI is exhausted, credentials are missing, or a feature is blocked. The handoff must distinguish missing source from unexecuted tests, record exact branch/PR/SHAs, changed layers, test commands/results or exact blockers, ownership collisions, dependencies, and next actions. **Do not use chat-only reports as the handoff. Do not call a partial slice `IMPLEMENTED_UNVERIFIED`.**

[**docs/FINAL-WINDOW-CONSOLIDATION-HANDOFF-20261008.md**](docs/FINAL-WINDOW-CONSOLIDATION-HANDOFF-20261008.md) is the mandatory template and instructions for the **single final ChatGPT Work integration window** that the owner will initiate after development checkpoints. That window must inventory all open/draft/relevant closed PRs and handoffs, reconcile duplicate C02 [#472](https://github.com/Baatiku/masanawa/pull/472)/[#475](https://github.com/Baatiku/masanawa/pull/475) and C05 [#474](https://github.com/Baatiku/masanawa/pull/474)/[#476](https://github.com/Baatiku/masanawa/pull/476) work, complete code gaps, restore #457 CI, execute real tests/Android/providership gates, and **merge only validated changes**. All existing five-minute claim and shared R17/C08/financial ownership rules remain in force. This is a future owner-led integration procedure, **not a claim that Work has run or anything is done**.


## Backend/database portability and implementation evidence audit — 2026-10-08

**New backend reality check (documents, not code changes):** [docs/BACKEND-DATABASE-PORTABILITY-AUDIT-20261008.md](docs/BACKEND-DATABASE-PORTABILITY-AUDIT-20261008.md) inspects the actual Postgres/Gateway/migration source and connected Railway production service metadata; [docs/DATABASE-REDEPLOYMENT-AND-RESTORE-RUNBOOK.md](docs/DATABASE-REDEPLOYMENT-AND-RESTORE-RUNBOOK.md) defines a safe, permission-gated fresh-account restore test; [docs/BACKEND-FEATURE-TRACEABILITY-20261008.md](docs/BACKEND-FEATURE-TRACEABILITY-20261008.md) maps each five-tab function to required Flutter→API→auth→DB/media/events→readback **executed** evidence.

**Highest risk (not a verified outage):** Running Railway PG18/pgvector with `masanawa-postgres` 500 MB volume has no **verified** off-account recoverable backup or actual restored copy from this audit. Gateway is configured to use `/healthz` for Railway health while DB/schema readiness is `/readyz`; recent Gateway deployments are `NEEDS_APPROVAL` and source `main` is not verified deployed. The existing Alpha bootstrap mutates demo identities and **must never substitute a production schema-only migration CLI**. Memory/world schema roots exist but are outside the Gateway's `platformProductMigrationRoots()` manifest; their required lifecycle needs classification. Flutter still has the old four-tab router and Railway-specific API defaults; don't call source presence end-to-end completion. All production DB content, backup/restore, provider and device checks remain **UNVERIFIED**.

**Parallel implementations begin/continue now:** windows must own **complete end-to-end code slices** in their existing R/C lane, not tiny partial fragments. If #457 Actions quota/credentials/physical device verification block executable tests, **do not keep retrying**; document exact deferred Work commands, status and risks, commit complete owned source, leave PR **draft/unmerged**, and proceed to next safe available work after checkpoint. *No block converts PARTIAL_IMPLEMENTATION/IMPLEMENTED_UNVERIFIED to DONE.*


## Documentation finalized for implementation windows — 2026-10-08

**The owner-approved product requirements are ready for implementation. Do not spend new windows re-planning the five-tab design.** Begin with [docs/IMPLEMENTATION-KICKOFF-20261008.md](docs/IMPLEMENTATION-KICKOFF-20261008.md) for the **definitive R01–R19 and C01–C08 parallel lane map**, one R17/C08 navigation integrator, shared Gateway/ledger/migration ownership, exact evidence gates and the copyable implementation prompt. Use [docs/REQUIREMENTS-RELEASE-GATE-CHECKLIST-20261008.md](docs/REQUIREMENTS-RELEASE-GATE-CHECKLIST-20261008.md) to crosscheck **all 77 traced requirements and 11 integrated journeys**, with full wording in `docs/OWNER-REQUIREMENTS-TRACEABILITY-20261008.md`.

**Important live work, recheck before claiming:** C01 backend source exists in draft PR [#468](https://github.com/Baatiku/masanawa/pull/468) but remains untested/unmerged; shared Gateway composition overlaps R18 profile draft [#435](https://github.com/Baatiku/masanawa/pull/435) and needs semantic reconciliation. Messaging reference audit [#467](https://github.com/Baatiku/masanawa/pull/467) is a separate **unmerged** documentation draft and does not supersede canonical docs. Shared Actions budget/runner verification remains under [#457](https://github.com/Baatiku/masanawa/issues/457) and [#460](https://github.com/Baatiku/masanawa/pull/460). Do **not** duplicate these PRs, merge them without executable tests, or resurrect a temporary four-tab shell.

**Final product shell remains exactly Talks · Chats · Assistant · Wallet · Agents, with Assistant centered and an in-chat Gwani/Gwana switch.** This new documentation closes the planning handoff only, not code implementation or release acceptance.


## Mandatory owner requirements coverage audit — 2026-10-08

Before selecting any R01–R19 or C01–C08 implementation lane, read [docs/OWNER-REQUIREMENTS-TRACEABILITY-20261008.md](docs/OWNER-REQUIREMENTS-TRACEABILITY-20261008.md) and [docs/WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md](docs/WHOLE-PRODUCT-ACCEPTANCE-JOURNEYS.md). These map the owner's complete **documented** conversation decisions, current canonical requirements, cross-tab journeys, conflicts and tests to the existing R/C gates. They do **not** add a competing milestone system or imply functionality is implemented; do not promote explicitly undecided group/call/E2EE/future revenue concepts into shipped promises. All affected windows must cite requirement IDs and actual executable/e2e evidence in their handoffs. The five-tab decision remains **Talks · Chats · Assistant · Wallet · Agents** with one centered, switchable Gwani/Gwana chat. Final document traceability is a quality guard, not a substitute for two-device, real financial/provider, Live audio and CI #457 evidence.


## Owner-approved final five-tab navigation — 2026-10-08

**The final mobile navigation target is exactly five tabs, left to right: Talks · Chats · Assistant · Wallet · Agents.** The **Assistant is the center tab** with two tabs on each side. [docs/APP-SHELL-CONTRACT.md](docs/APP-SHELL-CONTRACT.md) and [docs/END-TO-END-UX-ARCHITECTURE.md](docs/END-TO-END-UX-ARCHITECTURE.md) are canonical for every R17/C08 and C01–C08 implementation window. This **supersedes** earlier four-tab plans and conditional Chats redesign proposals **as the target product architecture**, not as a claim that the current APK implements it. Do not build a temporary alternative shell that will require a second redesign.

**Talks** inherits former Home Explore/Live public audio feeds, Host/Seat/gift/replay and sole Start Talk FAB; there is **no separate Home tab**. **Chats** is authenticated private **human-to-human** text/voice-note messaging. **Assistant** is **one private Gwani/Gwana chat interface** with an in-chat Gwani ↔ Gwana switch preserving allowed conversation/task continuity and per-message persona attribution; voice, typing and tap parity. **Wallet** owns distinct financial balances, Billing/Crypto and qualified transfers. **Agents** is the complete Masanawa Agents/Experts and Twins discovery/management area; do not bury it inside Chats. Preserve old route meanings/deep links with typed aliases and avoid duplicating public Talks, human DMs or money state.

The owner approved the five-tab architecture on 2026-10-08; **Flutter migration, service wiring, end-to-end tests, CI and Android qualification remain OPEN/UNVERIFIED**. One R17/C08 integration owner must coordinate shared router/tab/notification/profile and root UI edits with existing R01–R19/C01–C08 owners under the five-minute lease rule. Feature implementation must honor privacy, financial authorization, native live audio and offline/history requirements; a document is not delivery evidence.

## Approved additive communication and voice-first operator extension — 2026-10-08

**Mandatory reading for every implementation window:** [docs/COMMUNICATIONS-EXTENSION-PLAN.md](docs/COMMUNICATIONS-EXTENSION-PLAN.md) is the canonical **C01–C08** cross-window ledger for person-to-person private text/voice messaging, durable fast chat history and low-data caching, contact privacy/realtime/notifications, qualified in-app crypto transfers, and Gwani/Gwana's authorized cross-app actions with **voice, typing and taps** equally complete. It carries concrete acceptance, dependencies, task ownership and a copyable window prompt. Owner-approved extension discussion is tracked in issues [#462](https://github.com/Baatiku/masanawa/issues/462) and [#463](https://github.com/Baatiku/masanawa/issues/463). **Plans are not implementation evidence.**

Preserve all R01–R19 work and implement C01–C08 against the **single owner-approved Talks · Chats · Assistant · Wallet · Agents target**. Coordinate one root-shell migration through R17/C08 with real messaging and persona-switch readiness; do not ship a temporary four-tab arrangement or reinterpret old AI chat links as human DMs. Human-hosted public Talks, full personas, creator earnings, private assistant isolation, Billing/Crypto, WhatsApp/Telegram channels and current UI identity remain mandatory. Implement new services additively, reusing real auth, Postgres, event, agent and wallet/ledger authority. New extensions are **not DONE** because these instructions exist.

Independent windows may claim bounded C01–C08 lanes under `docs/MULTI-WINDOW-WORK.md` with the five-minute repository-visible lease; avoid overlapping active R lanes, shared migrations, Gateway, financial authority or mobile shell. Shared Actions/billing/runner recovery remains with owner Work as documented in #457; do not merge unverified PRs.

## Shared GitHub Actions verification incident — owner using ChatGPT Work (2026-10-08)

The repository owner has decided to use **ChatGPT Work** to investigate shared
Foundation CI and Mobile Build runs failing **before any job steps execute** and to
complete the missing cross-window PR verification. This is planned owner action,
**not evidence that Work has started or fixed CI**.

Read [docs/WORK-CI-RECOVERY-HANDOFF.md](docs/WORK-CI-RECOVERY-HANDOFF.md) and
[issue #457](https://github.com/Baatiku/masanawa/issues/457) before diagnosing
GitHub Actions or reporting verification status. Other windows may continue their
non-conflicting R01–R19 code lanes; leave central CI/runner/Actions settings and
merge verification coordination to the owner's Work session. A failed workflow
with **zero steps** does not establish a code/test failure or success. Keep
unverified implementation PRs draft/unmerged and preserve the 5-minute claim rule.


## Current improvement sequence — 2026-10-08

Latest approved navigation target: **Talks · Chats · Assistant · Wallet · Agents**, with **Assistant at the center**; Talks owns public Explore/Live, Chats owns private person-to-person messages, and Agents retains Experts/Twins. Activity and profile remain in the header, and **Start Talk** FAB belongs only to Talks. Assistant is one private chat with Gwani/Gwana switch inside it. This supersedes previous bottom-navigation rules for future implementation; see APP-SHELL-CONTRACT.md. The current Flutter source still uses the prior shell and must be migrated and qualified without feature regressions.
Profile photo editing and complete identity/settings actions are mandatory. Default
personas must be compelling through competence, natural style and role consistency,
with clear AI identity and respectful exits. See R17–R19 in the readiness ledger.

The human-hosted Talk product remains locked; the five-tab end-state above is approved, with R17/C08 code migration still open. The user's latest mobile acceptance exposed
unavailable audio/personas and inactive participant actions; the current work is to
complete the approved target architecture with one coordinated migration, not restart merged foundations.

Read the canonical documents below, then **docs/MOBILE-READINESS-PLAN.md** and
**docs/DEFAULT-AI-PERSONAS.md**. Their 2026-10-08 requirements supersede older dark-theme,
Nigeria-only wallet, limited-language and blanket no-AI-event-context assumptions.
Dated workstream reports record implementation history, not full release acceptance.

First implement a WhatsApp-style white default with vibrant green (R01), then resolve
live audio/persona readiness and participant wiring (R02–R04). Billing recovery/global
wallet and qualified Billing/Crypto (R05–R08) are equal core priorities. Finish AI event
awareness, animated gifts, localization, deletion, replay/push and release gates (R09–R16).
The ledger contains exact evidence, dependencies and acceptance; tasks remain open.

Wallet, Billing and Crypto now follow `docs/VOICE-FIRST-INTERACTIONS.md`: a private
voice-first conversation with interactive cards, complete text/tap alternatives and
one durable server-authorized task. Conventional forms are optional editing mode.
Low-literacy users must complete supported journeys without reading or typing.


## Canonical product reset — 2026-10-07

Masanawa is now a **human-hosted live AI conversation network**.

The ordinary-user product is no longer Twin-first, Room-first, or a directory of AI agents.
The fundamental public object is a **Talk**: a real human host starts a live public audio
conversation and may bring human speakers, Masanawa Experts, or user-owned Twins into a
small number of active Seats while an unlimited audience listens and participates.

Read these first for any consumer-product work:

- `docs/PRODUCT-NORTH-STAR.md`
- `docs/TALKS-PRODUCT.md`
- `docs/MOBILE-SCREEN-ARCHITECTURE.md`
- `docs/CONSUMER-SERVICES.md`
- `docs/APP-SHELL-CONTRACT.md`
- `docs/MULTI-WINDOW-WORK.md`
- `docs/MOBILE-READINESS-PLAN.md`
- `docs/DEFAULT-AI-PERSONAS.md`
- `docs/VOICE-FIRST-INTERACTIONS.md`
- `docs/COMMUNICATIONS-EXTENSION-PLAN.md`

### Non-negotiable consumer rules

- Every public live Talk has at least one **real human host actively present**.
- AI-only autonomous public Talks are forbidden. If the human host leaves beyond the
  reconnection grace period, the Talk pauses/ends rather than becoming synthetic filler.
- Human participation is free. Hosts decide who receives human speaker Seats.
- AI participation uses paid **AI Seats**. The host can add an Expert/Twin, or an audience
  member can sponsor an AI Seat subject to host acceptance and capacity.
- Launch default is **6 active Seats maximum**, with at most **3 AI Seats**. Policy may
  tune these limits later, but scarcity and human presence are deliberate product rules.
- Platform **Experts** are Masanawa-managed specialist AI personas.
- A user's **Twin** is an owned, customizable AI persona that can be hired into Talks.
  Twins are not autonomous content farms and are no longer the app's top-level identity.
- A Twin owner can privately **Direct Twin** during a Talk with short instructions such
  as challenge, ask for evidence, defend a position, be concise, or emphasize a point.
- There are no consumer **Rooms**. Teaching, research, news, storytelling, search,
  writing and similar AI abilities are capabilities consumed inside Talks or through
  the private Gwani assistant.
- The only standalone consumer service families are **Billing** and **Crypto**.
- Financial actions are always private, confirmed and server-authorized. They never leak
  into the public Talk transcript/audio simply because the user invokes Gwani.
- Private assistant conversations and public Talks are explicitly separate modes.
- The approved final mobile shell is **Talks · Chats · Assistant · Wallet · Agents**. Talks contains **Explore** and **Live Talks**; Assistant at center has one Gwani/Gwana-switchable private chat.
- A private Gwani entry point is globally reachable without creating another top-level tab.
- Simplicity is a product requirement: prefer one adaptive screen plus sheets/states over
  several nearly identical screens.


- Default visual experience is white/light with vibrant WhatsApp-style green; no automatic
  OS-dark fallback. Keep the approved Masanawa logo and compact familiar controls.
- Masanawa is global: language, user locale, country and currency are separate concerns.
  Service availability is exact provider/account/market qualification, not a blanket promise.
- Every visible action is connected or explains an actual capability restriction; no inert
  Add Expert, Invite person, Add My Twin, wallet or transaction controls.
- AI personas receive authorized Talk/stage/event context and never private financial data.
- Account deletion is a durable in-app and external request workflow, not merely logout.

### Product language

Use these user-facing terms consistently:

- **Talk** — public live/replayable conversation
- **Host** — real human who starts and remains responsible for the Talk
- **Seat** — active speaking participant position
- **Audience** — listeners who are not currently speaking
- **Expert** — Masanawa-managed specialist AI
- **Twin** — user-owned customizable AI persona
- **Seat fee** — price to place an AI persona in a Talk
- **Sponsor seat** — audience member pays for an AI persona and asks the host to admit it
- **Direct Twin** — private live instructions from the Twin owner to their Twin

Do not reintroduce Clone, Agent Float, CharacterVersion, Skill graphs, Workflow internals,
provider internals, or execution reserves as ordinary-user concepts.

## Services

Only these families receive dedicated consumer flows:

1. **Billing** — airtime, data, electricity and TV/cable fulfillment through Flutterwave
   where live account/provider qualification supports the exact operation.
2. **Crypto** — eligible deposits, buys, conversions and withdrawals through NOWPayments,
   with asset/network/operation eligibility checked dynamically and expensive Ethereum
   mainnet ERC-20 routes excluded by policy.

Everything else is an AI capability, not a service section.

## Technical continuity

This product reset does **not** discard the validated identity, memory, runtime, Skill,
Tool, Provider, channel, commerce, security, ledger, recovery or audit foundations.
Those remain internal platform architecture and should be reused behind the simpler
consumer model.

WhatsApp and Telegram remain important channels for private Masanawa assistance and
account-linked experiences, but the public Talk network is designed primarily around the
Masanawa app where live audience/Seat controls can be represented correctly.

## Canonical branch and parallel-work rules

`main` is the **only** canonical product branch for local pulls, APK builds, deployment
qualification and product continuation. Work branches are temporary implementation lanes:
they are never a second source of truth and completed work must merge back to `main`.

For a normal local update, use `git checkout main` followed by `git pull origin main`.
Do not pull, merge or build from old `work/*`, `ci/*`, `phase*`, `docs/*` or archived
branches unless a current active workstream explicitly requires repository recovery.

Open PRs from product directions that predate the 2026-10-07 Talk reset are archival and
must be closed rather than treated as pending product work. Historical branches may remain
only to preserve recoverable commits; their existence does not make them canonical.

Read `docs/MULTI-WINDOW-WORK.md` before editing. A workstream claim expires after
5 minutes without repository-visible work. Preserve useful work from stale branches, but
stale ownership itself is not a blocker.

Dated files under `docs/workstreams/` are implementation history. They do not override
the current product documents listed above.

## Immediate product sequence

Follow R01–R19 in `docs/MOBILE-READINESS-PLAN.md` and C01–C08 in
`docs/COMMUNICATIONS-EXTENSION-PLAN.md` without displacing the existing priorities. Preserve the implemented shell,
vertical discovery, Talk persistence, audio/AI dispatch, social/safety, commerce and
provider foundations. A merged feature or registered worker is not end-to-end acceptance.
Claim one non-overlapping task and record implemented/tested/deployed/device states separately.
The next concrete implementation is R01 shared light theme; R02 must diagnose the user's
actual Audio unavailable failure, and R03 must qualify an available default persona.

## Deferred web implementation

`docs/WEB-APP-PLAN.md` defines the later consumer web experience and W01–W06 phases.
It follows the approved Talks · Chats · Assistant · Wallet · Agents target, seventeen personas, voice-first services and
shared account/financial authority. Existing apps/web is a foundation scaffold, not a
completed consumer app. Web implementation is explicitly DEFERRED; preserve current
mobile R01–R19 and shared integration priorities. Planning reserves no web code paths.
