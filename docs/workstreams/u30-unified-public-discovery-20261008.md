# U30 — Unified public discovery (active claim)

- Claimed: 2026-10-08T17:56:00+01:00 (owner window).
- Scope: U30 only; branch `work/u30-public-discovery-20261008-isolated`; base `main` `5e758673ae91082520b21b3153da53791ae2cbf3`.
- Exclusive writable paths: `services/gateway/src/unified_discovery/**`, `apps/mobile/lib/src/unified_discovery/**`, `apps/mobile/test/unified_discovery_*.dart`, and this handoff. No shared `app.ts`, `main.ts`, existing `talk_search/**`, SQL migration registry, Flutter root router, native/Firebase, finance or C01/C02.
- Existing canonical source to consume, never copy: `talk_search` public Talks/people/Expert/Twin index+auth, `/search`; Android `TalkSearchTransport`, public `/talk/:id`, `/u/:handle`, `/persona/:publicId`. Backend route composition and final five-tab routing belong to F12/Work.
- Five-minute lease: checked open PRs / branch inventory; U21 #508, U22 #509, and U23/U24 branches are already owned. No U30 branch or PR existed when this claim was made.
- Status: **IN PROGRESS / NOT VERIFIED / NOT DONE**. Source and test evidence, exact SHA, blockers and Work integration steps to be appended on commit.
