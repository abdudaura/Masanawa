import {
  defineRailway,
  github,
  project,
  service,
} from "railway/iac";

const databaseUrl = "${{ masanawa-db.DATABASE_URL }}";

export default defineRailway((ctx) => {
  const production = ctx.environment === "production";

  const gateway = service("masanawa-gateway", {
    source: github("Baatiku/masanawa", { branch: "main" }),
    build:
      "pnpm install --frozen-lockfile && pnpm --filter @masanawa/gateway-service... build",
    start: "pnpm --filter @masanawa/gateway-service start",
    healthcheck: "/healthz",
    healthcheckTimeout: 30,
    domains: production ? ["gateway.masanawa.com"] : [],
    env: {
      MASANAWA_DATABASE_URL: databaseUrl,
      NODE_ENV: production ? "production" : "development",
      HOST: "0.0.0.0",
      MASANAWA_PLATFORM_AUTH_BASE_URL: "https://api.masanawa.com",
      MASANAWA_PLATFORM_AUTH_POLICY_REVISION: "mobile-platform-session-v1",
    },
  });

  const worker = service("masanawa-worker", {
    source: github("Baatiku/masanawa", { branch: "main" }),
    build:
      "pnpm install --frozen-lockfile && pnpm --filter @masanawa/worker-service... build",
    start: "pnpm --filter @masanawa/worker-service start",
    healthcheck: "/healthz",
    healthcheckTimeout: 30,
    env: {
      MASANAWA_DATABASE_URL: databaseUrl,
      NODE_ENV: production ? "production" : "development",
      HOST: "0.0.0.0",
    },
  });

  const ops = service("masanawa-ops", {
    source: github("Baatiku/masanawa", { branch: "main" }),
    build:
      "pnpm install --frozen-lockfile && pnpm --filter @masanawa/ops-service... build",
    start: "pnpm --filter @masanawa/ops-service start",
    healthcheck: "/healthz",
    healthcheckTimeout: 30,
    domains: production ? ["ops.masanawa.com"] : [],
    env: {
      MASANAWA_DATABASE_URL: databaseUrl,
      NODE_ENV: production ? "production" : "development",
      HOST: "0.0.0.0",
    },
  });

  return project("masanawa", {
    resources: [gateway, worker, ops],
  });
});
