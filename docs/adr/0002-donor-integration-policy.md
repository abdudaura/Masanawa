# ADR-0002: Donor Integration Policy

Status: accepted
Date: 2026-10-01

## Decision

Masanawa is a greenfield reimplementation. Donor repositories are reference implementations, not subprojects, git submodules or runtime services by default.

No donor directory may be copied wholesale.

Feature migration is ledger-driven and behavior-tested.

## Reasons

Directly merging repositories would preserve:
- overlapping runtimes;
- conflicting memory systems;
- duplicated agent/tool abstractions;
- provider-specific assumptions;
- multiple UI/config styles;
- historical project boundaries.

The rewrite exists specifically to eliminate those problems.

## Exception

A bounded external component may be adopted only when:
- its contract is explicit;
- the architecture does not give it canonical domain ownership;
- licensing is compatible/reviewed;
- operational ownership is clear;
- an ADR records the decision.
