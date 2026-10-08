import { afterEach, describe, expect, it } from "vitest";
import type { AgentDirectoryService } from "./agent_directory.js";
import { AgentDirectoryPreferenceError } from "./agent_directory.js";
import { createGatewayApp } from "./app.js";

const apps: Array<ReturnType<typeof createGatewayApp>> = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

const id = "character_00000000-0000-7000-8000-000000000003";

function appFor(error: AgentDirectoryPreferenceError) {
  const directory: AgentDirectoryService = {
    async list() { return []; },
    async setDefaultPlatformAgent() { throw error; },
  };
  const app = createGatewayApp({ agentDirectory: directory });
  apps.push(app);
  return app;
}

describe("R03 preference HTTP security and failure contract", () => {
  for (const [status, message] of [
    [400, "Invalid Character ID"],
    [404, "Character is not available to this user"],
    [409, "Selected Character is not a platform support agent"],
    [503, "Preference outcome unknown; refresh and retry"],
  ] as const) {
    it(`responds ${status} instead of 500 for expected preference errors`, async () => {
      const app = appFor(new AgentDirectoryPreferenceError(status, message));
      const reply = await app.inject({
        method: "PUT",
        url: "/agent/preferences/default",
        headers: { authorization: "Bearer customer" },
        payload: { characterId: id },
      });
      expect(reply.statusCode).toBe(status);
      expect(reply.body).not.toContain("INSERT");
      expect(reply.body).not.toContain("postgres");
    });
  }

  it("validates request JSON shape before it can reach persistence", async () => {
    const app = appFor(new AgentDirectoryPreferenceError(503, "unused"));
    const reply = await app.inject({
      method: "PUT", url: "/agent/preferences/default",
      payload: { characterId: id, unauthorizedTenant: "other" },
    });
    expect(reply.statusCode).toBe(400);
  });
});
