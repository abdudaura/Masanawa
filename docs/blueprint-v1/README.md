# Masanawa Master Blueprint v1 — draft planning baseline
Date: 2026-10-10 · Status: **PROPOSED / NOT APPROVED / NOT IMPLEMENTED**
Source baseline: `abdudaura/masanawa@7c443966be97e9092cbc1fb98562c75253434326`.
Authoritative project instructions remain `AGENTS.md`, `CONTINUE-HERE.md` and the latest accepted owner decisions until this proposal is reviewed. **Nothing in this folder supersedes the current product, closes a PR, changes financial terms, deploys, or authorizes provider transactions.**

## Purpose
Stop implementation drift: one product charter, complete actor/screen inventory, canonical service boundaries, cost/operational constraints, recovery strategy, finite vertical slices, and evidence-based release gates. This is a **design reset with selective source reuse**, not permission to discard working code.

## Contents
1. [Product and UX](PRODUCT-UX.md): scope, actors, detailed screen contracts, journeys and common states.
2. [Architecture and economics](ARCHITECTURE-ECONOMICS.md): logical design, data/API invariants, providers, risks, cost scenarios and release requirements.
3. [Recovery and delivery](RECOVERY-DELIVERY.md): actual observed repository risks, reuse criteria, PR triage and phase gates.
4. [Research and decisions](RESEARCH-DECISIONS.md): peer patterns, official evidence, recommendations and open owner decisions.

## Evidence and confidence
- **Observed at named SHA:** monorepo has Flutter consumer/admin, web/ops scaffolding, TypeScript backend, PostgreSQL adapters, and test code; the consumer router still includes older four-tab assumptions. Other branches contain ongoing fixes and must be reconciled.
- **Documented design, not runtime verification:** five tabs Chats · Rooms · Talks · Gwani · Wallet; Talks center/default; AI-vs-human directory; MSN ledger model; audio-first social; optional user twin and commission model; WhatsApp/Telegram connectivity.
- **Unverified:** locally built APK/dirty diff, app operation on phones, production provider eligibility, database migration and restoration, live costs, regulatory feasibility, performance, server authorization and complete integrated journeys.
- The latest parent PR and live `factory/claims` state are inputs, not a list of completed features.

## Review sequence before implementation
A. Resolve consequential decision register in RESEARCH-DECISIONS.md.
B. Review every actor, route, control, state and journey in PRODUCT-UX.md; create actual visual references and accessibility review.
C. Reconcile implementation, debt, local changes, PR heads and owners with RECOVERY-DELIVERY.md.
D. Publish canonical versioned contracts and budget limits; only then dispatch new feature rewrites.
E. Test source and devices/providers at exact SHAs; merge independently tested changes promptly to a **non-deploying integration target** where main might trigger Railway or migrations.

## Explicit design status
This baseline intentionally lists recommendations and unresolved points instead of claiming that the full blueprint is final. **Full design approval and source audit are separate gates.** Do not start a parallel full-stack rewrite merely because this file exists.
