import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCanonicalId, toInstant } from "@masanawa/contracts";
import type {
  TeachingProgress,
  TeachingProgressRepository,
} from "@masanawa/skills";
import type {
  AgentConversationAuthorizer,
  AgentConversationService,
} from "../agent_conversation_contract.js";
import { registerOperatorLearningRoutes } from "./routes.js";

const apps: ReturnType<typeof Fastify>[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

const scope = {
  tenantId: createCanonicalId("tenant"),
  userId: createCanonicalId("user"),
  characterId: createCanonicalId("character"),
  relationshipId: createCanonicalId("relationship"),
};
const characterSessionId = createCanonicalId("character-session");
const stamp = toInstant("2026-10-09T00:00:00Z");

function fixture() {
  const progress: TeachingProgress = {
    ...scope,
    topic: "Algebra",
    goal: "Solve one-step equations",
    level: "beginner",
    checkpoint: "x + 2 = 5",
    nextStep: "Isolate x",
    masteryNotes: ["Understands addition"],
    updatedAt: stamp,
  };
  const read = vi.fn(async (): Promise<TeachingProgress | null> => progress);
  const upsert = vi.fn(async (_row: TeachingProgress) => undefined);
  const repository = { read, upsert } satisfies TeachingProgressRepository;
  const authorize = vi.fn(async (input: { authorizationHeader?: string; characterId: string }) => {
    if (input.authorizationHeader !== "Bearer valid-user") {
      const err = new Error("Not authenticated") as Error & { statusCode: number };
      err.statusCode = 401;
      throw err;
    }
    if (input.characterId !== scope.characterId) {
      const err = new Error("Not found") as Error & { statusCode: number };
      err.statusCode = 404;
      throw err;
    }
    return { scope };
  });
  const authorizer = { authorize } as unknown as AgentConversationAuthorizer;
  const turn = vi.fn(async (_input: Parameters<AgentConversationService["turn"]>[0]) => ({ reply: "Practice: x=3.", agentRunId: "run", parts: [] }));
  const conversation = { turn } as unknown as AgentConversationService;
  const app = Fastify();
  apps.push(app);
  registerOperatorLearningRoutes(app, { authorizer, conversation, progress: repository });
  return { app, read, upsert, turn, authorize };
}

describe("U06 authenticated Study Gateway route composition seam", () => {
  it("admits the first lesson through the authenticated API without inventing progress", async () => {
    const x = fixture();
    x.read.mockResolvedValue(null);
    const response = await x.app.inject({
      method: "POST", url: "/agent/learning/actions",
      headers: { authorization: "Bearer valid-user" },
      payload: {
        characterId: scope.characterId, characterSessionId,
        requestId: createCanonicalId("request"),
        action: "continue", expectedUpdatedAt: null,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ state: "accepted", latest: { state: "empty", progress: null } });
    expect(x.turn).toHaveBeenCalledTimes(1);
    expect(x.upsert).not.toHaveBeenCalled();
  });

  it("never exposes a checkpoint belonging to another relationship", async () => {
    const x = fixture();
    const saved = await x.read();
    x.read.mockResolvedValue({ ...saved!, relationshipId: createCanonicalId("relationship") });
    const response = await x.app.inject({
      method: "GET", url: "/agent/learning/progress?characterId=" + scope.characterId,
      headers: { authorization: "Bearer valid-user" },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "learning.forbidden" });
    expect(x.turn).not.toHaveBeenCalled();
  });
  it("reads persisted progress only after verified Character admission", async () => {
    const x = fixture();
    const denied = await x.app.inject({
      method: "GET",
      url: "/agent/learning/progress?characterId=" + scope.characterId,
    });
    expect(denied.statusCode).toBe(401);
    expect(x.read).not.toHaveBeenCalled();

    const allowed = await x.app.inject({
      method: "GET",
      url: "/agent/learning/progress?characterId=" + scope.characterId,
      headers: { authorization: "Bearer valid-user" },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().progress.topic).toBe("Algebra");
    expect(allowed.headers["cache-control"]).toBe("no-store");
    expect(x.read).toHaveBeenCalledWith(scope);
  });

  it("executes only one canonical Study turn on an authenticated session with stable requestId", async () => {
    const x = fixture();
    const requestId = createCanonicalId("request");
    const response = await x.app.inject({
      method: "POST",
      url: "/agent/learning/actions",
      headers: { authorization: "Bearer valid-user" },
      payload: {
        characterId: scope.characterId,
        characterSessionId,
        requestId,
        action: "practice",
        expectedUpdatedAt: stamp,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().state).toBe("accepted");
    expect(response.json().latest.progress.checkpoint).toBe("x + 2 = 5");
    expect(x.upsert).not.toHaveBeenCalled(); // canonical teacher owns persistence
    expect(x.turn).toHaveBeenCalledTimes(1);
    const turn = x.turn.mock.calls[0]![0];
    expect(turn.requestId).toBe(requestId);
    expect(turn.characterSessionId).toBe(characterSessionId);
    expect(turn.text).toContain("<masanawa_study>");
  });

  it("fences stale checkpoints and unauthorized or malformed state before dispatch", async () => {
    const x = fixture();
    const payload = {
      characterId: scope.characterId,
      characterSessionId,
      requestId: createCanonicalId("request"),
      action: "continue",
      expectedUpdatedAt: null,
    };
    const conflict = await x.app.inject({
      method: "POST", url: "/agent/learning/actions",
      headers: { authorization: "Bearer valid-user" }, payload,
    });
    expect(conflict.statusCode).toBe(409);
    const malformed = await x.app.inject({
      method: "POST", url: "/agent/learning/actions",
      headers: { authorization: "Bearer valid-user" },
      payload: { ...payload, expectedUpdatedAt: stamp, tenantId: "forged" },
    });
    expect(malformed.statusCode).toBe(400);
    const denied = await x.app.inject({
      method: "POST", url: "/agent/learning/actions", payload,
    });
    expect(denied.statusCode).toBe(401);
    expect(x.turn).not.toHaveBeenCalled();
  });

  it("never reports success after uncertain canonical turn failure", async () => {
    const x = fixture();
    x.turn.mockRejectedValueOnce(new Error("lost reply after commit"));
    const response = await x.app.inject({
      method: "POST",
      url: "/agent/learning/actions",
      headers: { authorization: "Bearer valid-user" },
      payload: {
        characterId: scope.characterId,
        characterSessionId,
        requestId: createCanonicalId("request"),
        action: "answer",
        answer: "x=3",
        expectedUpdatedAt: stamp,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().state).toBe("uncertain");
    expect(x.turn).toHaveBeenCalledTimes(1);
  });
});
