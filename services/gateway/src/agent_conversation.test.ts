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
  AgentStrategy,
  CharacterSession,
  CharacterSessionRepository,
  CharacterSessionScope,
} from "@masanawa/agents";
import {
  emptyCharacterSessionBindings,
  AgentInferenceError,
} from "@masanawa/agents";
import { createAlphaInferenceStrategy } from "./alpha_strategy.js";
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
  it("replaces inference providers while retaining exact session/version/run custody", async () => {
    const f = fixture();
    const session = sessionFor(f);
    const admittedRuns: Parameters<AgentRunRepository["create"]>[0][] = [];
    const finishes: Parameters<AgentRunRepository["finish"]>[0][] = [];
    const sessions: CharacterSessionRepository = {
      async create() { return session; },
      async read() { return session; },
      async updateBindings() { throw new Error("not used"); },
      async close() { return session; },
      async reset() { throw new Error("not used"); },
    };
    const runs: AgentRunRepository = {
      async create(input) { admittedRuns.push(input); return { ...input, characterVersionId: input.characterVersionId } as never; },
      async read() { throw new Error("not used"); },
      async finish(input) { finishes.push(input); return {} as never; },
    };
    // Current admission may have a newer published version; existing continuity
    // must keep the exact version from its CharacterSession.
    const admission = { ...f.admission, characterVersionId: createCanonicalId("character-version") };
    for (const answer of ["Provider A", "Provider B"]) {
      const strategy = createAlphaInferenceStrategy({
        inference: {
          async generate(input) {
            expect(Object.keys(input).sort()).toEqual(["input", "systemInstructions"]);
            expect(input.input.kind).toBe("text");
            return { text: answer };
          },
        },
      });
      const service = createAgentConversationService({
        sessions, runs, strategy,
        contextCompiler: { async compile(input) {
          expect(input.session).toBe(session);
          expect(input.run.characterVersionId).toBe(session.characterVersionId);
          expect(input.authority).toBe(admission.authority);
          return { agentRunId: input.run.agentRunId, characterSessionId: session.characterSessionId,
            characterVersionId: session.characterVersionId, systemInstructions: ["Canonical Amina"],
            evidence: [], usedCharacters: 15, omittedEvidenceItems: 0 };
        } },
        authorizer: { async authorize() { return admission; } },
        sessionDurationMs: 60_000,
      });
      const result = await service.turn({
        authorizationHeader: "Bearer alpha",
        characterId: f.scope.characterId,
        characterSessionId: session.characterSessionId,
        text: "Hello",
        requestId: createCanonicalId("request"),
        correlationId: createCanonicalId("correlation"),
      });
      expect(result.reply).toBe(answer);
      expect(result.agentRunId).toBe(admittedRuns.at(-1)?.agentRunId);
    }
    expect(new Set(admittedRuns.map((run) => run.agentRunId)).size).toBe(2);
    for (const run of admittedRuns) {
      expect(run.characterSessionId).toBe(session.characterSessionId);
      expect(run.characterVersionId).toBe(session.characterVersionId);
      expect(run.scope).toEqual(f.scope);
    }
    expect(finishes.map((run) => run.outcome.state)).toEqual(["completed", "completed"]);
  });

  it.each(["text", "media"] as const)("persists safe inference failure codes for %s turns", async (kind) => {
    const f = fixture();
    const session = sessionFor(f);
    const outcomes: Parameters<AgentRunRepository["finish"]>[0][] = [];
    const service = createAgentConversationService({
      sessions: {
        async create() { return session; }, async read() { return session; },
        async close() { return session; },
        async reset() { throw new Error("not used"); },
        async updateBindings() { throw new Error("not used"); },
      },
      runs: {
        async create() { return {} as never; },
        async read() { throw new Error("not used"); },
        async finish(input) { outcomes.push(input); return {} as never; },
      },
      authorizer: { async authorize() { return f.admission; } },
      strategy: createAlphaInferenceStrategy({
        inference: { async generate() { throw new AgentInferenceError("inference.rate_limited"); } },
      }),
      sessionDurationMs: 60_000,
    });
    const input = {
      authorizationHeader: "Bearer alpha", characterId: f.scope.characterId,
      characterSessionId: session.characterSessionId,
      requestId: createCanonicalId("request"), correlationId: createCanonicalId("correlation"),
    };
    const pending = kind === "text" ? service.turn({ ...input, text: "Hello" }) :
      service.mediaTurn({ ...input, caption: "", mimeType: "audio/mp4", dataBase64: "YWJj" });
    await expect(pending).rejects.toMatchObject({ code: "inference.rate_limited" });
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.outcome).toEqual({ state: "failed", failureCode: "inference.rate_limited" });
  });
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
        expect(input.input.mimeType).toBe("audio/mp4");
        expect(input.input.dataBase64).toBe("YWJj");
        return { reply: "I heard the voice note.", parts: [] };
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
});
