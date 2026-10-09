# F18 / C07 recovery — authenticated Assistant role integrity

**Claim issued:** 2026-10-09; the GitHub commit timestamp is the start of the five-minute ownership lease. Heartbeat is required within five minutes of active editing; this is not a permanent reservation.

- **Selected workstream:** F18 (C07) recovery; continue existing draft PR #480 on `work/c07-assistant-workspace-20261008`, not a competing branch/PR.
- **Latest main inspected:** `5e758673ae91082520b21b3153da53791ae2cbf3`. Existing #480 HEAD at claim inspection: `6a0f8e4561684afcff8d1b85c452575b8d022a75`.
- **Lease scope — exact paths:** `services/gateway/src/assistant_workspace/service.ts`, `services/gateway/src/assistant_workspace/service.test.ts`, and `docs/workstreams/f18-assistant-role-integrity-20261009.md`. No shared `app.ts`/`main.ts`, Flutter root/router, migrations, Firebase, billing/ledger, deployment or production changes.
- **Discovery:** all U01–U30 have draft source; current F09/F10/F13/F14/F17 owners have added their work to existing R/C PRs. C07 #480 last checked 2026-10-08T11:24:44Z, past the five-minute threshold; preserve its full diff and resume its exact code. Review F18, R03/R19 and U01 contract before patch.
- **Implementation target:** prevent an inconsistent/ambiguous official support identity (name ↔ voice ↔ character) from being mapped to Gwani/Gwana; refuse to select/open/turn/snapshot when trust metadata conflicts. Preserve use of the authenticated directory and canonical session/turn services, and prove positive and negative cases in the existing isolated test.
- **Dependencies:** shared F12 Gateway/Flutter composer, U01/U02 authority, F03 persona catalog, F10 Firebase, R02 Live, R05–R08 finance. Do not bypass them.
- **At claim:** source changes not yet made; tests not run; CI #457 and provider/physical device qualification remain blocked. Draft PR stays unmerged.
