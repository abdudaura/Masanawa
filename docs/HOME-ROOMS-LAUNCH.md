# Masanawa Home + Rooms Launch Plan

Status: canonical launch-product overlay, approved direction 2026-10-06.

This document supersedes the older assumption that the ordinary user lands first on
**My Twin / Explore / Activity / Wallet**. The deeper Twin economy, Character, Skill,
runtime, commerce, memory, Wallet and Activity architecture remains canonical and is
preserved.

## Launch goal

The first customer release should make Masanawa immediately useful before a user
understands Twins or internal platform concepts.

A new user opens Masanawa and can immediately:

1. talk, send voice notes to, or start live voice with **Gwana** or **Gwani**;
2. enter a purpose-built Room for a common task;
3. buy data/airtime/electricity/TV through a deterministic in-chat purchase flow;
4. use Internet Cafe services for forms, applications and documents;
5. learn through Study Center;
6. listen to admin-curated serialized AI audio stories;
7. read/listen to News;
8. do business/research work;
9. later join Group Rooms;
10. access their personal Twin, Wallet, Activity and Explore without those concepts
    blocking first-use utility.

## Launch navigation

Primary bottom navigation for the consumer app:

- **Home**
- **Explore**
- **Activity**
- **Wallet**

**My Twin** remains a core product surface but moves into Home/profile rather than
owning the first tab. It can appear as a prominent Home card for users who have a Twin
and in the profile/account menu.

Settings remains secondary.

## Home hierarchy

### 1. Gwani and Gwana

Immediately below the Home header, render two prominent peer platform-assistant cards
on one horizontal row:

- **Gwana** on the left;
- **Gwani** on the right.

Each card exposes:
- Chat;
- Voice note;
- Live voice/call.

Presentation defaults:
- Gwani -> Gemini Bodi;
- Gwana -> Gemini Sulafat.

They have the same eligible Core/service capability surface. Identity, personality and
voice may differ; service availability must not be inferred from the name.

The two Characters remain server-owned/configurable canonical Characters. The client
may reserve their Home placement role but must resolve actual Character IDs,
presentation, visibility and voice configuration from the server.

### 2. Quick services

Below Gwani/Gwana, render compact shortcuts for the highest-frequency transactions:

- Data
- Airtime
- Electricity
- TV

Shortcuts deep-link into the **Internet Cafe** Room with a preselected service intent.
They do not create separate billing engines or duplicate Skills.

### 3. Service Rooms

The Home list is intentionally conversation-like, but it is not a WhatsApp chat list.
Each Room is a server-defined presentation/workspace over canonical Skills and
transaction state.

Launch Rooms:

1. **Internet Cafe**
2. **Study Center**
3. **Story Radio**
4. **Work & Business**
5. **Research & Answers**
6. **News**
7. **Group Rooms** (bounded launch slice; expand after one-to-one flows are stable)

Rooms may show last meaningful activity/continuation state so the Home becomes useful
for returning work without degenerating into a raw conversation-history list.

## Room architecture

A Room is not a Character and is not a second runtime.

A Room definition may configure:
- display name/icon/description;
- eligible/pinned Skills;
- recommended quick starts;
- specialized ShellDocument/message parts;
- opening copy;
- continuation projection;
- optional platform-assistant preference;
- feature flags and availability.

Canonical execution remains:

Room intent -> CharacterSession/Relationship -> Skill discovery/admission ->
Workflow/Operation/Commerce as required -> typed result/receipt back into conversation.

Gwani, Gwana, personal Twins and future eligible Characters may all use the same
certified Skills. Rooms optimize discovery and interaction; they never grant authority.

## Internet Cafe

Purpose: one conversational destination for everyday digital/online services.

### Quick Purchase
- Data bundles
- Airtime
- Electricity
- Cable TV

### Applications
- Job applications
- School/admission forms
- Scholarship applications
- Exam/registration forms
- General online forms

### Business Services
- Business-registration assistance
- Business-name/document preparation
- Proposals
- Quotations/invoices
- Basic company/business documents

### Documents
- CV / resume
- Cover letter
- Application letter
- Formal letters
- Document editing/formatting
- PDF preparation/conversion
- Form/document filling

### Online Help
- Web research for an application/task
- Account/application assistance
- Supported bookings/appointments
- Website form assistance
- Other Internet task

The Internet Cafe is backed by mastered reusable Skills, not an InternetCafeAgent.

### Billing flow invariant

Billing actions are server-owned deterministic state:

service -> provider/catalog choice -> recipient/account validation -> quote ->
explicit confirmation -> payment/dispatch -> checking/reconciliation -> terminal
receipt/refund/needs-attention.

The model may explain and guide. It must never invent a price, provider success,
transaction status or receipt.

## Study Center

Backed by the canonical Core Teaching Skill.

Launch quick starts:
- Learn a topic
- Homework help
- Practice questions
- Exam preparation
- Explain something
- Language practice
- Continue last lesson

The Room should optimize for lessons, examples, worked solutions, answer choices,
hints, reteaching, voice/text parity and durable Relationship-scoped learner progress.

## Story Radio

Story Radio is an **admin-controlled listening product**, not a user story creator and
not a video-production surface.

### Product rule

Users do not create or direct public Story Radio series at launch.

Admin/platform publishing controls:
- series;
- season;
- episode order;
- title/description/artwork;
- language;
- audience/age label where needed;
- publication state;
- audio asset/voice;
- next-episode relationship.

### Listener experience

Keep it extremely simple:
- featured/current series;
- Continue Listening;
- series page;
- episode list;
- large Play/Pause;
- seek/progress;
- previous/next episode;
- playback speed if already supported safely;
- reaction;
- optional save/follow-series later.

At episode completion, clearly offer/play the next episode. Preserve listening progress
across devices where authenticated.

### Reactions

Launch reactions should be lightweight and bounded, for example:
- Like
- Love
- Funny
- Thoughtful

No comments, user uploads, public story creation, creator studio or social feed are
required for launch.

### Generation boundary

AI may help operators author/narrate stories through admin workflows, but publication
is admin-controlled. Consumer clients receive only published series/episodes.

## News

News is a separate Room from Story Radio.

Launch goals:
- simple current-news feed/cards;
- categories configured by admin;
- open a story into a readable/listenable news conversation/article view;
- source/provenance metadata where available;
- optional audio playback using the same approved audio presentation system;
- reactions may be added later if useful.

The News Room must distinguish sourced current facts from generated narrative. Current
news acquisition requires admitted evidence/source tooling; the model must not fabricate
breaking-news claims.

Admin controls category/visibility/pinning/editorial presentation. The launch app does
not need a social-comment system.

## Work & Business

Quick starts:
- Business plan
- Business ideas
- Proposal
- Market research
- Sales/marketing
- Customer messages
- Pricing help
- Reports
- Spreadsheet/document work
- Start/continue a project

Long work should project canonical AgentRun/Workflow progress and artifacts into the
same conversation.

## Research & Answers

Quick starts:
- Research a topic
- Compare options
- Latest information
- Investigate something
- Summarize documents
- Ask from my files

Use evidence-capable research tooling for current/specialist claims. The Room should
surface sources/progress/results without exposing internal runtime concepts.

## Group Rooms

Group Rooms allow scoped interaction among people and eligible AI Characters/Twins.

Examples:
- user + Gwani + Gwana;
- study group + Gwana;
- project team + Gwani;
- people + their Twins.

Launch only a bounded implementation after one-to-one identity/routing is stable.
Group scope must have explicit membership, privacy, message attribution and memory
boundaries. Group messages must never silently become private Relationship memory.

## Universal conversation renderer

Do not build separate Flutter chat applications per Room.

Reuse the universal conversation renderer and server-driven typed parts. Room-specific
optimization is achieved through:
- opening state;
- quick actions;
- ShellDocument;
- commerce cards;
- teaching cards;
- audio episode parts;
- news/source cards;
- work/progress/artifact parts.

A user may still ask Gwani/Gwana directly for any supported service. The runtime should
enter the correct Room/Skill flow in-place rather than forcing navigation.

## Preserved Twin economy

The following remain fully preserved:
- one personal Twin per ordinary user;
- public Twin discovery/share links;
- free public Twin text;
- paid Twin voice/trials;
- gifts;
- owner access;
- Credits;
- attribution/commission;
- Wallet;
- Activity;
- public/private representational memory.

The change is information architecture: utility-first Home is now the landing surface.

## Launch completion phases

### Phase 0 — Documentation and ownership freeze
- ratify this Home/Rooms overlay;
- mark older My-Twin-first navigation text as superseded;
- publish non-overlapping multi-window lanes.

### Phase 1 — Home shell + Gwani/Gwana
- Home route and bottom navigation;
- server-resolved Gwani/Gwana cards;
- chat/voice-note/live-voice entry;
- My Twin card/profile entry;
- recent/continuation projection;
- no new runtime authority.

### Phase 2 — Internet Cafe + real billing
- Room definition/projection;
- quick Data/Airtime/Electricity/TV shortcuts;
- Flutterwave catalog/validation/quote/checkout/reconciliation/receipt;
- physical APK success for at least data + one bill family;
- reuse canonical commerce/operation truth.

### Phase 3 — Study Center
- compose Core Teaching persistence + Gateway;
- Home Room entry and continuation;
- selectable exercises/free response;
- voice/text;
- physical-device qualification.

### Phase 4 — Story Radio + News
- admin-controlled series/episode contracts and publishing;
- audio playback/continuation/reactions;
- News feed/category/article/source projection;
- optional news audio;
- admin controls.

### Phase 5 — Work + Research
- Room definitions and quick starts;
- evidence-capable research;
- artifact/work-card flows;
- bounded long-running execution using canonical runtime/workflows.

### Phase 6 — Group Rooms
- membership/scope contracts;
- multi-participant routing;
- Gwani/Gwana/Twin participation;
- privacy/memory tests.

### Phase 7 — Launch qualification
- OTP auth;
- exact production APK build/install;
- Gwani and Gwana text/voice/live voice;
- Internet Cafe real purchase;
- Story Radio playback/continuation;
- News load/open;
- Study continuation;
- Wallet/Activity;
- restart/retry/no-duplicate-money;
- low-end Android/responsive/accessibility pass;
- production monitoring and rollback evidence.

## Launch blockers versus later work

Must not block first launch:
- full Agent Phone/OmniSIP;
- Studio/video production;
- social publishing;
- generalized plugins;
- full world simulation exposure;
- advanced autonomous routines.

Must block first launch:
- production auth;
- Gwani/Gwana availability;
- working text + voice note + live voice;
- real billing purchase/reconciliation;
- Home/Room navigation;
- Story Radio basic playback;
- News evidence-safe basic flow;
- no duplicate financial side effects;
- a successfully compiled and physically tested release APK.
