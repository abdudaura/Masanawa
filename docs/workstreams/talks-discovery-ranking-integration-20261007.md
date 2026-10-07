# Talk discovery ranking integration — 2026-10-07

- **Owner:** current ChatGPT Talks implementation window
- **Branch:** `work/talks-discovery-ranking-integration-20261007`
- **Original base:** `753129ff33c4a5e1021b872180809da206352855`
- **Lane:** integrate deterministic Explore ranking into canonical Talk feed

## Outcome

While this lane was being implemented, newer `main` advanced to
`52e1f04b11a4a2c96239e93c9acb0ea5c9537ea1` and independently landed the same
integration:

- canonical `TalkListRow` with reaction/follow signals;
- tenant/viewer-scoped follow lookup;
- reaction counts from `talks.participation`;
- safety-filtered candidate retrieval;
- deterministic `rankTalksForExplore`;
- neutral language/relevance until real request-context signals exist;
- Host diversification;
- Live feed preserving operational ordering.

The mainline version is preferable because it also includes stricter invalid-state handling
and current parameter ordering. No duplicate PR should be opened from this branch.

**Status:** superseded by newer mainline implementation; claim released.
