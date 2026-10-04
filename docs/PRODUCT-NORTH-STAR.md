# Masanawa Product North Star

Status: canonical product-direction document.

This document answers four questions that every implementation phase must be judged against:

1. What is Masanawa?
2. Who or what is a Masanawa Agent?
3. What should a Masanawa Agent ultimately be able to do?
4. Which platform capabilities matter most to making that real?

It does not replace the domain model, architecture, rewrite plan or ADRs. It gives those documents a product-level target.

## Launch priority and unresolved broader scope

`docs/DIGITAL-COMMERCE-LAUNCH.md` is the canonical current launch overlay:
frequent digitally fulfilled purchases, required data/crypto families, Flutterwave
billing, NOWPayments crypto on eligible inexpensive networks, and selectable voice-friendly
chat. The broad capabilities below remain the long-term vision; they are not all
approved launch commitments. Proposed deferrals require the user's decision.
Preserve reusable foundations; do not build every vision family before proving purchases.

## 1. Masanawa in one sentence

Masanawa is a platform for creating persistent AI beings that can maintain identity, memory, relationships and goals; perceive and communicate across channels; perform useful work through tools and workflows; live continuously in a governed world; and optionally inhabit digital or physical device embodiments such as a dedicated Android phone.

## 2. The fundamental product unit

The fundamental product unit is the **Character**.

For the consumer product, Masanawa additionally distinguishes platform Characters,
one personal clone per ordinary User, and later business Characters. A personal clone
is still a canonical Character; "clone" is a product relationship/ownership concept,
not a second identity system. Masanawa owns the platform, product/service catalog,
pricing, execution standards, routing and settlement. See
`docs/CREATOR-CLONE-ECONOMY.md`.

A Character is the durable identity of an AI being. It is not:
- a prompt;
- a model;
- an AgentStrategy;
- a chat session;
- a phone;
- a social-media account;
- an avatar;
- a workflow;
- a provider.

Those are capabilities, execution methods, interfaces or embodiments used by the Character.

A Character can outlive any one model, device, phone number, account, app or hosting provider.

## 3. What "Masanawa Agent" means

In product language, a **Masanawa Agent** is a Character that is capable of acting.

It combines the durable Character with the platform's runtime capabilities:

- identity and Constitution;
- private and shared memory;
- world/life state;
- reasoning through one or more AgentStrategies;
- reusable Skills;
- atomic Tools;
- Providers that make Tools executable;
- durable Workflows for long-running work;
- Decisions, policies and approvals;
- channels through which it communicates;
- perception through authorized inputs;
- proactivity and scheduling;
- social, commerce and studio capabilities;
- realtime voice/avatar presence;
- optional device embodiment.

The Character remains the identity. "Agent" describes the Character operating through these capabilities.

## 4. What makes Masanawa agents different

A useful north-star Masanawa Agent should have six properties.

### 4.1 Persistent

It should remain recognizably the same being across:
- days, months and years;
- web, WhatsApp, Telegram, voice calls and other channels;
- model/provider changes;
- device replacement;
- live conversations and background work.

Its identity, memory, relationships and commitments must not disappear when a session ends.

### 4.2 Capable

It should be able to do more than converse.

An agent should be able to:
- research and synthesize information;
- browse and interact with software;
- operate APIs;
- use files and documents;
- perform structured business work;
- send messages;
- make and receive calls;
- publish approved social content;
- handle approved commerce;
- create media;
- operate device capabilities;
- delegate specialist work;
- execute multi-step tasks reliably.

Capabilities must be represented once through Skills, Tools and Providers rather than hard-coded per channel or persona.

### 4.3 Continuous

An agent should be able to continue permitted work when nobody is actively chatting with it.

It may:
- keep durable tasks alive;
- wake on schedules or events;
- monitor approved conditions;
- follow routines;
- maintain commitments;
- continue long-running workflows;
- recover after crashes;
- reconcile uncertain side effects;
- report results when the user returns.

Continuous operation must remain governed, bounded and auditable.

### 4.4 Social and embodied

An agent should be able to exist through multiple surfaces while remaining one being.

Possible embodiments include:
- text chat;
- voice call;
- realtime avatar;
- generated-human/video presence;
- social accounts;
- email;
- a dedicated Android phone with a real SIM and phone number;
- future robots or local devices.

Embodiment changes where the Character can perceive or act. It does not create a second identity or memory system.

### 4.5 Relational and world-aware

An agent should have:
- private per-user relationships;
- shared Character facts;
- relationships with other Characters;
- routines, goals, commitments and story arcs;
- world events that can continue outside a single chat;
- memories with provenance, correction and privacy boundaries.

A private relationship fact must never silently become global Character or World truth.

### 4.6 Trustworthy to operate

Every consequential action should have:
- current authority;
- explicit policy;
- bounded credentials;
- idempotency where possible;
- durable operation identity;
- receipts or evidence;
- reconciliation when outcome is uncertain;
- auditability;
- operator visibility.

Models may reason about what to do. Deterministic platform systems own permissions, money and execution truth.

## 5. Target capability map

The target product is complete only when an agent can combine the following capability families.

### Identity and continuity
- versioned identity/Constitution;
- voice/appearance/personality/expertise;
- private relationships;
- shared Character state;
- cross-channel continuity;
- migration across models/devices without identity loss.

### Memory and cognition
- working context;
- episodic, factual and semantic memory;
- evidence and revisions;
- temporal/entity/hybrid retrieval;
- consolidation/reflection;
- correction/tombstone/expiration;
- relationship/private/shared/world/task scopes.

### Reasoning and work
- provider-neutral inference;
- multiple AgentStrategies;
- reusable Skills;
- atomic Tools;
- durable Workflows;
- delegated/background work;
- checkpoints and recovery;
- budgets/guards;
- human approvals;
- trace/evaluation.

### Communication
- web;
- messaging channels;
- email;
- voice calls;
- realtime audio/video;
- avatar/digital-human presence;
- device-mediated communication.

### Perception
- text/events;
- files/documents;
- microphone/audio;
- camera/images/video;
- screen;
- notifications;
- device state;
- approved location/sensors;
- external systems/events.

### Proactivity
- schedules;
- routines;
- commitments;
- promises/follow-ups;
- event-triggered work;
- quiet hours/frequency policy;
- condition monitoring;
- permitted social/world activity.

### Device embodiment
- pair and authenticate a device node;
- publish runtime capabilities;
- assign devices to Characters;
- make/answer calls;
- send/receive SMS;
- execute USSD;
- interact with installed apps where permitted;
- use microphone/camera/screen;
- survive temporary cloud loss through bounded local custody;
- upload receipts and reconcile on reconnect.

### Social identity
- own/bind social identities;
- draft content;
- request approval where required;
- publish;
- read/reply through supported channels;
- maintain one Character identity across accounts;
- keep platform memory independent of third-party app storage.

### Commerce
- platform-owned Offer catalog linked to executable Skills/capabilities;
- deterministic platform pricing, creator commission and Masanawa margin;
- Customer Credits, creator Agent Float and explicit fulfillment reservations;
- reseller/originating-Character attribution independent from fulfillment executor;
- quote;
- approve;
- pay/receive where product policy permits;
- route eligible fallback fulfillment when the originating clone cannot fund/execute;
- append-only ledger and settlement;
- reconcile refunds/adjustments;
- produce receipts;
- prevent model text from becoming financial truth.

### Studio/media
- story/script;
- storyboard;
- image/video/audio generation;
- voice/lipsync;
- identity-consistent media;
- review;
- publish.

### World/life
- routines;
- goals;
- locations when spatial mode is enabled;
- story arcs;
- Character-to-Character interactions;
- governed autonomous events;
- canon governance;
- continuity between world life and conversations.

### Operations
- fleet/agent health;
- task/run state;
- provider health;
- device health;
- cost/usage;
- audit;
- dead-letter/needs-attention;
- approvals;
- recovery controls.

## 5.1 Mobile user experience

The primary mobile product is a voice-first conversation surface over configured
Characters. The client does not ship a fixed agent roster. Administrators choose which
Characters appear and their presentation metadata; Character identity remains separate
from Skill assignment, so any permitted Skill can be assigned or removed without
recreating or renaming the Character.

Files, artifacts, long-running work, approvals, calls and receipts return into the same
conversation as typed result parts. Ordinary users should not need top-level Skills,
Tools, Workflows, Runs, Files or Devices dashboards to get work done.

Gwani and Gwana are peer platform/support Characters with the same role and eligible
capability surface. Gwani is the default new-user platform/support Character and uses
the configured Gemini voice preference **Bodi**; Gwana uses **Sulafat**. Users may
change the default platform/support Character in Settings. Voice preference is
presentation/provider configuration, not Character identity.

See `docs/MOBILE-AGENT-EXPERIENCE.md` and `docs/CREATOR-CLONE-ECONOMY.md`.

## 6. The Agent Loop

The product should converge on one conceptual loop:

**Perceive -> Understand -> Remember/Recall -> Decide -> Plan -> Act -> Observe result -> Reconcile -> Learn candidate -> Continue**

Platform ownership is intentionally split:

- Perception owns normalized observations.
- Identity/Memory/World provide durable context.
- Decisions and policy bound choices.
- AgentStrategy reasons and plans.
- Skills compose capabilities.
- Tools describe atomic effects.
- Providers execute at external edges.
- Workflows own durable multi-step state.
- Operations/receipts establish execution truth.
- Learning may produce candidates but never silently rewrite production truth.

## 7. Cloud brain, optional device body

A Masanawa Agent may run entirely through cloud providers, but it may also be assigned one or more physical devices.

The key invariant is:

> **The device is an embodiment and execution node, never a second brain.**

Canonical identity, memory, world state, durable workflows, authority, social/commerce truth and audit remain in Masanawa's canonical platform stores.

The device contributes capabilities the cloud cannot provide cleanly, such as:
- a real SIM and mobile phone number;
- GSM/VoLTE calling;
- SMS/USSD;
- installed mobile apps and their authenticated sessions;
- camera/microphone/screen;
- local notifications;
- device-local sensors;
- local/offline execution.

See `AGENT-PHONE-EMBODIMENT.md`.

## 8. Product tests that matter

Implementation should be prioritized by whether it makes these experiences real.

1. A person meets an agent, returns later on another channel, and the same relationship continues.
2. A person asks for a multi-step task; the agent works in the background, survives a restart and returns a verified result.
3. An agent uses a cloud API when available and transparently falls back to an assigned phone/device capability when that is the correct provider.
4. A user calls the agent's real phone number; the same Character answers with the correct identity and relationship context.
5. The agent can initiate a permitted real phone call and report a durable receipt/outcome.
6. The agent can maintain social identities without those accounts becoming its canonical identity.
7. The agent follows up on a commitment while respecting permission, frequency and quiet-hours policy.
8. A world event changes shared Character life state without leaking private relationship memory.
9. A consequential action has an auditable operation, authority, provider/device receipt and reconciliation path.
10. Replacing the model, phone or channel does not erase the Character.
11. A nontechnical user can create one personal clone conversationally, enable a
    commercial Skill without seeing Tool/provider internals, and share the clone.
12. A customer can buy an Offer through a creator's clone; if that clone lacks
    sufficient Agent Float or execution capacity, Masanawa can transparently route
    fulfillment elsewhere while preserving the originating relationship and deterministic
    creator attribution.
13. Gwani is available as the default platform/support Character, Gwana can be selected
    instead in Settings, and switching between them does not create a new platform
    authority model.

## 9. Priority rule for roadmap decisions

A proposed subsystem should be favored when it directly improves one or more of:

- **continuity** — the agent remains the same being;
- **capability** — the agent can do meaningful new work;
- **autonomy** — it can continue permitted work without a live chat;
- **embodiment** — it can perceive/act through more real surfaces;
- **reliability** — actions and long tasks survive failure;
- **trust** — authority, privacy, receipts and audit remain deterministic;
- **operability** — humans can understand and recover what agents are doing.

Architecture work that protects one canonical platform is essential, but infrastructure that does not move any of these dimensions should not outrank product-critical agent capability.

## 10. Completion definition

Masanawa is not "complete" because all packages exist.

The platform reaches its intended first complete generation when:
- the canonical foundations are closed;
- a Character can become a capable Agent through Skills/AgentStrategies/Workflows;
- at least the primary channels and realtime path work end-to-end;
- proactivity is durable and governed;
- device embodiment works for a real paired device;
- social/commerce/studio have at least one production-grade journey each;
- Ops can observe/recover agents, workflows, providers and devices;
- the golden journeys pass across restarts and side-effect ambiguity;
- product behavior is production-verified, not only unit-tested.

Until then, phase completion is useful engineering progress but should not be confused with complete product capability.
