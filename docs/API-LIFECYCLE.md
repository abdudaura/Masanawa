# Public API, Versioning and Deprecation Lifecycle

Status: canonical repository-wide compatibility contract.

This document defines the public compatibility rules established by production Task
057. The machine-readable policy is `docs/API-LIFECYCLE.json`; blocking contract
evidence lives in `tests/contracts/public-api-lifecycle.test.ts`. Structural root-entrypoint and deep-import isolation is also enforced by `test/architecture/public-api-lifecycle.test.ts`.

Masanawa has several distinct version domains. They must not be collapsed into one
number.

## 1. Workspace package API

A reusable workspace under `packages/*`, `adapters/*/*` or `infra/*/*` exposes
only its package root unless an explicitly reviewed compatibility surface is added.

Rules:
- cross-workspace imports use `@masanawa/<package>`, never deep
  `@masanawa/<package>/...` paths;
- `src/index.ts` is the public TypeScript boundary;
- the package `exports` map exposes only `.` using the canonical
  types/production/default targets;
- every workspace package version is valid SemVer;
- private greenfield workspaces may remain at `0.0.0` while unpublished, but that
  does not permit unreviewed breaking changes between owners;
- once a package is externally published, normal SemVer applies: PATCH for compatible
  fixes, MINOR for compatible additions, MAJOR for breaking public changes.

Adding a public subpath export is an API decision, not a folder convenience. It requires
updating this lifecycle contract and compatibility tests.

## 2. HTTP API versions

Operational probes are intentionally unversioned:
- `/healthz`;
- `/readyz`.

All product/public/internal HTTP contract routes use a major prefix such as
`/v1/...`. The supported major list is declared in `API-LIFECYCLE.json`.

Gateway bootstrap registers `/v1` aliases for existing unversioned product routes,
using the same handlers, authorization hooks, schemas and response contracts.
Installed clients retain their existing URLs. Probes stay unversioned; already
versioned routes do not acquire another prefix. Legacy routes beyond the historical
compatibility prefixes are inventoried by exact method and path in
`http.compatibilityUnversionedRoutes`. This is an explicit migration layer, not
permission for new unversioned routes or another source of durable state.
New clients should use `/v1`; removal of a legacy URL requires separately reviewed
client migration and registered deprecation. Agent retries retain canonical request
keys on both URL forms and remain scoped by the same authorization/repository checks.

Compatible request/response additions may stay within a major only when existing clients
remain valid. A breaking route/schema/semantic change requires a new supported major or
an explicit compatibility layer. Old and new majors may coexist during migration.

The URL major is an API contract version. It is not the database migration version and
not the package.json version.

## 3. Event and durable payload schema versions

`PlatformEvent.eventType + schemaVersion` identifies an event wire schema.

For event and durable payload `schemaVersion` values:
- versions are positive integers;
- the same version must never be reinterpreted with incompatible meaning;
- incompatible shape/semantic changes require a new schema version;
- readers must explicitly support the versions they consume;
- migrations/upcasters may translate old data, but the original durable evidence stays
  attributable to its original version.

A TypeScript interface edit alone does not migrate durable data.

## 4. Tool, Provider and other domain versions

Tool and Provider `key + version` values are immutable registry identities. Once a
version is registered or durably referenced, its behavior/contract must not be silently
redefined. Incompatible behavior uses a new version and normal registry selection.

CharacterVersion, WorkflowVersion, SkillVersion and similar domain-version entities are
also domain history, not package SemVer or HTTP versions.

## 5. Deprecation registry

Deprecation is explicit and machine-auditable. `API-LIFECYCLE.json` owns the registry.

Every entry contains:
- stable `id`;
- `surfaceKind`: one of `workspace-symbol`, `http-route`, `event-schema`,
  `payload-schema`, `tool-version`, `provider-version`;
- concrete `surface`;
- `deprecatedIn`;
- `removalTarget`;
- `replacement`;
- `reason`.

For code symbols, the source JSDoc must use:

```ts
/** @deprecated masanawa:<deprecation-id> use the replacement surface */
```

A plain ad-hoc `@deprecated` without a registry ID fails the contract suite. A
workspace-symbol registry entry without a matching source annotation also fails.

HTTP/schema/domain-version deprecations may be registry-only because their source of
truth is not necessarily one TypeScript symbol.

## 6. Removal rule

Deprecation is not removal permission by itself.

Before removal:
1. the replacement must exist;
2. migration/compatibility evidence must exist;
3. dependent Masanawa workspaces must have moved;
4. the declared removal target must be reached;
5. the change must pass Contracts plus the normal repository gate.

No compatibility shim may become a second source of durable truth.

## 7. Database and implementation details

Database tables, internal files, repository implementation classes, adapter SDK objects
and service-local helpers are not public APIs merely because code can reach them.

Database schema is durable storage truth and is governed by migrations. Public service
and package contracts remain above it.

## 8. Change rule

A change to supported HTTP majors, root export policy, or a deprecation record must
update `API-LIFECYCLE.json`, this document and the relevant compatibility evidence in
the same reviewed change.
