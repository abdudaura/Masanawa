# Adapter Topology and Registration

Status: canonical production-structure contract.

This document defines the external-edge implementation boundary required by production
Task 055. It is enforced by `test/architecture/adapter-boundaries.test.ts`.

## 1. Canonical adapter families

Production adapters live only under these families:

- `adapters/storage/*` — canonical repository/index/outbox implementations;
- `adapters/providers/*` — external Provider implementations behind canonical Provider/Tool ports;
- `adapters/channels/*` — WhatsApp, Telegram, email and future channel transports;
- `adapters/devices/*` — Android/Agent Phone and other device-node implementations;
- `adapters/media/*` — renderer/media edge implementations;
- `adapters/inference/*` — local or specialist inference implementations.

An adapter implementation is a leaf workspace at
`adapters/<family>/<implementation>`.

The shared Node process lifecycle is not an external-domain adapter. It lives at
`infra/runtime/node` and remains available as `@masanawa/node-runtime`. This keeps
service hosting infrastructure separate from provider/channel/device/storage edges.

## 2. Adapter implementation contract

Every implemented TypeScript adapter workspace contains `adapter.json`,
`package.json`, `tsconfig.json`, `tsconfig.build.json` and public
`src/index.ts`.

`adapter.json` is machine-readable registration metadata:

```json
{
  "schemaVersion": 1,
  "family": "storage",
  "implementation": "postgres",
  "package": "@masanawa/postgres",
  "registration": "explicit"
}
```

The folder family/name, package name and metadata must agree.

## 3. Dependency direction

Adapters are leaves at the external edge. They may depend on canonical `packages/*`
public entrypoints and the external SDK/library they adapt. They must not depend on
another adapter, a service, an app or an infra workspace. Relative imports must remain
inside the adapter workspace.

If behavior spans two external edges, orchestration belongs in a service, Workflow or
canonical package port. An Android telephony adapter therefore never calls a cloud
telephony adapter directly; both implement canonical capability/Provider boundaries.

## 4. Registration rule

Adapter registration is always explicit. A service/owner composition root constructs
the adapter and passes/registers its canonical port. Presence may explicitly compose
media/inference adapters; Provider implementations register with the Provider owner.

Forbidden patterns include import-time side-effect registration, filesystem/package
scanning that silently activates sibling adapters, global service-locator mutation and
adapter-to-adapter discovery/calls.

There is intentionally no generic second Adapter Registry. Existing canonical
registries/owners remain authoritative.

## 5. Device/OmniSIP boundary

The Agent Phone implementation belongs under `adapters/devices/android`. OmniSIP may
be used inside that Android telephony implementation, but it remains behind canonical
DeviceCapability/Tool/Provider contracts and never becomes a second Masanawa runtime.

## 6. Storage composition

`adapters/storage/postgres` may implement repository ports for several domain packages
because PostgreSQL is one storage technology edge. That does not grant it domain
ownership. Domain packages own repository contracts/migrations; services compose the
adapter explicitly.

## 7. Change rule

A new adapter family requires architectural evidence and an ADR before changing the
allowlist. A new implementation inside an existing family must satisfy the manifest,
public-entrypoint and dependency gates in the same change.
