# Package and Service Boundaries

## Planned applications

- `apps/web`: customer/fan/product web.
- `apps/ops`: internal operator workspace.

## Planned services

- `services/gateway`: channel/API ingress and authentication boundary.
- `services/runtime`: character-session orchestration; consumes domain packages.
- `services/presence`: WebRTC/live audio/video/avatar transport.
- `services/workers`: durable/background application workers.
- `services/social`: social publishing/comment integration service.
- `services/studio`: produced media orchestration.

## Planned domain packages

- contracts
- identity
- agents
- skills
- tools
- workflows
- memory
- world
- decisions
- events
- providers
- perception
- proactivity
- commerce
- security
- telemetry
- testing

## Boundary rules

1. Services may depend on packages; packages do not depend on services.
2. Apps call service APIs/contracts; browser code does not import server provider adapters.
3. Domain packages cannot import WhatsApp/Telegram/Facebook-specific modules.
4. Provider-specific code sits in adapters at the edge of `packages/providers`, tools or services.
5. No package writes directly to another package's tables except through a documented repository/service contract.
6. `packages/contracts` contains transport/domain boundary schemas, not business implementations.
7. `packages/testing` provides fixtures/harnesses, never production state.
8. Avoid a package per trivial concept; extraction is justified by ownership/boundary, not folder aesthetics.

## Planned filesystem scaffold

The repository includes placeholder directories for these boundaries before implementation so architecture is visible. Empty directories use `.gitkeep` and may be removed when source files arrive.
