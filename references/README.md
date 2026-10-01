# Reference Source Vault

This directory gives Masanawa contributors one organized checkout of every major donor/reference project used during the greenfield rewrite.

These folders are Git submodules. They are **not Masanawa modules**.

## Why submodules

We intentionally do not vendor/copy these repositories into Masanawa history because several are very large, evolve independently, and carry their own licenses. A gitlink gives us:
- exact reproducible source commits;
- a real local source checkout for cross-project search and comparison;
- independent upstream history;
- easy deliberate updates;
- no accidental package-manager/build inclusion;
- clear license/provenance boundaries.

## Layout

```
references/sources/
├─ domain/
│  └─ chatwithstars/
├─ agents/
│  ├─ openjarvis/
│  ├─ eliza/
│  └─ microsoft-agent-framework/
├─ companion/
│  └─ neko/
├─ digital-life/
│  └─ airi/
├─ gateway/
│  └─ openclaw/
├─ memory/
│  ├─ letta-server/
│  ├─ letta-code/
│  └─ mem0/
├─ presence/
│  ├─ cyberverse/
│  ├─ livekit-server/
│  ├─ livekit-agents-ts/
│  ├─ livekit-agents-py/
│  └─ pipecat/
├─ skills/
│  └─ openclaw-agent-skills/
└─ world/
   └─ ai-town/
```

Categories are for human navigation only. They do not decide final donor ownership.

## Rules

1. Do not edit donor source as if it were Masanawa code.
2. Do not import donor packages from Masanawa production packages.
3. Do not commit generated dependency folders/build outputs from submodules.
4. Read pinned source first; do not reason from a newer upstream checkout without updating SOURCE-LOCK.
5. Record every adopted behavior/concept in Masanawa ledgers.
6. Direct code adaptation needs provenance/license treatment.
7. A submodule's own README/docs/tests remain authoritative only for that donor, never for Masanawa architecture.

## Local search

After initializing submodules, ordinary recursive search can compare all donors:

```bash
rg "memory|reflection|handoff|barge|skill|world" references/sources
```

For very large donors, use targeted source directories/tests rather than indexing generated assets or models.

## Updating

See `docs/migration/SOURCE-LOCK.md`. Updates are explicit review events, never automatic production dependency upgrades.
