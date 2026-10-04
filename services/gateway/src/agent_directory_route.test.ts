import { afterEach, describe, expect, it } from "vitest";
import type { AgentDirectoryService } from "./agent_directory.js";
import { createGatewayApp } from "./app.js";

const apps: Array<ReturnType<typeof createGatewayApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("agent directory route", () => {
  it("forwards authorization and omits Skill assignment", async () => {
    let seen: string | undefined;
    const directory: AgentDirectoryService = {
      async list(input) {
        seen = input.authorizationHeader;
        return [
          {
            characterId:
              "character_00000000-0000-4000-8000-000000000002",
            characterVersionId:
              "character-version_00000000-0000-4000-8000-000000000003",
            displayName: "Amina",
            roleLabel: "Sales & Outreach",
            about: "Handles prospects",
            greeting: "What should we work on?",
            presence: "available",
            activeWorkCount: 0,
            supportAgent: true,
            defaultPlatformAgent: true,
            voiceProvider: "gemini",
            voiceName: "Bodi",
          },
        ];
      },
      async setDefaultPlatformAgent(input) {
        seen = input.authorizationHeader;
        return {
          characterId:
            "character_00000000-0000-4000-8000-000000000002" as never,
        };
      },
    };
    const app = createGatewayApp({ agentDirectory: directory });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/agent/directory",
      headers: { authorization: "Bearer user" },
    });

    expect(response.statusCode).toBe(200);
    expect(seen).toBe("Bearer user");
    const body = response.json();
    expect(body.agents[0].displayName).toBe("Amina");
    expect(body.agents[0]).not.toHaveProperty("skillVersionIds");
    expect(body.agents[0]).toMatchObject({
      supportAgent: true,
      defaultPlatformAgent: true,
      voiceProvider: "gemini",
      voiceName: "Bodi",
    });

    const update = await app.inject({
      method: "PUT",
      url: "/agent/preferences/default",
      headers: { authorization: "Bearer user" },
      payload: {
        characterId:
          "character_00000000-0000-4000-8000-000000000002",
      },
    });
    expect(update.statusCode).toBe(200);
    expect(seen).toBe("Bearer user");
  });
});
