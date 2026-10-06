# Home + Rooms Execution Status

Status: canonical coordination ledger, updated 2026-10-06.

This file is the single current-status ledger for Home/Rooms launch execution.
A PR being open, mergeable, or non-draft does **not** by itself mean a lane is complete.

## Required lane states

Every lane must use exactly one of these states:

1. **UNCLAIMED** — no active owner.
2. **CLAIMED** — ownership recorded, implementation not complete.
3. **IMPLEMENTING** — active work remains inside the lane.
4. **ISOLATED COMPLETE** — every deliverable assigned to that lane is implemented inside its owned paths; tests/typechecks have either executed successfully or any non-execution is explicitly recorded; the handoff names only dependencies owned by another lane.
5. **INTEGRATION READY** — isolated-complete and its exact integration contract/head is published for the shared owner.
6. **INTEGRATED** — the shared production owner has composed the lane into the production integration branch without replacing canonical domain/runtime truth.
7. **DEVICE VERIFIED** — exact integrated release head has been built and the lane's physical-device acceptance has passed.
8. **LAUNCH VERIFIED** — all launch acceptance items that depend on the lane have passed in production/release qualification.

A window must **not** report a lane as complete while work assigned to that same lane remains.

## Stop/report rule

A working window must keep implementing until one of these is true:

- the lane reaches **ISOLATED COMPLETE** and all remaining work belongs to named shared/foreign owners; then the window must immediately take another safe unclaimed/inactive lane if one exists;
- every remaining lane is already claimed/active or protected by the shared production owner;
- a real external blocker requires credentials, physical-device action, provider approval, or another owner's protected path.

Do not stop merely because a PR was opened, code compiled, a test file was added, or one deliverable was finished.

## Evidence required for ISOLATED COMPLETE

The lane handoff and PR must record:

- all lane-map deliverables and where each is implemented;
- exact owned paths and changed-file audit;
- relevant tests/typechecks and their actual result;
- if CI did not execute, exact run/job evidence such as `steps = null`; never call that a pass;
- exact remaining dependencies and the owner of each;
- statement: **No further isolated implementation remains in this lane.**

## Current Home/Rooms ledger

| Lane | Area | PR | State | Remaining owner |
| --- | --- | ---: | --- | --- |
| H | Home shell | #201 | ISOLATED COMPLETE | #136 shared navigation/transport/server projection |
| I | Internet Cafe | #203 | INTEGRATION READY | #136 + canonical billing/Skill resolution |
| B | Billing qualification | #210 stacked on #126 | IMPLEMENTING | head `27b3318a01395b8155b6b23eb84119bd8e0445e9`; live Flutterwave qualification + controlled financial/device acceptance still required |
| T | Study Center | #205 + progress #215 + server seam #220 | INTEGRATION READY | compose #94/#96/#215, authenticated pending actions/channels, then #136 route/device acceptance |
| S | Story Radio | #199 | ISOLATED COMPLETE | Admin publishing/audio/runtime + #136 |
| N | News | #200 closed; production integration #212 active | IMPLEMENTING | #212 on Home integration #206 owns sourced News composition; admin/evidence/audio dependencies remain |
| W | Work & Research | #202 + server seam #216 | INTEGRATION READY | #136 mounts route; canonical Skills/Workflow/research runtime resolves allowlisted opaque intents |
| G | Group Rooms | #214 (supersedes #204) | INTEGRATION READY | Identity export/persistence/memory + #136 |
| A | Admin publishing | #208 + Story admin #213 | IMPLEMENTING | #208 UI is complete; #213 handles Story Radio admin; News/Home/assistant canonical Ops command wiring remains with #129/Ops |
| P | Production integration + APK | #136; Home #206; Story #209/#211; News #212 | IMPLEMENTING | #206 head `764d179543fd629245e8ad0f98d7fbfc6b11506c`; duplicate Story integration branches require reconciliation before further shared stacking |

## Move-on gate

The project may move from parallel isolated feature work to the shared integration phase when:

- H, I, T, S, N, W, G and A are **ISOLATED COMPLETE**;
- their handoffs are published;
- no lane has unresolved work that belongs inside its own owned paths.

That gate is now satisfied.

The project must **not** move from integration to release qualification until:

- Billing lane B is production-qualified;
- #136 has integrated the required launch lanes;
- exact production configuration is reconciled;
- the exact release APK builds.

The project must **not** call Home/Rooms launch complete until the physical-device checklist in
`docs/HOME-ROOMS-MULTI-WINDOW.md` passes on the exact integrated release head.


## Integration-support seams

These are additive seams completed after isolated mobile lanes so the shared owner can compose
without recreating domain logic:

| Area | PR | Exact head | State |
| --- | ---: | --- | --- |
| Core Teaching durable progress | #215 | `7bc1b574f9738f6e8108b3a8e422654b74043c3e` | INTEGRATION READY |
| Work/Research Gateway projection + intent allowlist | #216 | `27e45edc2b5b9cbf933cda3ffb50785c9a2f712c` | INTEGRATION READY |
| Internet Cafe Gateway projection + server intake validation | #218 | `ada2ed3f08a9678b2c62def41fee4324b345a8b5` | INTEGRATION READY |
| Study Center Gateway projection | #220 | `37edb1db2c14fe7d9a78a0601492a3cc0274a169` | INTEGRATION READY |

Shared route registration, authenticated pending-action custody and production composition still
belong to the named shared owners.
