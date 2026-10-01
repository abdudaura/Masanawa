# ADR-0004: One Scoped Cognitive Memory Architecture

Status: accepted
Date: 2026-10-01

## Decision

Masanawa uses one canonical memory service combining:
- N.E.K.O cognitive lifecycle patterns;
- ChatWithStars privacy/ownership scope;
- optional OpenJarvis retrieval/index techniques.

Every durable memory has both a cognitive type and an access/ownership scope.

Automatic context compilation is separate from explicit semantic recall.

Character-authored identity is not silently mutated by learned persona memory.

Background cognition is durable, idempotent, bounded-retry and dead-letter capable.

## Rejected alternatives

- separate channel memories;
- one vector database as the memory model;
- N.E.K.O per-character files as canonical persistence;
- ChatWithStars prompt-only memory injection;
- provider conversation history as durable memory.
