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


  it("streams only settled billing text before slow audio and survives stream disconnect", async () => {
    const f = fixture();
    const session = sessionFor(f);
    const trace: string[] = [];
    let releaseAudio!: () => void;
    const audioPending = new Promise<void>((resolve) => { releaseAudio = resolve; });
    const sessions: CharacterSessionRepository = {
      async create() { return session; },
      async read() { return session; },
      async updateBindings() { throw new Error("not used"); },
      async close() { return session; },
      async reset() { throw new Error("not used"); },
    };
    const runs: AgentRunRepository = {
      async create() { return {} as never; },
      async read() { throw new Error("not used"); },
      async finish(input) {
        trace.push(`run:${input.outcome.state}`);
        return {} as never;
      },
    };
    const service = createAgentConversationService({
      sessions,
      runs,
      authorizer: { async authorize() { return f.admission; } },
      strategy: {
        async execute() {
          return {
            reply: 'model-private <masanawa_action>{"type":"billing.quote"}</masanawa_action>',
            parts: [],
          };
        },
      },
      billingAssistant: {
        systemInstructions: [],
        async beforeInference() { return null; },
        async afterInference() {
          return { reply: "Your quote is ready. Confirm before any purchase.", parts: [] };
        },
      },
      nativeAudio: {
        async render() {
          trace.push("audio:started");
          await audioPending;
          trace.push("audio:finished");
          return { dataBase64: "YQ==", mimeType: "audio/pcm", durationMs: 1 };
        },
      },
      sessionDurationMs: 60_000,
    });
    const request = {
      authorizationHeader: "Bearer alpha",
      characterSessionId: session.characterSessionId,
      characterId: f.scope.characterId,
      text: "buy airtime",
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    };
    const settledText = "Your quote is ready. Confirm before any purchase.";
    const pending = service.turn({
      ...request,
      onTextDelta: (delta) => { trace.push(`text:${delta}`); },
    });
    try {
      await vi.waitFor(() => expect(trace).toContain("audio:started"));
      expect(trace).toContain("run:completed");
      expect(trace.filter((entry) => entry.startsWith("text:"))).toEqual([
        `text:${settledText}`,
      ]);
      expect(trace.indexOf(`text:${settledText}`)).toBeLessThan(
        trace.indexOf("audio:started"),
      );
      expect(trace).not.toContain("audio:finished");
      expect(trace.join(" ")).not.toContain("model-private");
      expect(trace.join(" ")).not.toContain("masanawa_action");
    } finally {
      releaseAudio();
    }
    const response = await pending;
    expect(response.reply).toBe(settledText);

    // The streaming socket can close after the canonical turn is settled:
    // callback transport errors must not convert a completed bill into failure.
    const disconnected = await service.turn({
      ...request,
      requestId: createCanonicalId("request"),
      onTextDelta: () => { throw new Error("client went away"); },
    });
    expect(disconnected.reply).toBe(settledText);
    expect(trace.filter((entry) => entry === "run:failed")).toHaveLength(0);
  });


  it("does not duplicate safe raw deltas when no post-processor changes the reply", async () => {
    const f = fixture();
    const session = sessionFor(f);
    const deltas: string[] = [];
    const service = createAgentConversationService({
      sessions: {
        async create() { return session; },
        async read() { return session; },
        async updateBindings() { throw new Error("not used"); },
        async close() { return session; },
        async reset() { throw new Error("not used"); },
      },
      runs: {
        async create() { return {} as never; },
        async read() { throw new Error("not used"); },
        async finish() { return {} as never; },
      },
      authorizer: { async authorize() { return f.admission; } },
      strategy: {
        async execute(command) {
          await command.onTextDelta?.("Hello ");
          await command.onTextDelta?.("world");
          return { reply: "Hello world", parts: [] };
        },
      },
      sessionDurationMs: 60_000,
    });
    const response = await service.turn({
      authorizationHeader: "Bearer alpha",
      characterSessionId: session.characterSessionId,
      characterId: f.scope.characterId,
      text: "hello",
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
      onTextDelta: (delta) => { deltas.push(delta); },
    });
    expect(response.reply).toBe("Hello world");
    expect(deltas).toEqual(["Hello ", "world"]);
  });


  it("never early-streams unhandled billing or crypto machine markup", async () => {
    const f = fixture();
    const session = sessionFor(f);
    const deltas: string[] = [];
    const service = createAgentConversationService({
      sessions: {
        async create() { return session; },
        async read() { return session; },
        async updateBindings() { throw new Error("not used"); },
        async close() { return session; },
        async reset() { throw new Error("not used"); },
      },
      runs: {
        async create() { return {} as never; },
        async read() { throw new Error("not used"); },
        async finish() { return {} as never; },
      },
      authorizer: { async authorize() { return f.admission; } },
      strategy: {
        async execute() {
          return {
            reply: 'Invalid purchase <masanawa_crypto_action>{"type":"crypto.withdraw.quote"}</masanawa_crypto_action>',
            parts: [],
          };
        },
      },
      billingAssistant: {
        systemInstructions: [],
        async beforeInference() { return null; },
        async afterInference() { return null; },
      },
      sessionDurationMs: 60_000,
    });
    const response = await service.turn({
      authorizationHeader: "Bearer alpha",
      characterSessionId: session.characterSessionId,
      characterId: f.scope.characterId,
      text: "buy crypto",
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
      onTextDelta: (delta) => { deltas.push(delta); },
    });
    // Existing final-response sanitation is tracked separately. This ensures
    // the new early channel never becomes an additional disclosure path.
    expect(response.reply).toContain("masanawa_crypto_action");
    expect(deltas).toEqual([]);
  });


  it("bounds optional audio after durable text and suppresses late PCM", async () => {
    const f = fixture();
    const session = sessionFor(f);
    const runStates: string[] = [];
    const visible: string[] = [];
    const pcm: string[] = [];
    let audioSignal: AbortSignal | undefined;
    let lateChunk: ((chunk: Buffer) => void | Promise<void>) | undefined;
    const service = createAgentConversationService({
      sessions: {
        async create() { return session; },
        async read() { return session; },
        async updateBindings() { throw new Error("not used"); },
        async close() { return session; },
        async reset() { throw new Error("not used"); },
      },
      runs: {
        async create() { return {} as never; },
        async read() { throw new Error("not used"); },
        async finish(request) {
          runStates.push(request.outcome.state);
          return {} as never;
        },
      },
      authorizer: { async authorize() { return f.admission; } },
      strategy: {
        async execute() { return { reply: "Internal raw model answer", parts: [] }; },
      },
      billingAssistant: {
        systemInstructions: [],
        async beforeInference() { return null; },
        async afterInference() {
          return { reply: "Safe authorized text.", parts: [] };
        },
      },
      nativeAudio: {
        render(_text, signal, onPcmChunk) {
          audioSignal = signal;
          lateChunk = onPcmChunk;
          // Deliberately ignore AbortSignal: Gateway still must finish text.
          return new Promise<never>(() => {});
        },
      },
      sessionDurationMs: 60_000,
      audioTimeoutMs: 100,
    });
    const response = await service.turn({
      authorizationHeader: "Bearer alpha",
      characterSessionId: session.characterSessionId,
      characterId: f.scope.characterId,
      text: "show quote",
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
      onTextDelta: (delta) => { visible.push(delta); },
      onAudioPcmChunk: (chunk) => { pcm.push(chunk); },
    });
    expect(response.reply).toBe("Safe authorized text.");
    expect(response.audioBase64).toBeUndefined();
    expect(runStates).toEqual(["completed"]);
    expect(visible).toEqual(["Safe authorized text."]);
    expect(audioSignal?.aborted).toBe(true);
    await lateChunk?.(Buffer.from("late audio"));
    expect(pcm).toEqual([]);
  });

  it("cancels waiting audio on disconnect without undoing completed text", async () => {
    const f = fixture();
    const session = sessionFor(f);
    const aborter = new AbortController();
    let audioStarted!: () => void;
    const started = new Promise<void>((resolve) => { audioStarted = resolve; });
    const states: string[] = [];
    const service = createAgentConversationService({
      sessions: {
        async create() { return session; },
        async read() { return session; },
        async updateBindings() { throw new Error("not used"); },
        async close() { return session; },
        async reset() { throw new Error("not used"); },
      },
      runs: {
        async create() { return {} as never; },
        async read() { throw new Error("not used"); },
        async finish(request) { states.push(request.outcome.state); return {} as never; },
      },
      authorizer: { async authorize() { return f.admission; } },
      strategy: { async execute() { return { reply: "Already settled", parts: [] }; } },
      nativeAudio: {
        async render() {
          audioStarted();
          return new Promise<never>(() => {});
        },
      },
      audioTimeoutMs: 60_000,
      sessionDurationMs: 60_000,
    });
    const pending = service.turn({
      authorizationHeader: "Bearer alpha",
      characterSessionId: session.characterSessionId,
      characterId: f.scope.characterId,
      text: "hello",
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
      signal: aborter.signal,
    });
    await started;
    aborter.abort();
    const response = await pending;
    expect(response.reply).toBe("Already settled");
    expect(response.audioBase64).toBeUndefined();
    expect(states).toEqual(["completed"]);
  });

  it("never turns a synchronous audio provider throw into a failed settled run", async () => {
    const f = fixture();
    const session = sessionFor(f);
    const states: string[] = [];
    const service = createAgentConversationService({
      sessions: {
        async create() { return session; },
        async read() { return session; },
        async updateBindings() { throw new Error("not used"); },
        async close() { return session; },
        async reset() { throw new Error("not used"); },
      },
      runs: {
        async create() { return {} as never; },
        async read() { throw new Error("not used"); },
        async finish(request) { states.push(request.outcome.state); return {} as never; },
      },
      authorizer: { async authorize() { return f.admission; } },
      strategy: { async execute() { return { reply: "Settled", parts: [] }; } },
      nativeAudio: {
        render() { throw new Error("provider failed synchronously"); },
      },
      sessionDurationMs: 60_000,
    });
    const reply = await service.turn({
      authorizationHeader: "Bearer alpha",
      characterSessionId: session.characterSessionId,
      characterId: f.scope.characterId,
      text: "hello",
      requestId: createCanonicalId("request"),
      correlationId: createCanonicalId("correlation"),
    });
    expect(reply.reply).toBe("Settled");
    expect(states).toEqual(["completed"]);
  });

});
