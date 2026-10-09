import { describe, expect, it } from "vitest";
import Fastify from "fastify";
import { createCanonicalId, nowInstant } from "@masanawa/contracts";
import type { AgentDirectoryService, MobileAgentDirectoryEntry } from "../agent_directory.js";
import type { AgentConversationService } from "../agent_conversation_contract.js";
import type { AgentShellService } from "../agent_shell_contract.js";
import { createAssistantWorkspaceService } from "./service.js";
import { registerAssistantWorkspaceRoutes } from "./routes.js";

function fixture(variant?:
  | "conflicting_voice"
  | "unsupported_default"
  | "voice_named_alias"
  | "reassigned_after_history"
  | "selected_after_history"
  | "revoked_after_history"
  | "version_changed_after_history") {
  const gwani = createCanonicalId("character");
  const gwana = createCanonicalId("character");
  const replacementGwana = createCanonicalId("character");
  const versions = new Map<string, string>([
    [gwani, createCanonicalId("character-version")],
    [gwana, createCanonicalId("character-version")],
    [replacementGwana, createCanonicalId("character-version")],
  ]);
  const changedVersion = createCanonicalId("character-version");
  let historyRead = false;
  const sessionId = createCanonicalId("character-session");
  const runId = createCanonicalId("agent-run");
  const requestId = createCanonicalId("request");
  const approved = new Map<string, "gwani" | "gwana">([
    ["Bearer A", "gwani"],
    ["Bearer B", "gwani"],
  ]);
  const captured: string[] = [];
  function principal(header: string | undefined) {
    if (header !== "Bearer A" && header !== "Bearer B") {
      const error = new Error("Unauthorized") as Error & { statusCode: number };
      error.statusCode = 401;
      throw error;
    }
    return header;
  }
  const entry = (
    id: string,
    name: string,
    voiceName: string,
    preferred: boolean,
  ): MobileAgentDirectoryEntry => ({
    characterId: id,
    characterVersionId: versions.get(id) ?? createCanonicalId("character-version"),
    displayName: name,
    roleLabel: "Support",
    about: "Official assistant",
    greeting: null,
    presence: "unknown",
    activeWorkCount: 0,
    supportAgent: true,
    defaultPlatformAgent: preferred,
    voiceProvider: "gemini",
    voiceName,
  });
  const directory: AgentDirectoryService = {
    async list({ authorizationHeader }) {
      const header = principal(authorizationHeader);
      const agents = [
        entry(gwani, "Gwani", "Bodi", approved.get(header) === "gwani"),
        entry(gwana, "Gwana", "Sulafat", approved.get(header) === "gwana"),
      ];
      if (variant === "conflicting_voice") {
        agents[0] = { ...agents[0]!, voiceName: "Sulafat" };
      } else if (variant === "unsupported_default") {
        agents.push(entry(createCanonicalId("character"), "Another support", "Other", true));
      } else if (variant === "voice_named_alias") {
        agents[0] = { ...agents[0]!, displayName: "Public support" };
      } else if (historyRead && variant === "reassigned_after_history") {
        agents[1] = { ...agents[1]!, characterId: replacementGwana,
          characterVersionId: versions.get(replacementGwana)! };
      } else if (historyRead && variant === "selected_after_history") {
        agents[0] = { ...agents[0]!, defaultPlatformAgent: false };
        agents[1] = { ...agents[1]!, defaultPlatformAgent: true };
      } else if (historyRead && variant === "revoked_after_history") {
        agents[1] = { ...agents[1]!, supportAgent: false };
      } else if (historyRead && variant === "version_changed_after_history") {
        agents[1] = { ...agents[1]!, characterVersionId: changedVersion };
      }
      return agents;
    },
    async setDefaultPlatformAgent({ authorizationHeader, characterId }) {
      const header = principal(authorizationHeader);
      if (characterId !== gwani && characterId !== gwana) {
        throw new Error("Invalid Character");
      }
      approved.set(header, characterId === gwani ? "gwani" : "gwana");
      return { characterId };
    },
  };
  const shell = {
    async history({ authorizationHeader, characterId }: {
      authorizationHeader: string | undefined;
      characterId: string;
    }) {
      principal(authorizationHeader);
      captured.push("history:" + characterId);
      historyRead = true;
      return [{
        key: characterId === gwani ? "g-1" : "a-1",
        direction: "assistant" as const,
        requestId,
        text: characterId === gwani ? "Gwani answer" : "Gwana answer",
        parts: [],
        agentRunId: runId,
        createdAt: nowInstant(),
      }];
    },
    async turnStatus({ authorizationHeader, characterId }: {
      authorizationHeader: string | undefined;
      characterId: string;
    }) {
      principal(authorizationHeader);
      captured.push("status:" + characterId);
      return { state: "completed" as const, reply: "Acknowledged" };
    },
  } as AgentShellService;

  const conversations = {
    async open({ authorizationHeader, characterId }: {
      authorizationHeader: string | undefined;
      characterId: string;
    }) {
      principal(authorizationHeader);
      captured.push("open:" + characterId);
      return { characterSessionId: sessionId };
    },
    async turn(input: {
      authorizationHeader: string | undefined;
      characterId: string;
      characterSessionId: string;
      requestId: string;
      text: string;
    }) {
      principal(input.authorizationHeader);
      expect(input.characterSessionId).toBe(sessionId);
      expect(input.requestId).toBe(requestId);
      captured.push("turn:" + input.characterId + ":" + input.text);
      return { reply: "Gwana confirmed", agentRunId: runId, parts: [] };
    },
  } as AgentConversationService;
  const service = createAssistantWorkspaceService({
    directory, shell, conversations,
  });
  return {
    service, captured, gwani, gwana, sessionId, requestId,
    get preferredA() { return approved.get("Bearer A"); },
    get preferredB() { return approved.get("Bearer B"); },
  };
}

describe("C07 isolated authorized Assistant workspace", () => {
  it("reads each scoped server history with attributable roles", async () => {
    const f = fixture();
    const snapshot = await f.service.snapshot({
      authorizationHeader: "Bearer A",
    });
    expect(snapshot.activeRole).toBe("gwani");
    expect(snapshot.roles).toHaveLength(2);
    expect(snapshot.messages).toHaveLength(2);
    expect(snapshot.messages.map(x => x.role).sort()).toEqual(["gwana", "gwani"]);
    expect(snapshot.messages.map(x => x.characterId).sort()).toEqual(
      [f.gwana, f.gwani].sort(),
    );
    expect(f.captured).toEqual([
      "history:" + f.gwani,
      "history:" + f.gwana,
    ]);
  });

  it.each([
    "reassigned_after_history",
    "selected_after_history",
    "version_changed_after_history",
  ] as const)("rejects stale %s snapshots after both authorized reads", async variant => {
    const f = fixture(variant);
    await expect(f.service.snapshot({ authorizationHeader: "Bearer A" }))
      .rejects.toMatchObject({ code: "assistant.workspace_changed" });
    expect(f.captured).toEqual([
      "history:" + f.gwani,
      "history:" + f.gwana,
    ]);
  });

  it("fails closed on a revoked assistant after history was requested", async () => {
    const f = fixture("revoked_after_history");
    await expect(f.service.snapshot({ authorizationHeader: "Bearer A" }))
      .rejects.toMatchObject({ code: "assistant.support_unavailable" });
  });

  it("switches only this authenticated account and rejects stale persona turn", async () => {
    const f = fixture();
    await f.service.select({
      authorizationHeader: "Bearer A", role: "gwana",
    });
    expect(f.preferredA).toBe("gwana");
    expect(f.preferredB).toBe("gwani");
    await expect(f.service.open({
      authorizationHeader: "Bearer A", role: "gwani",
    })).rejects.toThrow(/selected assistant/i);
    const session = await f.service.open({
      authorizationHeader: "Bearer A", role: "gwana",
    });
    expect(session.characterSessionId).toBe(f.sessionId);
    expect(f.captured).toContain("open:" + f.gwana);
    await f.service.turn({
      authorizationHeader: "Bearer A", role: "gwana",
      characterSessionId: f.sessionId,
      requestId: f.requestId,
      correlationId: createCanonicalId("correlation"),
      text: "  Hello  ",
    });
    expect(f.captured).toContain("turn:" + f.gwana + ":Hello");
    const recovered = await f.service.turnStatus({
      authorizationHeader: "Bearer A", role: "gwani",
      requestId: f.requestId,
    });
    expect(recovered.state).toBe("completed");
    expect(f.captured).toContain("status:" + f.gwani);
  });


  it("rejects Gwani name with Gwana voice instead of silently misattributing private history", async () => {
    const f = fixture("conflicting_voice");
    await expect(f.service.snapshot({ authorizationHeader: "Bearer A" }))
      .rejects.toMatchObject({ code: "assistant.support_identity_conflict" });
    await expect(f.service.select({ authorizationHeader: "Bearer A", role: "gwana" }))
      .rejects.toMatchObject({ code: "assistant.support_identity_conflict" });
    await expect(f.service.turn({
      authorizationHeader: "Bearer A",
      role: "gwani",
      characterSessionId: f.sessionId,
      requestId: f.requestId,
      correlationId: createCanonicalId("correlation"),
      text: "Do not route my private turn",
    })).rejects.toMatchObject({ code: "assistant.support_identity_conflict" });
    expect(f.preferredA).toBe("gwani");
    expect(f.captured).toEqual([]);
  });

  it("refuses to fall back to Gwani when an unknown support persona is selected", async () => {
    const f = fixture("unsupported_default");
    await expect(f.service.open({
      authorizationHeader: "Bearer A", role: "gwani",
    })).rejects.toMatchObject({ code: "assistant.selected_support_unrecognized" });
    await expect(f.service.turnStatus({
      authorizationHeader: "Bearer A",
      role: "gwani",
      requestId: f.requestId,
    })).rejects.toMatchObject({ code: "assistant.selected_support_unrecognized" });
    expect(f.captured).toEqual([]);
  });

  it("continues to resolve approved voice-based aliases without requiring a fixed display label", async () => {
    const f = fixture("voice_named_alias");
    const snapshot = await f.service.snapshot({ authorizationHeader: "Bearer A" });
    expect(snapshot.activeRole).toBe("gwani");
    expect(snapshot.roles.find(r => r.role === "gwani")?.displayName).toBe("Public support");
    expect(snapshot.roles.find(r => r.role === "gwani")?.characterId).toBe(f.gwani);
  });

  it("never grants a session through an unrecognized or missing principal", async () => {
    const f = fixture();
    await expect(f.service.snapshot({
      authorizationHeader: undefined,
    })).rejects.toThrow("Unauthorized");
    await expect(f.service.select({
      authorizationHeader: "Bearer forged", role: "gwani",
    })).rejects.toThrow("Unauthorized");
    expect(f.captured).toEqual([]);
  });

  it("routes authenticated calls and validates role, size, canonical id", async () => {
    const f = fixture();
    const app = Fastify();
    registerAssistantWorkspaceRoutes(app, f.service);
    try {
      const noAuth = await app.inject({
        method: "GET", url: "/assistant/workspace",
      });
      expect(noAuth.statusCode).toBe(401);
      const visible = await app.inject({
        method: "GET", url: "/assistant/workspace?limit=50",
        headers: { authorization: "Bearer A" },
      });
      expect(visible.statusCode).toBe(200);
      expect(visible.json().roles).toHaveLength(2);
      const badPage = await app.inject({
        method: "GET", url: "/assistant/workspace?limit=999999",
        headers: { authorization: "Bearer A" },
      });
      expect(badPage.statusCode).toBe(400);
      const badRole = await app.inject({
        method: "PUT", url: "/assistant/workspace/persona",
        headers: { authorization: "Bearer A" },
        payload: { role: "expert" },
      });
      expect(badRole.statusCode).toBe(400);
      const switched = await app.inject({
        method: "PUT", url: "/assistant/workspace/persona",
        headers: { authorization: "Bearer A" },
        payload: { role: "gwana" },
      });
      expect(switched.statusCode).toBe(200);
      expect(switched.json()).toEqual({ activeRole: "gwana" });
      const opened = await app.inject({
        method: "POST", url: "/assistant/workspace/sessions",
        headers: { authorization: "Bearer A" },
        payload: { role: "gwana" },
      });
      expect(opened.statusCode).toBe(200);
      const sent = await app.inject({
        method: "POST",
        url: "/assistant/workspace/sessions/" + f.sessionId + "/turn",
        headers: { authorization: "Bearer A" },
        payload: { role: "gwana", requestId: f.requestId, text: "Hi" },
      });
      expect(sent.statusCode).toBe(200);
      expect(sent.json().reply).toBe("Gwana confirmed");
      const status = await app.inject({
        method: "GET",
        url: "/assistant/workspace/turns/" + f.requestId + "/status?role=gwani",
        headers: { authorization: "Bearer A" },
      });
      expect(status.statusCode).toBe(200);
      expect(status.json().state).toBe("completed");
    } finally {
      await app.close();
    }
  });
});
