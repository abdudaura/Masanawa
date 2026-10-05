import {
  defineRailway,
  github,
  image,
  project,
  service,
  volume,
} from "railway/iac";

export default defineRailway((ctx) => {
  const production = ctx.environment === "production";

  const databaseVolume = volume("masanawa-postgres", {
    sizeMB: 1024,
  });

  const database = service("masanawa-db", {
    source: image("pgvector/pgvector:0.8.6-pg18-bookworm"),
    volumeMounts: {
      "/var/lib/postgresql": databaseVolume,
    },
    env: {
      POSTGRES_DB: "masanawa",
      POSTGRES_USER: "postgres",
      POSTGRES_PASSWORD: "__MASANAWA_DB_PASSWORD__",
      DATABASE_URL:
        "postgresql://${{ masanawa-db.POSTGRES_USER }}:${{ masanawa-db.POSTGRES_PASSWORD }}@${{ masanawa-db.RAILWAY_PRIVATE_DOMAIN }}:5432/${{ masanawa-db.POSTGRES_DB }}",
    },
  });

  const gateway = service("masanawa-gateway", {
    source: github("Baatiku/masanawa", { branch: "main" }),
    build:
      "pnpm install --frozen-lockfile && pnpm --filter @masanawa/gateway-service... build",
    start: "pnpm --filter @masanawa/gateway-service start",
    healthcheck: "/healthz",
    healthcheckTimeout: 30,
    domains: production ? ["gateway.masanawa.com"] : [],
    env: {
      MASANAWA_DATABASE_URL: database.env.DATABASE_URL,
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
      MASANAWA_DATABASE_URL: database.env.DATABASE_URL,
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
      MASANAWA_DATABASE_URL: database.env.DATABASE_URL,
      NODE_ENV: production ? "production" : "development",
      HOST: "0.0.0.0",
    },
  });

  return project("masanawa", {
    resources: [databaseVolume, database, gateway, worker, ops],
  });
});
