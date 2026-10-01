# License and Provenance Ledger

This is an engineering record, not legal advice.

## Baseline source licenses

| Source | License at pinned baseline | Default Masanawa policy |
|---|---|---|
| ChatWithStars | privately owned by repository owner | reuse/redesign permitted; still track migration provenance |
| OpenJarvis | Apache-2.0 | study freely; direct adaptation only with attribution/provenance |
| N.E.K.O | Apache-2.0 | study freely; direct adaptation only with attribution/provenance |
| CyberVerse | GPLv3 | reference/clean implementation by default; no direct core copy without licensing ADR/review |
| AIRI | MIT | architecture/design/code may be adapted with required copyright/license notice |
| LiveKit server | Apache-2.0 | study/adapt with Apache notice/provenance obligations |
| LiveKit Agents TypeScript | Apache-2.0 | study/adapt with Apache notice/provenance obligations |
| LiveKit Agents Python | Apache-2.0 | study/adapt with Apache notice/provenance obligations |
| Pipecat | BSD-2-Clause | study/adapt with copyright/license notice |
| Letta server | Apache-2.0 | study/adapt with Apache notice/provenance obligations |
| Letta Code | Apache-2.0 | study/adapt with Apache notice/provenance obligations |
| Mem0 | Apache-2.0 | study/adapt with Apache notice/provenance obligations |
| AI Town | MIT | study/adapt with copyright/license notice |
| elizaOS | MIT | study/adapt with copyright/license notice |
| Microsoft Agent Framework | MIT | study/adapt with copyright/license notice |
| OpenClaw | MIT | study/adapt with copyright/license notice and preserve applicable third-party notices |
| OpenClaw Agent Skills | MIT | study/adapt with copyright/license notice |

Submodules preserve upstream source and licenses independently. Their presence in this repository does **not** change Masanawa's own license and does not authorize copying code without complying with the corresponding source license.

## Direct adaptation record template

For every directly adapted external code section record:
- Masanawa destination;
- source repository;
- source path;
- source commit;
- original license;
- whether modified;
- required attribution/NOTICE;
- reviewer;
- date.

## Concept-only reference

Architectural ideas and externally observable behavior may be reimplemented independently. Record the donor/behavior in the migration ledger even when no code is copied, because provenance helps later maintenance and avoids unknowingly creating two implementations.

## GPL-sensitive clean implementation

For CyberVerse by default:
1. record behavior/architecture in ledgers;
2. define Masanawa contract independently;
3. implement against the Masanawa contract without copying source code/text;
4. validate via behavior-oriented fixtures;
5. keep provenance identifying CyberVerse as a reference.

Any future decision to distribute or run GPL-derived code as a deliberately separated component requires a licensing ADR before implementation.

## Apache/NOTICE caution

For Apache-2.0 donors, inspect both LICENSE and any NOTICE/third-party notice files before direct code adaptation. Preserve required notices and record modifications where required.

## Third-party code inside donors

A donor's top-level license does not guarantee every bundled model, asset, generated file, plugin or third-party directory has the same license. Direct adaptation must inspect the specific source path and its notices.
