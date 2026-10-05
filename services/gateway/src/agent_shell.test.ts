import { describe, expect, it } from "vitest";
import {
  createCanonicalId,
  nowInstant,
  toInstant,
} from "@masanawa/contracts";
import {
  createAuthorityContext,
} from "@masanawa/security";
import {
  emptyCharacterSessionBindings,
  type CharacterSession,
  type CharacterSessionRepository,
  type MobileShellActionRecord,
  type MobileShellRepository,
} from "@masanawa/agents";
import type {
  AgentConversationAdmission,
  AgentConversationAuthorizer,
} from "./agent_conversation_contract.js";
import { createAgentShellService } from "./agent_shell.js";

function fixture() {
  const tenantId = createCanonicalId("tenant");
  const userId = createCanonicalId("user");
  const characterId = createCanonicalId("character");
  const relationshipId = createCanonicalId("relationship");
  const characterVersionId = createCanonicalId("character-version");
  const characterSessionId = createCanonicalId("character-session");
  const at = nowInstant();
  const authority = createAuthorityContext({
    tenantId,
    principal: { kind: "user", userId },
    scopes: [],
    capabilities: [
      "agents.session.create",
      "agents.session.read",
      "agents.session.close",
      "agents.run.create",
      "agents.run.read",
      "agents.run.finish",
    ],
    resourceScope: { relationshipIds: [relationshipId] },
    policyRevision: "shell-test",
    approvalIds: [],
    delegationChain: [],
    requestId: createCanonicalId("request"),
    correlationId: createCanonicalId("correlation"),
    issuedAt: at,
  });
  const admission: AgentConversationAdmission = {
    scope: { tenantId, userId, characterId, relationshipId },
    characterVersionId,
    bindings: emptyCharacterSessionBindings,
    authority,
    presentation: {
      displayName: "Gwani",
      roleLabel: "Support",
      about: "Masanawa support agent",
    },
  };
  const session: CharacterSession = {
    schemaVersion: 1,
    tenantId,
    userId,
    characterId,
    relationshipId,
    characterSessionId,
    characterVersionId,
    bindings: emptyCharacterSessionBindings,
    state: "active",
    revision: 1,
    createdAt: at,
    updatedAt: at,
    expiresAt: toInstant(new Date(Date.now() + 60_000)),
    closedAt: null,
    closeReason: null,
    successorSessionId: null,
  };
  const authorizer: AgentConversationAuthorizer = {
    async authorize() {
      return admission;
    },
  };
  const sessions: CharacterSessionRepository = {
    async create() {
      return session;
    },
    async read() {
      return session;
    },
    async updateBindings() {
      return session;
    },
    async close() {
      return session;
    },
    async reset() {
      return { previous: session, current: session };
    },
  };
  return { admission, session, authorizer, sessions };
}

function repository() {
  let claimed = 0;
  let settled = 0;
  let existing: MobileShellActionRecord | null = null;
  const repo: MobileShellRepository = {
    async claimTurn() {
      throw new Error("not used");
    },
    async completeTurn() {
      throw new Error("not used");
    },
    async failTurn() {
      throw new Error("not used");
    },
    async readTurn() {
      return null;
    },
    async listHistory() {
      return [];
    },
    async appendEvent(input) {
      return {
        cursor: "1",
        type: input.type,
        payload: input.payload,
        createdAt: nowInstant(),
      };
    },
    async listEvents() {
      return [];
    },
    async claimAction(input) {
      claimed += 1;
      if (existing) return { created: false, record: existing };
      const at = nowInstant();
      existing = {
        scope: input.scope,
        characterSessionId: input.characterSessionId,
        documentId: input.documentId,
        revision: input.revision,
        tokenHash: input.tokenHash,
        actionId: input.actionId,
        nodeId: input.nodeId,
        valuesHash: input.valuesHash,
        state: "pending",
        result: null,
        createdAt: at,
        updatedAt: at,
      };
      return { created: true, record: existing };
    },
    async settleAction(input) {
      settled += 1;
      if (!existing) throw new Error("missing action");
      existing = {
        ...existing,
        state: input.state,
        result: input.result ?? null,
        updatedAt: nowInstant(),
      };
      return existing;
    },
    async readAction() {
      return existing;
    },
  };
  return {
    repo,
    get claimed() {
      return claimed;
    },
    get settled() {
      return settled;
    },
  };
}

const action = {
  documentId: "offer",
  revision: 1,
  nodeId: "confirm",
  actionId: "submit",
  token: "opaque-server-token",
  values: { plan: "monthly" },
};

describe("agent shell service", () => {
  it("fails closed for unsupported shell actions before claiming them", async () => {
    const f = fixture();
    const r = repository();
    const service = createAgentShellService({
      authorizer: f.authorizer,
      sessions: f.sessions,
      repository: r.repo,
    });

    await expect(
      service.dispatchAction({
        authorizationHeader: "Bearer test",
        characterId: f.admission.scope.characterId,
        characterSessionId: f.session.characterSessionId,
        action,
      }),
    ).rejects.toMatchObject({ code: "agents.shell_action_unavailable" });

    expect(r.claimed).toBe(0);
  });

  it("replays an accepted action without executing its side effect twice", async () => {
    const f = fixture();
    const r = repository();
    let executions = 0;
    const service = createAgentShellService({
      authorizer: f.authorizer,
      sessions: f.sessions,
      repository: r.repo,
      actionExecutor: {
        async execute() {
          executions += 1;
          return {
            accepted: true,
            phase: "fulfilled",
            message: "done",
          };
        },
      },
    });

    const request = {
      authorizationHeader: "Bearer test",
      characterId: f.admission.scope.characterId,
      characterSessionId: f.session.characterSessionId,
      action,
    };
    const first = await service.dispatchAction(request);
    const second = await service.dispatchAction(request);

    expect(first.record.state).toBe("accepted");
    expect(second.record.state).toBe("accepted");
    expect(executions).toBe(1);
    expect(r.claimed).toBe(2);
    expect(r.settled).toBe(1);
  });

  it("negotiates shell documents only when the client supports every v1 primitive", async () => {
    const f = fixture();
    const r = repository();
    const service = createAgentShellService({
      authorizer: f.authorizer,
      sessions: f.sessions,
      repository: r.repo,
      minimumAppVersion: "1.1.0",
      recommendedAppVersion: "1.2.0",
    });

    const oldClient = await service.config({
      authorizationHeader: "Bearer test",
      characterId: f.admission.scope.characterId,
      capabilities: { version: 1, primitives: ["text", "button"] },
    });
    expect(oldClient.features.shellDocuments).toBe(false);
    expect(oldClient.features.shellActions).toBe(false);

    const fullClient = await service.config({
      authorizationHeader: "Bearer test",
      characterId: f.admission.scope.characterId,
      capabilities: {
        version: 1,
        primitives: [
          "text",
          "heading",
          "column",
          "options",
          "card",
          "input",
          "button",
          "divider",
          "metric",
          "detail",
          "progress",
          "notice",
        ],
      },
    });
    expect(fullClient.features.shellDocuments).toBe(true);
    expect(fullClient.features.shellActions).toBe(true);
    expect(fullClient.minimumAppVersion).toBe("1.1.0");
    expect(fullClient.recommendedAppVersion).toBe("1.2.0");
  });
});

