# Mobile Agent Experience

Status: canonical product direction for `apps/mobile`.

## Goal

The Masanawa user app is a simple home for a person's digital twin and the economy around
it. The user creates one twin, teaches it about themselves, shares it, discovers other
twins and sees money/activity generated through real value flowing through the twin.

The mobile app is not an admin dashboard, social-post feed or second runtime brain.

## Product model — 2026-10-05

The primary user mental model is:

> My digital twin represents me on Masanawa. Anyone can text it free. Paid voice,
> purchases, gifts and paid access to me can generate earnings.

The ordinary primary navigation is exactly:

- **My Twin**
- **Explore**
- **Activity**
- **Wallet**

Settings/profile is secondary and reached from the account/avatar menu.

The existing Character/Agent architecture remains internal. Ordinary users should not
need to understand platform Characters, Skill assignments, Workflows, AgentRuns,
providers, Agent Float or execution routing.

Public twin text chat is free. Voice can be paid only after explicit quote/consent.
Masanawa commerce may be initiated from any eligible twin conversation. A visitor may
gift the owner or request a paid scheduled conversation with the real owner.

Gwani/Gwana may continue as platform-support Characters internally/where useful, but
support-agent selection must not compete with My Twin as the main product identity.

Workflows, AgentRuns, Skills, Tools, Providers, Devices and Operations remain platform
concepts. They appear only when the user needs a useful result, approval, receipt or
support diagnostic.

## Dynamic agent roster

The mobile app MUST NOT compile a fixed list of agent identities.

An administrator may configure which Characters appear for a tenant/account and their presentation metadata. The app renders whatever the server returns from the authorized agent-directory projection.

The canonical Character identity remains CharacterId/CharacterVersion. The admin can independently change the user-app display name, role, about text, greeting, visibility and ordering through AgentPresentation without recreating that Character. Changing capabilities is a separate CharacterSkillAssignment operation. These writes must be authorized through the owning service; the mobile client does not perform them directly.

The directory projection may include:

- CharacterId and active CharacterVersionId;
- admin-configured user-app display name;
- admin-configured role label;
- short about text;
- avatar reference;
- greeting;
- ordering/visibility;
- current coarse presence;
- active-work count.

The directory projection MUST NOT grant Skills, Tools, authority or provider access.

No special name such as “Masanawa”, “Labari”, “Hakuri”, “Kasuwanci” or “Lafiya” is reserved by the client.

## Identity is separate from capability

Character identity and Skill assignment are independent.

- `packages/identity` owns Character/CharacterVersion identity and Constitution.
- `packages/skills` owns Skill/SkillVersion truth.
- `packages/agents` may bind admitted exact SkillVersion references to runtime/session configuration without owning Skill definitions.
- Admin configuration may change which Skills are assigned to a Character without changing the Character's identity.
- Changing an agent's role label never implies, adds or removes a Skill.
- The client never infers capability from display name, role, avatar or description.

This separation allows an administrator to configure:

- Amina — Sales & Outreach
- Musa — Research
- Maryam — Operations

and independently assign any permitted Skills to any of them.

## Admin configuration ownership

The admin experience edits two independent concerns:

1. Character identity/versioning in `packages/identity` — canonical CharacterId, CharacterVersion and Constitution.
2. Agent presentation in `packages/agents` — user-app display name, role label, about text, greeting and mobile visibility/order.
3. Character Skill assignment in `packages/agents` — exact selected SkillVersion references, stored separately from presentation.

`packages/agents/src/configuration.ts` and migration
`0002_agent_configurations.sql` establish the durable configuration boundary.

The Ops UI MUST NOT write these tables directly. The Ops service exposes separate
authorized presentation and Skill-assignment operations, plus a read-only Skill catalog
for selectors. Those routes remain fail-closed until an operator-session/current-
authority authorizer is supplied; there is no unauthenticated write shortcut.

## Conversation ownership

One visible conversation is keyed by canonical CharacterId.

The phone stores a local cache for responsiveness, but canonical continuity is:

`Character -> Relationship -> CharacterSession -> AgentRun/Workflow references`

A device loss or app reinstall must not erase Character identity, durable work or server truth.

## Voice-first interaction

Voice is the primary affordance.

Default platform-agent voice presentation is:
- Gwani -> Gemini voice preference **Bodi**;
- Gwana -> Gemini voice preference **Sulafat**.

These are presentation/provider preferences. They must be server-configurable and must
not be compiled into Character identity. Gwani remains the default platform/support
Character unless the user changes that preference in Settings.

The composer should prioritize:

1. microphone / voice note;
2. live voice call/conversation when Presence exposes it;
3. text;
4. attachment/camera.

Text remains available, but the UI should not visually suggest that typing is the only or preferred interaction.

Agent voice output is a first-class message part and may be accompanied by a transcript rather than duplicating long text.

## Channel parity and crypto balances

App, WhatsApp and Telegram are required customer surfaces over the same relationship,
authorized transaction state and receipts. Link accounts through verified proof; a phone
number, username or display name alone never establishes cross-channel wallet authority.
Render native buttons/lists where supported and numbered voice/text options otherwise.
Customers may view provider-backed crypto balances, deposit/buy, convert and withdraw
in chat. Show asset/network and available/pending/reserved amounts. Creator funding
and earnings remain separate; no channel-specific wallet or execution brain.

## Selectable commerce interaction

Follow `docs/DIGITAL-COMMERCE-LAUNCH.md`. Render authorized quick replies, product
cards, recipients, amounts/accounts, quote confirmation, transaction status and receipts
inside chat. Voice and taps share server-owned state. Actions bind current authority,
conversation, transaction/revision, expiry and idempotency identity.
Use short lists/search/more-options; never dump the full crypto catalog into chat.
Do not infer success from a tap, payment submission or timeout.
Show checking until provider reconciliation resolves an uncertain outcome.

## Chat is the work surface

Agent results return into the same conversation as typed message parts.

Supported presentation families include:

- audio;
- image;
- file;
- artifact;
- work/progress;
- approval;
- operation/receipt;
- call result;
- status.

A single assistant turn can contain narration plus multiple structured parts.

Examples:

- a completed spreadsheet with Preview/Open/Share actions;
- a running research task with 31/50 progress;
- an approval request for a consequential action;
- a call result with duration and transcript reference;
- an Operation receipt after a real device or cloud side effect.

The UI should not require separate top-level Files, Tasks, Workflows, Tools or Skills tabs for ordinary use.

## File and artifact rule

A local device path is never canonical work identity.

User-selected files may begin as local upload inputs. Once accepted by the platform they become durable server references.

Agent-produced work must use a durable reference equivalent to:

- file/artifact ID;
- name;
- media type;
- size;
- preview/download capability;
- authorization/scope enforced by the server.

The chat cache may store those references but never raw platform credentials or authority.

## Long-running work

“Typing…” is insufficient for work that can continue for seconds, minutes, hours or across restarts.

Long work should be represented as a chat-native Work card backed by canonical AgentRun/Workflow state. It may show:

- queued;
- working;
- waiting for approval/input;
- completed;
- failed/needs attention;
- bounded progress;
- final artifacts.

The card is a projection. Workflow and Operation owners remain authoritative.

## Delegation and commercial fallback

The Character the user addressed remains responsible for the conversation.

If the runtime delegates to another Character/strategy/specialist, orchestration stays
hidden by default. The lead Character may report that collaborators contributed. A user
only changes conversation when they deliberately choose another configured Character.

The same rule applies to commercial reseller fulfillment. A creator's clone may acquire
the customer and remain the visible relationship Character while Masanawa routes actual
fulfillment to another eligible executor because of Skill readiness, provider health,
budget or insufficient Agent Float. Executor identity and reseller attribution are
separate canonical facts. The customer is not bounced into another chat merely because
fulfillment changed.

## Device embodiment

An assigned Android phone is a Provider/body, not a second identity.

Phone calls, SMS/USSD, app automation, camera/microphone/screen and other device work should return status and receipts into the same Character conversation.

The mobile user app and the future Agent Device runtime are separate product roles even if they share technology.

## Presence

The line beneath the Character name should communicate useful live state, for example:

- Available
- Listening…
- Working · 2 tasks
- On a call
- Offline

It should not repeat a generic “Masanawa Agents” label.

## Gateway projection

The mobile shell currently expects a server-driven directory at:

`GET /agent/directory`

and Character sessions at:

- `POST /agent/sessions/open`
- `POST /agent/sessions/:characterSessionId/turn`
- `POST /agent/sessions/:characterSessionId/close`

The runtime endpoints remain subject to the canonical roadmap and current-authority admission. The mobile contract is forward-compatible scaffolding, not evidence that later server tasks are production-complete.

## Realtime direction

The synchronous turn contract is a bootstrap. The target realtime stream includes typed events equivalent to:

- user message accepted;
- listening/thinking;
- run/work started;
- progress;
- text/audio deltas;
- artifact created;
- approval required;
- Operation started/completed;
- run completed/failed.

Those events render into the same message/work-card model rather than creating another UI.

## Non-negotiable rules

- No hard-coded production agent roster in the app.
- Gwani is the server-configured default platform/support Character; Settings may select
  Gwana without creating client-side identity special cases.
- Voice defaults (Gwani/Bodi, Gwana/Sulafat) are configuration, not identity.
- Character identity is not a Skill bundle.
- Role labels do not grant capability.
- Skill assignment does not rename/recreate a Character.
- Files/results live in the conversation through durable references.
- Apps do not query canonical domain repositories directly.
- The phone is a shell/body, never another memory/workflow/identity authority.
- Consequential actions remain governed by current authority, Operations, receipts and reconciliation.


## Alpha 1 continuous-testing mode

The user app has a debug-only Alpha mode so product testing does not wait for
the full production roadmap.

Real Alpha behavior:
- authorized server-driven agent directory;
- canonical CharacterSession creation/closure;
- canonical AgentRun creation and terminal state for each text/media turn;
- text conversation through a temporary replaceable Gemini executor;
- real recorded voice/image/document bytes as multimodal input;
- Gemini Live native audio is the current direction; the historical optional Android-local TTS path is retired;
- Developer diagnostics showing Gateway health/readiness and latest AgentRun.

Debug-only Scenario Lab behavior:
- injects Work, artifact/file, approval and call-result cards only to validate
  the mobile renderer;
- performs no Tool, Workflow, approval or phone side effect;
- is unavailable as a release feature.

Assigned SkillVersion IDs are carried into CharacterSession bindings in Alpha
so admin configuration can be inspected end-to-end. Alpha does not execute
those Skills. Production Skill orchestration remains Task 075 and must resolve
current readiness/certification/authority at execution time.

The temporary Alpha executor is replaced by the production AgentStrategy seam
in Task 073. Alpha therefore accelerates product testing without becoming a
parallel agent framework.
