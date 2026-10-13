import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("Railway recovery contracts (no production side effects)", () => {
  const gateway = JSON.parse(source("services/gateway/package.json")) as {
    scripts: Record<string, string>;
  };
  const worker = JSON.parse(source("services/worker/package.json")) as {
    name: string; scripts: Record<string, string>;
  };
  const gatewayRailway = source("infra/deployment/gateway/railway.toml");
  const workerRailway = source("infra/deployment/worker/railway.toml");
  const workerDocker = source("infra/deployment/worker/Dockerfile");

  it("requires explicit migration separately from Gateway startup", () => {
    expect(gateway.scripts.start).toBe("node --conditions=production dist/main.js");
    expect(gateway.scripts.migrate).toBe("node --conditions=production dist/migrate.js");
    expect(gateway.scripts.start).not.toMatch(/migrate|bootstrap|alpha:prepare/u);
    expect(gatewayRailway).toContain('startCommand = "pnpm --filter @masanawa/gateway-service start"');
    // Health alone is not proof the schema matches this deployed release.
    expect(gatewayRailway).toContain('healthcheckPath = "/readyz"');
  });

  it("binds a separate canonical Worker to a source-built production artifact", () => {
    expect(worker.name).toBe("@masanawa/worker-service");
    expect(worker.scripts.start).toBe("node --conditions=production dist/main.js");
    expect(workerRailway).toContain('dockerfilePath = "infra/deployment/worker/Dockerfile"');
    expect(workerRailway).toContain('startCommand = "pnpm --filter @masanawa/worker-service start"');
    expect(workerRailway).toContain('healthcheckPath = "/readyz"');
    expect(workerDocker).toContain("FROM node:24-bookworm-slim");
    expect(workerDocker).toContain("pnpm install --frozen-lockfile");
    expect(workerDocker).toContain("pnpm --filter @masanawa/worker-service... build");
    expect(workerDocker).toContain('CMD ["pnpm", "--filter", "@masanawa/worker-service", "start"]');
    expect(workerDocker).not.toMatch(/@nurain\/worker|work\/billing-customer-journey/u);
  });

  it("does not perform implicit database writes in either service manifest", () => {
    for (const manifest of [gatewayRailway, workerRailway]) {
      expect(manifest).not.toMatch(/(?:preDeployCommand|pg_dump|pg_restore|volumeMount|DATABASE_URL\s*=|pnpm migrate|alpha:prepare)/u);
      expect(manifest).toContain('restartPolicyType = "ON_FAILURE"');
    }
  });
});
