# Mobile Agent Experience

Status: canonical product direction for `apps/mobile`.

## Goal

The Masanawa user app is a very simple, voice-first window into persistent Masanawa Characters that can converse, work, create files, operate Tools and optionally inhabit phones/devices.

The mobile app is not an admin dashboard and never becomes another runtime brain.

## Product model

The primary user mental model is:

> Talk to capable AI people who can actually work for you.

The ordinary navigation stays intentionally small:

- Conversations
- Agents
- Settings/profile

Workflows, AgentRuns, Skills, Tools, Providers, Devices and Operations remain platform concepts. They appear in chat only when the user needs a useful status, result, approval or receipt.

## Dynamic agent roster

The mobile app MUST NOT compile a fixed list of agent identities.

An administrator may configure which Characters appear for a tenant/account and their presentation metadata. The app renders whatever the server returns from the authorized agent-directory projection.

The directory projection may include:

- CharacterId and active CharacterVersionId;
- display name sourced from the Character identity/constitution;
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

## Conversation ownership

One visible conversation is keyed by canonical CharacterId.

The phone stores a local cache for responsiveness, but canonical continuity is:

`Character -> Relationship -> CharacterSession -> AgentRun/Workflow references`

A device loss or app reinstall must not erase Character identity, durable work or server truth.

## Voice-first interaction

Voice is the primary affordance.

The composer should prioritize:

1. microphone / voice note;
2. live voice call/conversation when Presence exposes it;
3. text;
4. attachment/camera.

Text remains available, but the UI should not visually suggest that typing is the only or preferred interaction.

Agent voice output is a first-class message part and may be accompanied by a transcript rather than duplicating long text.

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

## Delegation

The Character the user addressed remains responsible for the conversation.

If the runtime delegates to another Character/strategy/specialist, orchestration stays hidden by default. The lead Character may report that collaborators contributed. A user only changes conversation when they deliberately choose another configured Character.

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
- Character identity is not a Skill bundle.
- Role labels do not grant capability.
- Skill assignment does not rename/recreate a Character.
- Files/results live in the conversation through durable references.
- Apps do not query canonical domain repositories directly.
- The phone is a shell/body, never another memory/workflow/identity authority.
- Consequential actions remain governed by current authority, Operations, receipts and reconciliation.
