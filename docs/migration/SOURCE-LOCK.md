# Source Lock

The rewrite is analysed against pinned revisions so the target does not move silently.

| Source | Branch | Pinned revision | Primary purpose |
|---|---|---|---|
| Baatiku/chatwithstars | platform-unification | `3ab02704118ce3d8f38a423c9a52e9d44a705aeb` | Masanawa domain/product/governance donor |
| open-jarvis/OpenJarvis | main | `c4da16e1ca3d21f4cc1905d4200063e564104f0f` | agents/skills/tools/learning donor |
| Project-N-E-K-O/N.E.K.O | main | `48ac9243a9d8e75a37d7598548c29017df1c6d2e` | companion cognition/proactivity/embodiment donor |
| Lynpoint/CyberVerse | main | `13a6a95b47e5e6f0809683458767746ad54d7d7f` | realtime digital-human architecture donor |

These are analysis baselines, not vendored dependencies.

## Upstream-change policy

Do not silently move these refs during Phase 0.

If an important upstream change lands:
1. record it separately;
2. determine whether it adds/fixes a capability relevant to Masanawa;
3. add ledger rows/deltas;
4. update this lock only in an explicit source-refresh commit.

## Provenance

If Masanawa code directly adapts Apache-licensed source code, record source repository, exact file, commit SHA and attribution requirements in LICENSE-LEDGER and a provenance note.

CyberVerse is GPLv3 at this baseline; default policy is architectural study/clean implementation, not source copying.
