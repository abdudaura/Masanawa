# Third-Party Notices

Masanawa is a newly designed platform that studies, adapts, integrates, or reimplements capabilities observed across multiple reference projects and dependencies.

## Product rule

Third-party licensing does **not** decide whether a useful capability belongs in Masanawa.

Feature selection is architectural:
- **A** — preserve required behavior;
- **B** — preserve capability while redesigning implementation;
- **C** — deliberately retire/reference because Masanawa does not need it.

If a useful donor capability cannot be incorporated directly under Masanawa's distribution model, the capability remains A/B and is independently reimplemented behind Masanawa's canonical contracts.

## Reference vault

Pinned donor repositories live under `references/sources/`. Their own copyright and license files remain part of those upstream snapshots and are not Masanawa's project license.

Those notices are retained because they identify ownership of the reference material; they do not create architectural ownership inside Masanawa.

## Direct third-party code

Any third-party code intentionally included in canonical Masanawa source must retain whatever notices are required for that material. Such notices are compliance metadata only and do not define Masanawa package boundaries, domain ownership, APIs, data models, or product behavior.

## Canonical ownership

Masanawa's root `LICENSE` applies to original Masanawa work. Reference repositories and third-party dependencies remain separately owned by their respective copyright holders.
