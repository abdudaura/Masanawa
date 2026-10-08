import { describe, expect, it, vi } from "vitest";
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
  AgentStrategy,
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

    const strategy: AgentStrategy = {
      async execute(input) {
        expect(input.presentation.displayName).toBe("Amina");
        expect(input.presentation.roleLabel).toBe("Research Assistant");
        if (input.input.kind === "text") {
          return { reply: `Text: ${input.input.text}`, parts: [] };
        }
        if (input.input.kind === "media") {
          expect(input.input.mimeType).toBe("audio/mp4");
          expect(input.input.dataBase64).toBe("YWJj");
          return { reply: "I heard the voice note.", parts: [] };
        }
        expect(input.input.media).toHaveLength(2);
        return { reply: "I reviewed both attachments.", parts: [] };
      },
    };

    const service = createAgentConversationService({
      sessions,
      runs,
      authorizer,
      strategy,
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

    const mediaSet = await service.mediaSetTurn({
      authorizationHeader: "Bearer alpha",
      characterSessionId: opened.characterSessionId,
      characterId: f.scope.characterId,
      caption: "Compare these",
      media: [
        { mimeType: "image/jpeg", dataBase64: "YWJj", name: "one.jpg" },
        { mimeType: "image/jpeg", dataBase64: "ZGVm", name: "two.jpg" },
      ],
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });
    expect(mediaSet.reply).toBe("I reviewed both attachments.");

    await service.close({
      authorizationHeader: "Bearer alpha",
      characterSessionId: opened.characterSessionId,
      characterId: f.scope.characterId,
    });

    expect(events.filter((event) => event.startsWith("run:create"))).toHaveLength(3);
    expect(events.filter((event) => event === "run:finish:completed")).toHaveLength(3);
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
    const strategy: AgentStrategy = {
      async execute() {
        throw new Error("provider down");
      },
    };
    const service = createAgentConversationService({
      sessions,
      runs,
      authorizer,
      strategy,
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

    expect(outcomes).toEqual(["alpha.strategy_failed"]);
  });

  it("rejects expired sessions before inference or financial side effects", async () => {
    const f = fixture();
    const expired = {
      ...sessionFor(f),
      expiresAt: toInstant(new Date(Date.now() - 1_000)),
    };
    const execute = vi.fn(async () => ({ reply: "should not run", parts: [] }));
    const sessions: CharacterSessionRepository = {
      async create() { return expired; },
      async read() { return expired; },
      async updateBindings() { throw new Error("not used"); },
      async close() { return expired; },
      async reset() { throw new Error("not used"); },
    };
    const runs: AgentRunRepository = {
      async create() { throw new Error("run must not start"); },
      async read() { throw new Error("not used"); },
      async finish() { throw new Error("run must not finish"); },
    };
    const authorizer: AgentConversationAuthorizer = {
      async authorize() { return f.admission; },
    };
    const service = createAgentConversationService({
      sessions,
      runs,
      authorizer,
      strategy: { execute },
      sessionDurationMs: 60_000,
    });

    await expect(
      service.turn({
        authorizationHeader: "Bearer alpha",
        characterSessionId: expired.characterSessionId,
        characterId: f.scope.characterId,
        text: "confirm",
        requestId: createCanonicalId("request"),
        correlationId: createCanonicalId("correlation"),
      }),
    ).rejects.toMatchObject({ code: "agents.session_closed" });
    expect(execute).not.toHaveBeenCalled();
  });


  it.each(["tenant", "user", "character", "relationship", "session"] as const)(
    "fails closed when a repository returns a %s-mismatched persona session",
    async (kind) => {
      const f = fixture();
      const original = sessionFor(f);
      const session: CharacterSession =
        kind === "tenant" ? { ...original, tenantId: createCanonicalId("tenant") } :
        kind === "user" ? { ...original, userId: createCanonicalId("user") } :
        kind === "character" ? { ...original, characterId: createCanonicalId("character") } :
        kind === "relationship" ? { ...original, relationshipId: createCanonicalId("relationship") } :
        { ...original, characterSessionId: createCanonicalId("character-session") };
      const execute = vi.fn(async () => ({ reply: "should not run", parts: [] }));
      const sessions: CharacterSessionRepository = {
        async create() { return session; },
        async read() { return session; },
        async updateBindings() { throw new Error("not used"); },
        async close() { throw new Error("must not close"); },
        async reset() { throw new Error("not used"); },
      };
      const runs: AgentRunRepository = {
        async create() { throw new Error("run must not start"); },
        async read() { throw new Error("not used"); },
        async finish() { throw new Error("run must not finish"); },
      };
      const service = createAgentConversationService({
        sessions, runs,
        authorizer: { async authorize() { return f.admission; } },
        strategy: { execute },
        sessionDurationMs: 60_000,
      });
      await expect(service.turn({
        authorizationHeader: "Bearer current",
        characterSessionId: original.characterSessionId,
        characterId: f.scope.characterId,
        text: "hello",
        requestId: createCanonicalId("request"),
        correlationId: createCanonicalId("correlation"),
      })).rejects.toMatchObject({ code: "agents.session_scope_mismatch" });
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it("blocks text, media and media-set turns after an authorized persona version changes", async () => {
    const f = fixture();
    const priorSession = {
      ...sessionFor(f),
      characterVersionId: createCanonicalId("character-version"),
    };
    const execute = vi.fn(async () => ({ reply: "should not run", parts: [] }));
    const sessions: CharacterSessionRepository = {
      async create() { return priorSession; },
      async read() { return priorSession; },
      async updateBindings() { throw new Error("not used"); },
      async close() { throw new Error("not used"); },
      async reset() { throw new Error("not used"); },
    };
    const runs: AgentRunRepository = {
      async create() { throw new Error("run must not start"); },
      async read() { throw new Error("not used"); },
      async finish() { throw new Error("run must not finish"); },
    };
    const service = createAgentConversationService({
      sessions, runs,
      authorizer: { async authorize() { return f.admission; } },
      strategy: { execute },
      sessionDurationMs: 60_000,
    });
    const common = {
      authorizationHeader: "Bearer current",
      characterSessionId: priorSession.characterSessionId,
      characterId: f.scope.characterId,
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    };
    const attempts = [
      () => service.turn({ ...common, text: "continue" }),
      () => service.mediaTurn({
        ...common, caption: "Please listen", mimeType: "audio/mp4", dataBase64: "YWJj",
      }),
      () => service.mediaSetTurn({
        ...common, caption: "Look at these", media: [
          { mimeType: "image/jpeg", dataBase64: "YWJj" },
          { mimeType: "image/jpeg", dataBase64: "ZGVm" },
        ],
      }),
    ];
    for (const attempt of attempts) {
      await expect(attempt()).rejects.toMatchObject({
        code: "agents.session_persona_changed",
        retryable: false,
      });
    }
    expect(execute).not.toHaveBeenCalled();
  });

  it("allows the rightful account to close an earlier persona version without generating a reply", async () => {
    const f = fixture();
    const previous = {
      ...sessionFor(f),
      characterVersionId: createCanonicalId("character-version"),
    };
    const closed = vi.fn(async () => previous);
    const sessions: CharacterSessionRepository = {
      async create() { return previous; },
      async read() { return previous; },
      async updateBindings() { throw new Error("not used"); },
      close: closed,
      async reset() { throw new Error("not used"); },
    };
    const runs: AgentRunRepository = {
      async create() { throw new Error("not used"); },
      async read() { throw new Error("not used"); },
      async finish() { throw new Error("not used"); },
    };
    const execute = vi.fn(async () => ({ reply: "should not run", parts: [] }));
    const service = createAgentConversationService({
      sessions, runs, strategy: { execute },
      authorizer: { async authorize() { return f.admission; } },
      sessionDurationMs: 60_000,
    });
    await service.close({
      authorizationHeader: "Bearer current",
      characterSessionId: previous.characterSessionId,
      characterId: f.scope.characterId,
    });
    expect(closed).toHaveBeenCalledTimes(1);
    expect(execute).not.toHaveBeenCalled();
  });

  it("rejects a mismatched created session before returning a usable conversation ID", async () => {
    const f = fixture();
    const sessions: CharacterSessionRepository = {
      async create(input) {
        return { ...sessionFor(f, input.characterSessionId), characterId: createCanonicalId("character") };
      },
      async read() { throw new Error("not used"); },
      async updateBindings() { throw new Error("not used"); },
      async close() { throw new Error("not used"); },
      async reset() { throw new Error("not used"); },
    };
    const runs: AgentRunRepository = {
      async create() { throw new Error("not used"); },
      async read() { throw new Error("not used"); },
      async finish() { throw new Error("not used"); },
    };
    const service = createAgentConversationService({
      sessions, runs,
      authorizer: { async authorize() { return f.admission; } },
      strategy: { async execute() { throw new Error("must not infer"); } },
      sessionDurationMs: 60_000,
    });
    await expect(service.open({
      authorizationHeader: "Bearer current",
      characterId: f.scope.characterId,
    })).rejects.toMatchObject({ code: "agents.session_scope_mismatch" });
  });

});

