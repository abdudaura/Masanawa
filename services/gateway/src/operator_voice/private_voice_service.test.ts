import { describe, expect, it, vi } from "vitest";
import Fastify from "fastify";
import { createCanonicalId } from "@masanawa/contracts";
import type { AgentConversationAdmission, AgentConversationAuthorizer } from "../agent_conversation_contract.js";
import type { CharacterSessionRepository } from "@masanawa/agents";
import type { AgentShellService, LiveVoiceTokenService } from "../agent_shell_contract.js";
import { createPrivateOperatorVoiceService } from "./private_voice_service.js";
import { registerPrivateOperatorVoiceRoutes } from "./private_voice_routes.js";

function fixture() {
  const characterId = createCanonicalId("character");
  const characterSessionId = createCanonicalId("character-session");
  const requestId = createCanonicalId("request");
  const admissionId = createCanonicalId("request");
  const scope = {
    tenantId: createCanonicalId("tenant"),
    userId: createCanonicalId("user"),
    relationshipId: createCanonicalId("relationship"),
    characterId,
  };
  const admission = {
    scope,
    authority: {},
  } as AgentConversationAdmission;
  const authorize = vi.fn(async () => admission);
  const read = vi.fn(async () => ({ state: "active" }));
  const mint = vi.fn(async () => ({
    token: "private-ephemeral-provider-token",
    websocketUrl: "wss://generativelanguage.googleapis.com/ws/",
    model: "gemini-live",
    voiceName: "Bodi",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  }));
  const turnStatus = vi.fn(async () => ({ state: "pending" as const }));
  const service = createPrivateOperatorVoiceService({
    authorizer: { authorize } as AgentConversationAuthorizer,
    sessions: { read } as unknown as CharacterSessionRepository,
    tokens: { mint } as LiveVoiceTokenService,
    shell: { turnStatus } as unknown as AgentShellService,
  });
  const body = { characterId, characterSessionId, admissionId };
  return {
    service, body, requestId, authorize, read, mint, turnStatus,
    authorizationHeader: "Bearer user-token",
  };
}

describe("U09 exact-session private voice admission", () => {
  it("authorizes account/character and verifies active session before minting", async () => {
    const f = fixture();
    const grant = await f.service.start({
      ...f.body,
      authorizationHeader: f.authorizationHeader,
    });
    expect(grant.voiceName).toBe("Bodi");
    expect(f.authorize).toHaveBeenCalledWith({
      authorizationHeader: f.authorizationHeader,
      characterId: f.body.characterId,
    });
    expect(f.read).toHaveBeenCalledWith(expect.objectContaining({
      scope: expect.objectContaining({ characterId: f.body.characterId }),
      characterSessionId: f.body.characterSessionId,
    }));
    expect(f.mint).toHaveBeenCalledOnce();
    expect(f.mint).toHaveBeenCalledWith({
      authorizationHeader: f.authorizationHeader,
      characterId: f.body.characterId,
      admissionId: f.body.admissionId,
      purpose: "conversation",
    });
  });

  it("rejects closed, expired or unauthorized sessions without issuing token", async () => {
    const f = fixture();
    f.read.mockResolvedValueOnce({ state: "closed" });
    await expect(f.service.start({ ...f.body,
      authorizationHeader: f.authorizationHeader,
    })).rejects.toThrow();
    expect(f.mint).not.toHaveBeenCalled();
    f.authorize.mockRejectedValueOnce(new Error("account revoked"));
    await expect(f.service.start({ ...f.body,
      authorizationHeader: f.authorizationHeader,
    })).rejects.toThrow("account revoked");
    expect(f.mint).not.toHaveBeenCalled();
  });

  it("forbids character scope substitution and missing voice admission", async () => {
    const f = fixture();
    f.authorize.mockResolvedValueOnce({
      scope: { characterId: createCanonicalId("character") },
      authority: {},
    } as AgentConversationAdmission);
    await expect(f.service.start({ ...f.body,
      authorizationHeader: f.authorizationHeader,
    })).rejects.toThrow();
    await expect(f.service.start({
      ...f.body, admissionId: " ",
      authorizationHeader: f.authorizationHeader,
    })).rejects.toThrow("admission");
    expect(f.mint).not.toHaveBeenCalled();
  });

  it("status readback is canonical, authorized and cannot dispatch a task", async () => {
    const f = fixture();
    const status = await f.service.turnStatus({
      characterId: f.body.characterId,
      characterSessionId: f.body.characterSessionId,
      requestId: f.requestId,
      authorizationHeader: f.authorizationHeader,
    });
    expect(status.state).toBe("pending");
    expect(f.turnStatus).toHaveBeenCalledWith({
      characterId: f.body.characterId,
      requestId: f.requestId,
      authorizationHeader: f.authorizationHeader,
    });
    expect(f.mint).not.toHaveBeenCalled();
    await expect(f.service.turnStatus({
      characterId: f.body.characterId,
      characterSessionId: f.body.characterSessionId,
      requestId: "not-canonical",
      authorizationHeader: f.authorizationHeader,
    })).rejects.toThrow();
  });

  it("isolated Fastify routes reject actor injection without contacting authority", async () => {
    const f = fixture();
    const app = Fastify();
    registerPrivateOperatorVoiceRoutes(app, f.service);
    try {
      const result = await app.inject({
        method: "POST",
        url: "/agent/operator/voice/grant",
        headers: { authorization: f.authorizationHeader },
        payload: { ...f.body, userId: "forged-account" },
      });
      expect(result.statusCode).toBe(400);
      expect(f.authorize).not.toHaveBeenCalled();
      expect(f.mint).not.toHaveBeenCalled();
      const good = await app.inject({
        method: "POST",
        url: "/agent/operator/voice/grant",
        headers: { authorization: f.authorizationHeader },
        payload: f.body,
      });
      expect(good.statusCode).toBe(200);
      expect(good.headers["cache-control"]).toBe("no-store");
      expect(f.mint).toHaveBeenCalledOnce();
    } finally {
      await app.close();
    }
  });
});
