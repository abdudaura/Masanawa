import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  nowInstant,
  toInstant,
} from "@masanawa/contracts";
import {
  createAuthorityContext,
} from "@masanawa/security";
import type {
  AgentRunRepository,
  CharacterSession,
  CharacterSessionRepository,
  CharacterSessionScope,
} from "@masanawa/agents";
import {
  emptyCharacterSessionBindings,
} from "@masanawa/agents";
import {
  createAgentConversationService,
} from "./agent_conversation.js";
import type {
  AgentConversationAdmission,
  AgentConversationAuthorizer,
  AlphaConversationExecutor,
} from "./agent_conversation_contract.js";

function fixture() {
  const scope: CharacterSessionScope = {
    tenantId: createCanonicalId("tenant"),
    userId: createCanonicalId("user"),
    characterId: createCanonicalId("character"),
    relationshipId: createCanonicalId("relationship"),
  };
  const characterVersionId = createCanonicalId("character-version");
  const at = nowInstant();
  const authority = createAuthorityContext({
    tenantId: scope.tenantId,
    principal: { kind: "user", userId: scope.userId },
    scopes: [],
    capabilities: [
      "agents.session.create",
      "agents.session.read",
      "agents.session.close",
      "agents.run.create",
      "agents.run.read",
      "agents.run.finish",
    ],
    resourceScope: { relationshipIds: [scope.relationshipId] },
    policyRevision: "alpha-1",
    approvalIds: [],
    delegationChain: [],
    requestId: createCanonicalId("request"),
    correlationId: createCanonicalId("correlation"),
    issuedAt: at,
  });
  const admission: AgentConversationAdmission = {
    scope,
    characterVersionId,
    bindings: emptyCharacterSessionBindings,
    authority,
    presentation: {
      displayName: "Amina",
      roleLabel: "Research Assistant",
      about: "Helps with practical research.",
    },
  };
  return { scope, characterVersionId, authority, admission, at };
}

function sessionFor(
  f: ReturnType<typeof fixture>,
  characterSessionId = createCanonicalId("character-session"),
): CharacterSession {
  return {
    schemaVersion: 1,
    ...f.scope,
    characterSessionId,
    characterVersionId: f.characterVersionId,
    bindings: emptyCharacterSessionBindings,
    state: "active",
    revision: 1,
    createdAt: f.at,
    updatedAt: f.at,
    expiresAt: toInstant(new Date(Date.now() + 60_000)),
    closedAt: null,
    closeReason: null,
    successorSessionId: null,
  };
}

describe("Alpha conversation service", () => {
  it("uses canonical session/run custody for text and media turns", async () => {
    const f = fixture();
    let session = sessionFor(f);
    const events: string[] = [];

    const sessions: CharacterSessionRepository = {
      async create(input) {
        session = sessionFor(f, input.characterSessionId);
        events.push("session:create");
        return session;
      },
      async read() {
        events.push("session:read");
        return session;
      },
      async updateBindings() {
        throw new Error("not used");
      },
      async close() {
        events.push("session:close");
        session = {
          ...session,
          state: "closed",
          revision: 2,
          updatedAt: f.at,
          closedAt: f.at,
          closeReason: "ended",
        };
        return session;
      },
      async reset() {
        throw new Error("not used");
      },
    };

    const runs: AgentRunRepository = {
      async create(input) {
        events.push(`run:create:${input.agentRunId}`);
        return {} as never;
      },
      async read() {
        throw new Error("not used");
      },
      async finish(input) {
        events.push(`run:finish:${input.outcome.state}`);
        return {} as never;
      },
    };

    const authorizer: AgentConversationAuthorizer = {
      async authorize(input) {
        expect(input.characterId).toBe(f.scope.characterId);
        return f.admission;
      },
    };

    const executor: AlphaConversationExecutor = {
      async reply(input) {
        expect(input.displayName).toBe("Amina");
        expect(input.roleLabel).toBe("Research Assistant");
        return `Text: ${input.text}`;
      },
      async replyMedia(input) {
        expect(input.mimeType).toBe("audio/mp4");
        expect(input.dataBase64).toBe("YWJj");
        return "I heard the voice note.";
      },
    };

    const service = createAgentConversationService({
      sessions,
      runs,
      authorizer,
      executor,
      sessionDurationMs: 60_000,
    });

    const opened = await service.open({
      authorizationHeader: "Bearer alpha",
      characterId: f.scope.characterId,
    });

    const text = await service.turn({
      authorizationHeader: "Bearer alpha",
      characterSessionId: opened.characterSessionId,
      characterId: f.scope.characterId,
      text: "hello",
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });
    expect(text.reply).toBe("Text: hello");
    expect(text.agentRunId).toMatch(/^agent-run_/u);

    const media = await service.mediaTurn({
      authorizationHeader: "Bearer alpha",
      characterSessionId: opened.characterSessionId,
      characterId: f.scope.characterId,
      caption: "",
      mimeType: "audio/mp4",
      dataBase64: "YWJj",
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });
    expect(media.reply).toBe("I heard the voice note.");

    await service.close({
      authorizationHeader: "Bearer alpha",
      characterSessionId: opened.characterSessionId,
      characterId: f.scope.characterId,
    });

    expect(events.filter((event) => event.startsWith("run:create"))).toHaveLength(2);
    expect(events.filter((event) => event === "run:finish:completed")).toHaveLength(2);
    expect(events).toContain("session:close");
  });

  it("records a failed terminal run when inference fails", async () => {
    const f = fixture();
    const session = sessionFor(f);
    const outcomes: string[] = [];

    const sessions: CharacterSessionRepository = {
      async create() {
        return session;
      },
      async read() {
        return session;
      },
      async updateBindings() {
        throw new Error("not used");
      },
      async close() {
        return session;
      },
      async reset() {
        throw new Error("not used");
      },
    };
    const runs: AgentRunRepository = {
      async create() {
        return {} as never;
      },
      async read() {
        throw new Error("not used");
      },
      async finish(input) {
        outcomes.push(
          input.outcome.state === "failed"
            ? input.outcome.failureCode
            : input.outcome.state,
        );
        return {} as never;
      },
    };
    const authorizer: AgentConversationAuthorizer = {
      async authorize() {
        return f.admission;
      },
    };
    const executor: AlphaConversationExecutor = {
      async reply() {
        throw new Error("provider down");
      },
      async replyMedia() {
        throw new Error("provider down");
      },
    };
    const service = createAgentConversationService({
      sessions,
      runs,
      authorizer,
      executor,
      sessionDurationMs: 60_000,
    });

    await expect(
      service.turn({
        authorizationHeader: "Bearer alpha",
        characterSessionId: session.characterSessionId,
        characterId: f.scope.characterId,
        text: "hello",
        requestId: createCanonicalId("request"),
        correlationId: createCanonicalId("correlation"),
      }),
    ).rejects.toThrow("provider down");

    expect(outcomes).toEqual(["alpha.executor_failed"]);
  });
});
