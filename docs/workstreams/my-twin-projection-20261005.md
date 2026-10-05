# My Twin backend projection workstream

Owner/window: current ChatGPT implementation window
Branch: `work/my-twin-projection-20261005`
Base SHA: `2bdd99908d94cc39ada639af1f21ebbdccb6bfe2`

## Scope

Provide one consumer-facing My Twin projection over profile, performance and paid-feature
availability, without owning Identity/Memory/Commerce persistence.

## Owned paths

- new `services/gateway/src/my_twin_projection*.ts`
- focused tests
- this claim file

## Contract

Return exactly what the mobile My Twin screen needs:
- hasTwin / characterId
- displayName / bio / languages
- public URL + discoverability
- voice enabled
- owner-access enabled
- visitors / conversations / earnings / pending owner requests

No CharacterVersion, SkillVersion, Workflow, Provider or Agent Float fields.

Status: implementation started 2026-10-05.
