import { afterEach, describe, expect, it } from "vitest";
import type { AgentDirectoryService } from "./agent_directory.js";
import { createGatewayApp } from "./app.js";

const apps: Array<ReturnType<typeof createGatewayApp>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("Home projection route", () => {
  it("resolves Gwana/Gwani from server-owned directory identities and returns server-owned Rooms", async () => {
    let seen: string | undefined;
    const directory: AgentDirectoryService = {
      async list(input) {
        seen = input.authorizationHeader;
        return [
          {
            characterId: "character_gwani_server",
            characterVersionId: "character-version_gwani_server",
            displayName: "Gwani",
            roleLabel: "Platform assistant",
            about: "Helps with everyday work",
            greeting: null,
            presence: "available",
            activeWorkCount: 0,
            supportAgent: true,
            defaultPlatformAgent: true,
            voiceProvider: "gemini",
            voiceName: "Bodi",
          },
          {
            characterId: "character_gwana_server",
            characterVersionId: "character-version_gwana_server",
            displayName: "Gwana",
            roleLabel: "Platform assistant",
            about: "Helps with everyday work",
            greeting: null,
            presence: "available",
            activeWorkCount: 0,
            supportAgent: true,
            defaultPlatformAgent: false,
            voiceProvider: "gemini",
            voiceName: "Sulafat",
          },
        ];
      },
      async setDefaultPlatformAgent() {
        throw new Error("not used");
      },
    };

    const app = createGatewayApp({ agentDirectory: directory });
    apps.push(app);

    const response = await app.inject({
      method: "GET",
      url: "/v1/home",
      headers: { authorization: "Bearer home-user" },
    });

    expect(response.statusCode).toBe(200);
    expect(seen).toBe("Bearer home-user");

    const body = response.json();
    expect(body.assistants).toEqual([
      expect.objectContaining({
        role: "gwana",
        characterId: "character_gwana_server",
        displayName: "Gwana",
        voiceLabel: "Sulafat",
      }),
      expect.objectContaining({
        role: "gwani",
        characterId: "character_gwani_server",
        displayName: "Gwani",
        voiceLabel: "Bodi",
      }),
    ]);
    expect(body.rooms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          roomId: "room.internet-cafe",
          isAvailable: true,
        }),
        expect.objectContaining({
          roomId: "room.story-radio",
          isAvailable: false,
        }),
      ]),
    );
    expect(body).not.toHaveProperty("skills");
  });

  it("does not invent assistant Character IDs when a Home role is absent", async () => {
    const directory: AgentDirectoryService = {
      async list() {
        return [];
      },
      async setDefaultPlatformAgent() {
        throw new Error("not used");
      },
    };

    const app = createGatewayApp({ agentDirectory: directory });
    apps.push(app);

    const response = await app.inject({ method: "GET", url: "/v1/home" });

    expect(response.statusCode).toBe(200);
    expect(response.json().assistants).toEqual([]);
  });
});
