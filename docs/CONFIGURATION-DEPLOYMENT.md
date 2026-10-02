# Production Configuration and Deployment Contracts

Status: canonical production-structure contract.

This document defines the configuration, secret-reference and deployment-layout conventions
established by production Task 058.

## 1. Configuration ownership

Configuration is explicit process input. Domain packages must not read `process.env` or
vendor deployment metadata directly. Deployable services and infrastructure composition roots
may read environment variables and translate them into typed canonical configuration.

The canonical environment registry is `config/production-env.json`. It records each supported
variable's owner, classification, required environments and description. New production
variables must be registered there in the same change that consumes them.

## 2. Names and precedence

Masanawa-owned variables use the `MASANAWA_` prefix. Standard runtime variables such as
`NODE_ENV`, `HOST` and `PORT` may be accepted only at the process-hosting boundary.

Service-specific host/port variables take precedence over generic host-provided values:
`MASANAWA_GATEWAY_HOST/PORT`, `MASANAWA_WORKER_HOST/PORT`,
`MASANAWA_OPS_HOST/PORT`, and future `MASANAWA_PRESENCE_HOST/PORT`.

Compatibility aliases are bounded ingress conveniences; canonical configuration passed inward
uses typed fields, never a bag of environment names.

## 3. Secrets and references

Secrets must never be committed to this repository, checked into env examples, embedded in
deployment manifests, or copied into domain records.

Provider/device/user credential material follows the Security-owned CredentialRef boundary.
Deployment/bootstrap secrets that cannot yet use CredentialRef are injected by the deployment
platform and are classified as `secret` in the registry. Source-controlled files may contain
only variable names, descriptions and non-secret development defaults.

Logs, errors and diagnostics must not echo secret values.

## 4. Required production bootstrap

The current Gateway, Worker and Ops service processes require a PostgreSQL connection in
production. `MASANAWA_DATABASE_URL` is canonical; `DATABASE_URL` is an infrastructure-host
compatibility alias at the service composition boundary.

Production startup must fail closed when required bootstrap configuration is absent or invalid.
Tests and dependency-injected unit composition may omit a real database URL.

## 5. Deployment topology

Deployment units follow canonical service ownership, not packages:
- Gateway — public/channel ingress and synchronous admission;
- Worker — durable background execution;
- Presence — realtime media/session transport when implemented;
- Ops — operator/control-plane API;
- specialist GPU/media workers only when an ADR and workload justify them.

Do not deploy one microservice per domain package. Apps call platform APIs and do not receive
database or provider secrets.

A deployment platform may map these units to Railway, DigitalOcean, Cloudflare, Kubernetes or
another host without changing domain ownership.

## 6. Environment separation

Development, test and production are separate configuration scopes. Production credentials
must not be reused as development/test defaults. CI uses explicit test-only configuration.

The environment registry may mark a variable required for one environment and optional for
another. An empty string never satisfies a required value.

## 7. Deployment manifests

Source-controlled deployment manifests contain:
- service identity and command/build metadata;
- health/readiness paths;
- non-secret resource/topology declarations;
- environment variable names or platform secret references.

They do not contain raw credentials. Vendor-specific manifests live under `infra/deployment`
when introduced and remain adapters for the canonical service topology.

## 8. Validation and change rule

`test/architecture/environment-contracts.test.ts` validates the registry and scans production
source/deployment text for configuration-boundary violations.

Any new production environment variable requires:
1. registry ownership/classification;
2. typed parsing at the composition boundary;
3. validation tests for invalid/missing values when required;
4. deployment documentation when operators must supply it.

A new deployable service or a change to canonical service topology requires architecture
documentation and, when ownership changes, an ADR.
