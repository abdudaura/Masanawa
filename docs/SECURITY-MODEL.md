# Security and Privacy Model

Security is foundation work, not a later hardening phase.

## Trust boundaries

- public browser/client;
- authenticated user client;
- channel webhook/transport;
- gateway;
- internal services;
- worker/GPU services;
- provider APIs;
- operator/Ops;
- database/storage;
- secret vault.

Every crossing uses authenticated, validated contracts.

## Identity and authorization

- Users and channel identities are separate concepts.
- Operator permissions use explicit RBAC/authorization.
- Service-to-service calls use scoped service identity.
- A model result is never authorization.
- Character persona cannot grant itself more permissions.

## Data isolation

- private user-character relationship memory is isolated by subject+character+tenant;
- world/shared memory has a separate scope;
- task context contains only data needed by the task;
- handoffs transfer bounded context;
- browser clients receive no service-role/provider credentials.

## Secrets

- stored only in environment/vault/secret manager;
- database rows hold vault references where practical;
- never committed;
- never included in model prompts unless absolutely required by a provider tool and then handled outside free-form model text;
- logs mask secret-like fields.

## Consequential actions

Purchases, bookings, payouts, third-party messages, account changes and destructive mutations require:
- authenticated authority;
- exact normalized inputs;
- current-state validation;
- approval where policy requires;
- idempotency key;
- provider attempt record;
- reconciliation strategy;
- audit event.

## Webhooks

- verify signatures before processing;
- enforce timestamp/replay windows where supported;
- deduplicate provider event IDs;
- validate body size/content type/schema.

## Perception privacy

Camera, microphone, screen, files and location-like context require explicit product permission and clear active-session semantics. Sensitive perception is minimized before storage/model use.

## Memory privacy

Models may suggest memory candidates but deterministic code chooses permissible scope and retention. A memory retrieval query can never escape the relationship/tenant scope supplied by trusted runtime identity.

## Untrusted skills/plugins

Imported extensions begin untrusted.
- parse metadata safely;
- scripts disabled by default unless reviewed;
- declared capabilities are checked;
- network/filesystem permissions are sandboxed/allowlisted where practical;
- consequential capabilities require certification;
- provenance is retained.

## Model/provider failure

Model outages or malformed model output must fail closed for consequential actions and degrade safely for conversation.

## Required CI/security gates

Eventually include:
- dependency/security scanning;
- secret scanning;
- schema/RLS tests;
- architecture-boundary tests;
- unsafe broad policy checks;
- auth/authorization regression tests;
- request-limit tests;
- webhook verification tests;
- memory isolation tests;
- idempotency/replay tests.
