# Third-Party Provenance Ledger

This file is compliance metadata only. It does **not** decide which Masanawa features survive.

## Architectural rule

A/B/C classification is based only on product and architecture value:
- **A** — preserve required behavior;
- **B** — preserve capability but redesign implementation;
- **C** — retire/reference because Masanawa does not need the capability.

A restrictive donor license never converts a useful A/B capability into C. When direct implementation reuse is unsuitable, Masanawa independently reimplements the same required capability behind its own canonical contracts.

## Pinned reference sources

| Source | Provenance note | Masanawa treatment |
|---|---|---|
| ChatWithStars | privately owned by repository owner | architecture/behavior/code may be migrated according to project ownership; still record source provenance |
| OpenJarvis | Apache-2.0 upstream | feature decisions independent of license; direct reused portions retain required notices |
| N.E.K.O | Apache-2.0 upstream | feature decisions independent of license; direct reused portions retain required notices |
| CyberVerse | GPLv3 upstream | useful capabilities remain A/B; implementation is independently rewritten unless a separately compatible reuse decision is made |
| AIRI | MIT upstream | feature decisions independent of license; reused portions retain required notices |
| LiveKit Server | Apache-2.0 upstream | selected transport infrastructure; required notices retained where distributed |
| LiveKit Agents TypeScript | Apache-2.0 upstream | selected realtime-session donor; required notices retained where distributed |
| LiveKit Agents Python | Apache-2.0 upstream | parity/reference donor; required notices retained where distributed |
| Pipecat | BSD-2-Clause upstream | pipeline behavior donor; required notices retained where distributed |
| Letta / Letta Code | Apache-2.0 upstream | memory/context donor; required notices retained where distributed |
| Mem0 | Apache-2.0 upstream | memory retrieval/extraction donor; required notices retained where distributed |
| AI Town | MIT upstream | simulation behavior donor; required notices retained where distributed |
| elizaOS | MIT upstream | plugin/component donor; required notices retained where distributed |
| Microsoft Agent Framework | MIT upstream | durable workflow donor; required notices retained where distributed |
| OpenClaw | MIT upstream | Gateway/device/runtime donor; required notices retained where distributed |
| OpenClaw Agent Skills | MIT upstream | skill-format/distribution reference; required notices retained where distributed |

## Reference vault

Submodules under `references/sources/` preserve upstream snapshots and their own notices. Those files are not Masanawa's root license and do not create donor architectural boundaries.

## Direct adaptation record

When canonical Masanawa source contains direct third-party code, record:
- destination path;
- donor repository/path/revision;
- whether modified;
- required notice/attribution;
- reviewer/date.

## Independent rewrite record

When a donor capability is reimplemented:
- keep the feature/behavior ledger entry;
- define the Masanawa-owned contract;
- write new implementation against that contract;
- retain behavior/parity evidence;
- do not downgrade the capability merely because implementation reuse was unsuitable.

## Third-party assets/models

Models, weights, fonts, images, binary assets and vendored subprojects require their own provenance checks when shipped. That affects packaging/distribution, not whether the product capability remains in scope.
