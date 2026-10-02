# Package and Service Implementation Templates

Status: canonical production-structure contract.

This document turns the ownership guidance in `PRODUCT-PROJECT-STRUCTURE.md` and
`PACKAGE-BOUNDARIES.md` into a repeatable implementation shape. The architecture
suite enforces the non-optional parts in
`test/architecture/implementation-templates.test.ts`.

The templates are deliberately small. They standardize public boundaries, build
behavior and service ownership without forcing every domain to contain ceremonial
files it does not need. The root production build is recursive, so adding an implemented
workspace package cannot silently leave it outside the normal build gate.

## 1. Domain package template

An implemented canonical TypeScript package under `packages/<name>` has:

```text
packages/<name>/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── src/
    ├── index.ts
    ├── model.ts              # when the domain owns durable/model contracts
    ├── invariants.ts         # when domain invariants exist
    ├── repository.ts         # when durable storage requires a canonical port
    ├── internal/             # optional private implementation
    └── *.test.ts             # colocated unit/contract tests
```

Package-owned migrations remain under `packages/<name>/migrations/` when the package
owns durable schema. They are optional for packages with no durable persistence.

Required manifest/build contract:
- package name is `@masanawa/<name>`;
- `private: true` and ESM (`type: module`);
- public root export resolves types/default development use from `src/index.ts` and
  the `production` condition from `dist/index.js`;
- `typecheck` uses `tsc -p tsconfig.json`;
- `build` uses `tsc -p tsconfig.build.json`;
- package TypeScript inherits the repository strict baseline;
- production build emits JavaScript, source maps and declarations into `dist/`;
- tests are excluded from emitted production output.

`src/index.ts` is the cross-package boundary. Another package must not import a
neighbor package repository, migration, `internal/` path or other private source path.

## 2. Service template

The canonical deployable service topology is exactly:
- `services/gateway`;
- `services/worker`;
- `services/presence`;
- `services/ops`.

Adding another deployable service requires architectural evidence and an ADR before
the service directory and architecture allowlist change. Domain growth alone is not
a reason to create another process.

An implemented TypeScript service has:

```text
services/<name>/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── src/
    ├── app.ts
    ├── app.test.ts
    └── main.ts
```

`app.ts` is the composition/lifecycle module; it need not imply that every service is
an HTTP server. `main.ts` is the process entrypoint. Canonical domain truth remains in
packages; services compose packages and adapters.

Required manifest/build contract:
- package name is `@masanawa/<name>-service`;
- `private: true` and ESM;
- `typecheck` and `build` use the repository TypeScript configs;
- `start` executes `node --conditions=production dist/main.js`;
- production build emits executable JavaScript/source maps but not declarations.

## 3. What is intentionally not standardized

The gate does not require every package to contain `model.ts`, `repository.ts`,
`invariants.ts`, migrations, or an `internal/` folder. Those exist only when domain
ownership requires them. It also does not dictate file length or split modules merely
for aesthetics.

Adapter shape/registration is defined by `docs/ADAPTER-TOPOLOGY.md` and enforced by
`test/architecture/adapter-boundaries.test.ts`. Cross-cutting suite taxonomy and CI gate conventions are defined by `docs/TEST-TOPOLOGY.md` and enforced by `test/architecture/test-topology.test.ts`. Public API version/deprecation rules are Task 057,
and production environment/deployment conventions are Task 058.

## 4. Change rule

If a legitimate implementation no longer fits this template, update the governing
architecture/ADR first, then change this document and the architecture tests in the
same reviewed change. Do not silently bypass the gate.
