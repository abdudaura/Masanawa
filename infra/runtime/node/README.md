# Node service runtime host

This workspace contains Node.js process-host infrastructure shared by the coarse
Masanawa services: bounded runtime configuration, signal handling, graceful drain and
shutdown.

It is intentionally under `infra/runtime/node`, not `adapters/*`, because process
hosting is not a storage/provider/channel/device/media/inference edge and must not
participate in adapter selection or registration.

Package API compatibility remains `@masanawa/node-runtime`. It owns no Character,
Memory, Workflow, Provider, Tool or business truth.
