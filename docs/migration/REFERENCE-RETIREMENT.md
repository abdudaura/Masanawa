# Reference and Retirement Ledger

Status: Phase 0 canonical disposition for source material that is not migrated as core implementation.

This document prevents omission by explicitly saying what is reference-only, future-option or retired.

## ChatWithStars

### Retired / historical
- older `BLUEPRINT.md` product architecture superseded by PLATFORM-FOCUS;
- legacy project identities/boundaries that platform-unification was removing;
- VTPass as active provider/fallback;
- provider-specific stale deployment assumptions;
- old branded names that are not Masanawa domain concepts.

### Reference / optional product packs
- civic-specific seeded datasets, candidate registries/polls and product branding: **B reference as an optional civic skill/content pack**, not core Masanawa political truth;
- telecom/news/teaching/support/community starter templates: **B reusable skill packs**;
- example/pilot characters: test fixtures/content, not framework identity;
- legacy public Astro/admin layout: UX reference only.

### Data/assets
- generated render outputs, cached media and project-specific sample data: C unless selected as migration fixtures;
- scripts used only for one-time old deployment repair: C operational history unless behavior is promoted to a ledger invariant.

## OpenJarvis

### Reference-only implementation surfaces
- CLI command UX: B developer-experience reference;
- packaged desktop GUI/frontend: B/C client UX reference;
- Rust mirror/native crates: B performance/reference implementation, not a second Masanawa core;
- deployment examples/render config: C/B infra reference;
- sample configurations/examples: B test/documentation fixtures.

### Provider/channel breadth
Unselected providers/channels are B/C adapter backlog, not launch dependencies. Their existence is preserved in PROVIDER-CATALOG.

## N.E.K.O

### Static/vendor assets
- bundled game audio/images, third-party JS/vendor artifacts, default avatar/model assets: C unless individually selected/licensed for a Masanawa product.
- default character YUI and donor-specific branding: C content reference.

### Distribution/client shells
- Steam-specific launcher/package plumbing: B/C distribution reference.
- current React/Vue/Electron-like frontend implementations: B experience reference, not code skeleton.
- Docker/local packaging scripts: C/B deployment reference.

### Experience modules
Mini-games, watch-together, music, focus/break reminders, icebreaker, expression mapping, wake word and app/game bridges are **B optional experience modules**, explicitly represented in Feature Ledger.

### UGC
Steam Workshop is a B marketplace/distribution donor. Masanawa should define its own package/provenance model and may later add Steam or another marketplace adapter.

## CyberVerse

### GPLv3 implementation
- Go server source;
- Python inference source;
- Vue frontend;
- protobuf definitions;
- bundled model integration code.

Disposition: behavior/architecture reference only unless a future licensing ADR explicitly allows an isolated GPL component.

### Bundled model code and weights
C/reference. Each selected model/provider must be evaluated under its own license and deployment constraints.

### Frontend/settings UX
B/C realtime UX reference; Masanawa independently implements clients.

## General rule

A C classification means "not part of canonical Masanawa implementation," not "never inspect it." If later product requirements activate a reference feature, create/update its Feature Ledger row and architecture decision before implementation.
