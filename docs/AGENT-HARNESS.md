# Masanawa Agent Harness

Status: foundation architecture, 2026-10-05.

## Product direction

Masanawa should not become a collection of unrelated chatbots. The user-facing
identity (Gwani, Gwana or a creator twin) stays simple, while a shared agent
harness coordinates durable work behind the conversation.

The harness is infrastructure around an admitted CharacterSession and AgentRun.
It does not replace canonical domain authorities.

User experience:

`channel -> agent identity -> harness -> Skills/Tools/Workflow/Commerce -> progress/result`

The same work can originate from Android, WhatsApp, Telegram or later voice
channels and must remain recoverable when the originating client disconnects.

## Canonical mapping

Do not invent a parallel "work" database.

- **Conversation identity:** existing Character + CharacterVersion.
- **User continuity:** existing Relationship + CharacterSession.
- **One execution attempt:** existing AgentRun.
- **Durable user-visible work:** existing Task.
- **Multi-step orchestration/checkpoints:** existing WorkflowRun.
- **Capabilities:** existing SkillVersion assignments and Tool/domain adapters.
- **Authority:** existing Security AuthorityContext, approvals and scoped resource IDs.
- **Money:** existing Commerce/Float/customer-wallet authorities.
- **Channels:** existing Android, WhatsApp and Telegram adapters.
- **Progress transport:** existing mobile shell events plus equivalent channel projections.

The app may label Tasks/WorkflowRuns collectively as **Work**, but that is a UX
projection, not a second persistence model.

## Harness responsibilities

The harness may:

1. compile admitted context for one AgentRun;
2. decide whether the request is a direct response or durable work;
3. select only assigned/authorized SkillVersions;
4. start or resume Tasks and WorkflowRuns through their canonical services;
5. delegate bounded sub-runs while preserving root AgentRun lineage;
6. emit truthful progress events from real state transitions;
7. pause for explicit approval when a consequential action requires it;
8. continue server-side after a client disconnects when the underlying Task or
   WorkflowRun is durable;
9. collect outputs and project a concise result back through the active channel.

The harness must not:

- write billing, crypto, wallet, commission or provider state directly;
- invent permissions from model output;
- execute a Tool/Skill that is not admitted by assignment + authority;
- treat a model statement as proof that an external action succeeded;
- bypass idempotency, approval, settlement or reconciliation boundaries;
- create hidden long-running work that has no Task/WorkflowRun identity.

## Progress model

Progress is evidence, not animation. Recommended phases:

- `queued`
- `understanding`
- `working`
- `waiting_approval`
- `waiting_external`
- `completed`
- `failed`

A progress event should reference the current AgentRun and, when durable, the
Task/WorkflowRun. Channel adapters are free to summarize phases, but must not
fabricate steps.

Example mobile projection:

- **Gwani is working** — Comparing available plans…
- **Approval needed** — Confirm the ₦2,000 purchase.
- **Completed** — Electricity token received.

## Subworkers

Subworkers are internal execution units, not extra user-visible personalities.

A root AgentRun may create bounded child AgentRuns for specialized work such as
research, documents, billing preparation or teaching. Child runs:

- share the admitted tenant/user/relationship boundary;
- preserve root/parent AgentRun lineage;
- cannot acquire broader authority than the root run;
- cannot independently spend or approve;
- return structured results to the root harness.

The user continues to see Gwani/Gwana/twin unless the product explicitly exposes
another human-facing Character.

## Fast client principle

The Android app should render useful UI before network-dependent agent data is
ready. Session restoration and cached shell state should be local-first; agent
directory, wallet, billing, notifications and other secondary data hydrate after
the first useful frame.

The native Android splash is branding only. Flutter must not add an artificial
minimum splash duration.

## Implementation order

1. **Startup:** remove artificial splash waits; reduce encrypted session I/O.
2. **Harness seam:** add a provider-neutral execution contract around AgentStrategy.
3. **Durable Work projection:** expose existing Tasks/WorkflowRuns in mobile chat.
4. **Progress events:** map real Task/WorkflowRun/approval transitions into shell events.
5. **Resumability:** reconnect Android/WhatsApp/Telegram to the same work identity.
6. **Subworkers:** bounded child AgentRuns only after durable work and progress are stable.
7. **Admin observability:** show active work, failures, approvals and costs without exposing secrets.

## Acceptance principles

A harness change is not complete because a model can describe the action. It is
complete only when the canonical service performed it, durable state proves the
result, retries are safe and the user can recover the work after reconnecting.


## Durable Work projection checkpoint — 2026-10-05

Implemented in the harness continuation:
- current AgentStrategy execution now crosses the `AgentHarness` boundary through a
  compatibility adapter, so future orchestration does not need another conversation path;
- the Gateway converts harness progress callbacks into durable `work.updated` mobile-shell
  events using TaskId first, then WorkflowRunId, then AgentRunId as the presentation reference;
- mobile chat updates an existing Work card by `referenceId` and creates a stable recovery
  card when an event arrives without an existing assistant message;
- replayed Work events update the same card instead of duplicating it;
- Work phases are rendered with concise labels such as Working, Approval needed, Waiting,
  Completed and Failed;
- focused Gateway and mobile regression coverage was added for the progress bridge and
  reconnect/replay behavior.

Important implementation boundary discovered during this checkpoint:
`TaskId`, `WorkflowId`, `WorkflowVersionId` and `WorkflowRunId` are canonical
contract identities and AgentRun trace references already support them, but
`packages/workflows` is still a deferred placeholder. Therefore the projection path is
implemented, while canonical durable Task/Workflow lifecycle persistence and checkpoint
execution are **not yet implemented**. Do not claim long-running Work survives process/service
restart until that authority exists and is qualified.

Next implementation dependency:
build the canonical `@masanawa/workflows` Task/WorkflowRun lifecycle and repository boundary
according to the adoption rules, then add PostgreSQL checkpoint persistence before allowing
the harness to create or resume durable Work.


## Canonical workflows runtime foundation — 2026-10-05

The previously empty `@masanawa/workflows` package now defines the canonical lifecycle
and repository contracts required by durable Work.

Implemented:
- Task states: queued, running, waiting_approval, waiting_external, completed, failed, cancelled;
- WorkflowRun states with the same durable waiting/terminal semantics;
- terminal states cannot restart;
- Workflow checkpoints include graph signature, committed state, executor state, edge state,
  pending approvals and monotonic checkpoint revision;
- checkpoint state is bounded, plain JSON only;
- access guards require current scoped authority for Relationship + Task/WorkflowRun;
- repository ports exist for create/read/list/transition and checkpoint append/read;
- focused lifecycle/checkpoint tests are checked in.

This is still a domain-contract checkpoint, not persistence qualification. PostgreSQL storage,
restore compatibility checks and resumed present-authority revalidation remain the next slice.
Do not claim service-restart-safe Work until those pieces are implemented and verified.
