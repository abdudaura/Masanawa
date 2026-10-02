# @masanawa/devices — canonical boundary

Status: canonical ownership established; production implementation is scheduled by the master task ledger.

Owns durable platform contracts for Device identity/lifecycle, DeviceCapability publication/readiness, CharacterDeviceAssignment, capability policy, Device operation/custody references that compose canonical Operation IDs, and health/last-seen facts needed for provider selection and Ops.

Does not own Character identity or memory, raw device credentials/authorization policy, Tool/Provider definitions, Android implementation details, OmniSIP telephony mechanics, or Workflow truth.

Concrete implementations live under `adapters/devices/*` and depend inward on this boundary plus Tool/Provider/Perception/Security contracts.

See `docs/AGENT-PHONE-EMBODIMENT.md`, `docs/PRODUCT-PROJECT-STRUCTURE.md`, and `docs/PRODUCTION-MASTER-TASKS.md`.