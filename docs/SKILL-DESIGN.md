# Professional Skill Design

Status: canonical Skill product/authoring guidance.

## Purpose

Masanawa Skills must combine two properties:

1. **ChatGPT-style progressive disclosure and discoverability** so an agent loads the
   right procedural guidance only when it is useful.
2. **Masanawa execution safety** so selecting a Skill never bypasses exact SkillVersion
   pins, certification, readiness, current authority, Tool/Provider eligibility,
   idempotency, reconciliation or Workflow custody.

The existing Phase 6 Skills foundation remains canonical. This document adds the
professional authoring/discovery layer used by future Core and commercial Skills.

## Three-layer Skill model

### 1. Discovery card

Cheap metadata used to decide whether a Skill is relevant.

The runtime may inspect:
- key and display name;
- trigger-only description ("Use when...");
- positive activation examples;
- negative activation examples;
- deterministic discovery signals and priority;
- visibility.

The discovery card must describe **when to use the Skill**, not summarize the full
workflow. This prevents the model from treating metadata as a shortcut and skipping
the actual Skill instructions.

### 2. Skill instructions

Full procedural guidance is loaded only after the Skill is selected.

Instructions define:
- the Skill's operating method;
- decision rules;
- prerequisites;
- what to ask or infer;
- expected output shape;
- failure/recovery behavior;
- when to call declared Tools/subskills;
- common mistakes and boundaries.

Instructions are version-bound guidance and are immutable with their exact
SkillVersion through SkillGuide.

### 3. Resources and execution edges

Heavy references, templates, scripts and assets are loaded only when the selected
Skill actually needs them.

Tool calls and subskills remain governed by the canonical Skill execution plan.
A SkillGuide never grants Tool access or execution authority.

## SkillGuide

`SkillGuide` is the immutable companion to an exact `SkillVersionId`.

It stores:
- triggerDescription;
- full instructions;
- resource index;
- discovery priority/signals;
- content hash.

SkillGuide persistence is separate from the executable SkillVersion definition so
discovery/instruction loading can remain cheap and explicit while execution contracts
remain stable.

## Discovery rules

Discovery is a routing hint, not permission.

A high discovery score means only "this Skill appears relevant." Before execution the
runtime still must:
1. confirm the Character has the exact SkillVersion selected/assigned;
2. reload current catalog/readiness;
3. resolve the exact immutable Skill revision pin;
4. validate certification and dependency graph;
5. compile current authority;
6. resolve declared Tool references/Providers;
7. apply AgentRun budgets and confirmation policy;
8. create Workflow/Operation custody for durable or consequential work.

Negative discovery signals fail closed for deterministic lexical matching. AgentStrategy
may also use semantic reasoning over triggerDescription and activation examples, but it
cannot turn relevance into authority.

## Authoring rule

A professional Skill should be authored as:

```
skill/
  SKILL.md
  references/
  templates/
  scripts/
  assets/
```

Only `SKILL.md` is required. Supporting material exists only when useful.

The front matter stays concise:
- name;
- description that answers "when should this Skill be loaded?"

Do not put the full workflow into the description.

## Skill body shape

Use the smallest structure that makes the Skill reliable:

1. Overview / core principle.
2. When to use and when not to use.
3. Operating pattern or decision rules.
4. Tool/subskill interaction rules when relevant.
5. Output/result contract.
6. Failure/recovery behavior.
7. Common mistakes.
8. References/resources only where needed.

One strong example is better than many repetitive examples.

## Core capability versus Skill

Do not represent every basic model capability as a Skill.

Native/Core agent capabilities include ordinary conversation, relationship continuity,
basic reasoning, language generation and platform navigation. Skills are reusable
procedural capabilities that improve *how* an agent performs a meaningful class of work.

Examples that should be Skills:
- structured web research;
- CV/document production;
- lead research;
- website audit;
- social-content operations;
- airtime/data purchase;
- bill payment;
- booking/reservation.

"Talk normally" is not a Skill.

## Core Skill bundle

Masanawa may expose a curated Core Skill bundle to all eligible Characters. The bundle is
a product/configuration concept that selects exact SkillVersions. It does not create a
second Skill registry or special execution path.

Core Skill guidance still follows the same discovery, readiness and authority rules as
commercial Skills.

## Commercial Skills and Offers

A sellable Offer references an exact eligible SkillVersion. Retail price, Agent Float,
creator commission and Masanawa margin remain Commerce truth, not Skill truth.

Commercial enrollment means:
- this creator/Character wants to market/use this approved Skill/Offer;
- the exact SkillVersion is selected for the Character.

It does **not** mean:
- the Skill is currently ready;
- the Character has authority;
- the provider is healthy;
- fulfillment must be executed by the originating clone.

At fulfillment time the Skill is revalidated and may be routed to another eligible
executor while reseller attribution remains with the originating clone.

## Skill quality lifecycle

Future production Skills should follow a test-first quality loop:

1. Define realistic activation and non-activation scenarios.
2. Verify baseline routing/behavior fails or is ambiguous without the new guidance.
3. Author the smallest guidance that fixes those failures.
4. Run positive, negative and boundary rehearsals.
5. Certify the exact immutable SkillVersion + SkillGuide pair.
6. Publish readiness only after execution evidence passes.
7. Improve by publishing a new version; never mutate a live version in place.

This extends the existing Masanawa certification/rehearsal model rather than replacing it.

## Product UX

Ordinary users and clone creators should not see internal SkillVersion IDs, Tool
references or discovery scores.

Creator UX should say things like:
- Add Web Research
- Add CV & Documents
- Add Data & Airtime
- Add Website Services

Masanawa resolves the exact SkillVersion, guidance, dependencies, Offer and provider
requirements behind the scenes.

Gwani/Gwana may configure Skills conversationally:
> "Your clone is good at business and technology. I recommend Web Research, Lead
> Research and Website Services."

The user confirms simple capabilities; the platform owns the technical configuration.

## Non-negotiable boundaries

- Discovery is not authorization.
- Instructions are not Tool credentials.
- Skill is not Provider.
- Skill is not Offer/pricing.
- Skill assignment is not readiness.
- Commercial enrollment is not guaranteed local fulfillment.
- A SkillVersion never silently changes to "latest" during a run.
- Heavy resources are loaded on demand, not injected into every conversation.
- User-facing Skill configuration must remain simple even if runtime contracts are rich.
