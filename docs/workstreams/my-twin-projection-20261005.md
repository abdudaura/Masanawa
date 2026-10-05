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

Status: consumer projection implementation complete; concrete source adapters/shared integration pending.

Implemented:
- authenticated My Twin projection service;
- composition of profile, performance and paid-feature availability sources;
- exact consumer response expected by the My Twin mobile screen;
- stable no-twin empty state;
- HTTPS-only public twin link construction;
- simple discoverability update path;
- isolated GET /v1/my-twin route;
- isolated PUT /v1/my-twin/discoverability route;
- focused service and route tests;
- no CharacterVersion, SkillVersion, Workflow, Provider or Agent Float fields.

Still to wire:
- profile source adapter from canonical Twin Profile workstream;
- performance source adapter from Activity/economy events;
- feature-status adapter from paid-voice policy and owner-access offering;
- Gateway app/main composition;
- authenticated mobile provider wiring and router.
