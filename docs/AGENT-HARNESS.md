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


## PostgreSQL Work persistence checkpoint — 2026-10-05

The canonical Work repository is now backed by a dedicated `workflows` PostgreSQL schema.

Implemented:
- durable Tasks, WorkflowRuns and immutable WorkflowCheckpoints;
- optimistic revision conflicts fail closed;
- terminal Work cannot be restarted;
- legal lifecycle transitions are enforced both in TypeScript and database triggers;
- checkpoint append is atomic with WorkflowRun checkpoint revision and exact replay is safe;
- repository operations revalidate current policy/revocation state inside their transactions;
- platform product migration/readiness now includes the `workflows` migration owner;
- restart recovery is covered by constructing fresh repository instances against persisted state.

Authority semantics:
Relationship scope grants access to that relationship's Work when Task/Workflow ID lists are
omitted. When those ID lists are present, they narrow the scope. This is intentional and must
not be reverted to "missing list means deny all."

Remaining boundary:
persistence means Work state survives process/service restart, but there is not yet a concrete
graph executor that automatically resumes execution. The next slice must validate graph
signature compatibility, restore checkpoint state, and revalidate current authority immediately
before resumed consequential mutations.


## Mobile directory fast-start checkpoint — 2026-10-05

The fast-client principle now also applies to the server-driven agent roster.

Implemented:
- the last successfully authorized AgentDirectory projection is cached locally as presentation data;
- the cache is keyed by the canonical signed-in User ID and is never used for another account;
- returning users can render cached agents and their cached conversations before the live directory HTTP request completes;
- the live Gateway directory remains canonical and replaces the cached presentation when it arrives;
- transient network failures preserve the last cached roster, while 401/403 authorization failures clear it;
- access-token rotation alone does not rebuild the directory state because cache ownership follows User identity, not token value.

Security boundary:
cached agent presentation never grants Character admission, Skills, Tools, billing, wallet,
or any other authority. Every consequential/current operation remains server-authorized.
Do not hard-code Gwani/Gwana into the client as a startup shortcut.


### Cache-first startup presentation polish

When an account-scoped cached AgentDirectory is available, mobile surfaces must treat it
as immediately usable presentation while the canonical live directory refreshes.

- Chats with no prior thread may still open the cached Agents roster immediately.
- Agent-list copy should say the roster is refreshing rather than implying it is unavailable.
- Only the true no-cache/no-roster state should block on "Loading your agents…".
- This changes presentation latency only; server admission and authority are unchanged.


### First-frame startup deferral

Mobile startup now treats push/Firebase/native-deep-link initialization as post-first-frame
work. The app subscribes to the existing deep-link stream before first paint, then starts
`MobilePushService.initialize()` immediately after Flutter renders its first frame.

This preserves launch/deep-link delivery while avoiding unnecessary platform-channel and
Firebase setup competing with router/theme/session startup on slower Android devices.
Do not move noncritical notification initialization back in front of first paint.


### Fresh-install session restore optimization

The single-record `auth_session_v2` fast path remains one secure-storage read. When that
record is absent, compatibility with older APKs now uses one bulk `readAll()` call rather
than four additional key-by-key calls.

This means a fresh signed-out install performs two secure-storage platform calls for session
discovery instead of up to five, while legacy installs still migrate asynchronously to the
single-record format. Do not remove legacy migration until upgrade support is explicitly retired.
